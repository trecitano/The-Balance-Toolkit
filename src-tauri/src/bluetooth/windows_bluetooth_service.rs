use anyhow::{Result, anyhow};
use async_trait::async_trait;
use tokio::sync::mpsc;
use windows::{
    Devices::Bluetooth::{BluetoothAdapter, BluetoothConnectionStatus, BluetoothDevice},
    Devices::Enumeration::{DeviceInformation, DeviceWatcher},
    Foundation::TypedEventHandler,
};

use crate::NINTENDO_BOARD_ID;
use crate::actors::bluetooth_service::{
    BluetoothAdapterInfo, BluetoothHandler, BluetoothPeripheral, mac_address_to_wii_pin,
};
use crate::types::MacAddress;
use windows::Devices::Enumeration::{DeviceInformationUpdate, DeviceUnpairingResultStatus};
use windows::Foundation::IPropertyValue;
use windows::Win32::Devices::Bluetooth::{
    BLUETOOTH_ADDRESS, BLUETOOTH_ADDRESS_0, BLUETOOTH_DEVICE_INFO, BLUETOOTH_FIND_RADIO_PARAMS,
    BLUETOOTH_SERVICE_ENABLE, BluetoothAuthenticateDevice, BluetoothFindFirstRadio,
    BluetoothFindRadioClose, BluetoothGetDeviceInfo, BluetoothRemoveDevice,
    BluetoothSetServiceState,
};
use windows::Win32::Foundation::{CloseHandle, HANDLE};
use windows::core::HSTRING;
use windows_core::{GUID, Interface};

pub struct NativeBluetoothHandler;
#[async_trait]
impl BluetoothHandler for NativeBluetoothHandler {
    // In Windows, we can only use a single bluetooth adapter. (This is an assumption).
    // Regardless of the assumption, it is extremely complicated to associate the adapters to the devices.
    // As such, we assume that every connected device is directly connected to the default adapter.
    async fn get_all_bluetooth_adapters_info(&self) -> Result<Vec<Result<BluetoothAdapterInfo>>> {
        tokio::task::spawn_blocking(move || {
            futures::executor::block_on(async {
                // Get list of all Bluetooth Adapters
                let adapter_selector = BluetoothAdapter::GetDeviceSelector()?;
                let adapter_collection =
                    DeviceInformation::FindAllAsyncAqsFilter(&adapter_selector)?.await?;
                let adapter_futures = adapter_collection.into_iter().map(|info| async move {
                    let adapter_id = info.Id()?;
                    let adapter_name = info.Name()?;
                    let is_active = info.IsEnabled()?;

                    let adapter = BluetoothAdapter::FromIdAsync(&adapter_id)?.await?;
                    // Windows RT stores the mac address in a u64, but we only want the relevant 48 bits
                    // Only using the lower 48 bits of the u64
                    let mac_address = adapter.BluetoothAddress()?;

                    Ok(BluetoothAdapterInfo {
                        id: adapter_id.to_string(),
                        name: adapter_name.to_string(),
                        mac_address,
                        is_active,
                        devices: vec![],
                    })
                });

                // Get list of all Bluetooth Devices
                let devices_selector = BluetoothDevice::GetDeviceSelector()?;
                let device_collection =
                    DeviceInformation::FindAllAsyncAqsFilter(&devices_selector)?.await?;
                let device_futures = device_collection.into_iter().map(|info| async move {
                    let device_id = info.Id()?;
                    let device = BluetoothDevice::FromIdAsync(&device_id)?.await?;
                    convert_to_bluetooth_peripheral(device).await
                });

                let mut adapter_list = futures::future::join_all(adapter_futures).await;
                let device_list = futures::future::join_all(device_futures).await;

                // Add the device list to the default adapter
                let default_adapter = BluetoothAdapter::GetDefaultAsync()?.await?;
                let default_adapter_id = default_adapter.DeviceId()?;
                for entry in adapter_list.iter_mut() {
                    if let Ok(adapter) = entry
                        && adapter.id == default_adapter_id
                    {
                        adapter.devices = device_list;
                        break;
                    }
                }

                Ok(adapter_list)
            })
        })
        .await?
    }

    // In Windows, when we start pairing the board, we get an "Added" event containing a device
    // that does not have the name. This name is later added via an "Updated" event, that updates the
    // "System.ItemNameDisplay" device property.
    // As such, we need to pay attention to both "Added" and "Updated" events.
    async fn scan_and_pair_nintendo(
        &self,
        response_stream: mpsc::Sender<BluetoothPeripheral>,
    ) -> Result<()> {
        tokio::task::spawn_blocking(move || {
            futures::executor::block_on(async {
                let default_adapter = BluetoothAdapter::GetDefaultAsync()?.await?;
                let adapter_mac_address =
                    convert_u64_to_mac_address(default_adapter.BluetoothAddress()?);

                let selector = BluetoothDevice::GetDeviceSelectorFromPairingState(false)?;
                let watcher = DeviceInformation::CreateWatcherAqsFilter(&selector)?;
                let pin = mac_address_to_wii_pin(adapter_mac_address);

                let (tx, mut rx) = tokio::sync::mpsc::channel(1);

                let added_tx = tx.clone();
                let added = TypedEventHandler::new(
                    move |watcher: windows::core::Ref<DeviceWatcher>,
                          info: windows::core::Ref<DeviceInformation>| {
                        let device_info: &DeviceInformation = info.unwrap();
                        let device_id = device_info.Id()?;
                        let device_name = device_info.Name().unwrap();
                        let device_properties = device_info.Properties()?;

                        println!("Found device {}, {}", device_id, device_name);

                        let device_name_matches = device_name == NINTENDO_BOARD_ID;
                        let properties_matches =
                            properties_has_matching_name(&device_properties, NINTENDO_BOARD_ID);

                        if device_name_matches || properties_matches {
                            println!("Found the balance (in an add)! Pairing...");
                            let _ = watcher.as_ref().unwrap().Stop();
                            added_tx.try_send(device_id).unwrap();
                        }

                        Ok(())
                    },
                );

                let updated_tx = tx.clone();
                let updated = TypedEventHandler::new(
                    move |watcher: windows::core::Ref<DeviceWatcher>,
                          info: windows::core::Ref<DeviceInformationUpdate>| {
                        let device_update_info = match info.as_ref() {
                            Some(info) => info,
                            None => return Ok(()),
                        };
                        let device_id = device_update_info.Id()?;

                        let properties = device_update_info.Properties()?;
                        let properties_matches =
                            properties_has_matching_name(&properties, NINTENDO_BOARD_ID);

                        if properties_matches {
                            println!("Found the balance (in an update)! Pairing...");
                            let _ = watcher.as_ref().unwrap().Stop();
                            updated_tx.try_send(device_id).unwrap();
                        }

                        Ok(())
                    },
                );

                watcher.Added(&added)?;
                watcher.Updated(&updated)?;

                // Start the watcher
                println!("Starting device watcher...");
                watcher.Start()?;

                if let Some(device_id) = rx.recv().await {
                    let board_address =
                        parse_board_address(&device_id.to_string()).ok_or_else(|| {
                            anyhow!("Could not parse board address from id: {device_id}")
                        })?;
                    try_pair_with_board(board_address, pin)?;
                    let bluetooth_device = BluetoothDevice::FromIdAsync(&device_id)?.await?;
                    let peripheral = convert_to_bluetooth_peripheral(bluetooth_device).await?;
                    response_stream.send(peripheral).await.unwrap();
                    return Ok(());
                }

                Err(anyhow!("Failed to find a device to pair with."))
            })
        })
        .await?
    }

    async fn remove_device(&self, mac_address: MacAddress) -> Result<()> {
        tokio::task::spawn_blocking(move || {
            futures::executor::block_on(async {
                let devices_selector = BluetoothDevice::GetDeviceSelector()?;

                let devices = DeviceInformation::FindAllAsyncAqsFilter(&devices_selector)?.await?;

                let mut device_opt = None;
                for info in devices {
                    let device = BluetoothDevice::FromIdAsync(&info.Id()?)?.await?;
                    if device.BluetoothAddress()? == mac_address {
                        device_opt = Some(device);
                        break;
                    }
                }

                let device = match device_opt {
                    Some(device) => device,
                    None => return Ok(()),
                };

                // Windows is very weird. If we check the pairing status, it will say that it's not paired.
                // However, to disconnect it, we must unpair it.
                let pairing = device.DeviceInformation()?.Pairing()?;
                let unpair_result = pairing.UnpairAsync()?.await?;

                return match unpair_result.Status()? {
                    DeviceUnpairingResultStatus::Unpaired => {
                        println!("Device successfully unpaired");
                        Ok(())
                    }
                    _ => Err(anyhow!(
                        "Failed to unpair: Unknown status: {:?}",
                        unpair_result.Status()
                    )),
                };
            })
        })
        .await?
    }
}

fn try_pair_with_board(board_address: u64, pin: [u8; 6]) -> Result<()> {
    println!("Trying to pair (Win32) with {board_address:012x}, pin bytes {pin:02x?}");

    let pin_wide: [u16; 6] = pin.map(|byte| byte as u16);

    unsafe {
        // We assume a single default adapter, consistent with the rest of this module.
        let mut radio = HANDLE::default();
        let find_params = BLUETOOTH_FIND_RADIO_PARAMS {
            dwSize: size_of::<BLUETOOTH_FIND_RADIO_PARAMS>() as u32,
        };
        let radio_find = BluetoothFindFirstRadio(&find_params, &mut radio)?;

        let mut device_info = BLUETOOTH_DEVICE_INFO {
            dwSize: size_of::<BLUETOOTH_DEVICE_INFO>() as u32,
            Address: BLUETOOTH_ADDRESS {
                Anonymous: BLUETOOTH_ADDRESS_0 {
                    ullLong: board_address,
                },
            },
            ..Default::default()
        };

        let remove_status = BluetoothRemoveDevice(&device_info.Address);
        println!("BluetoothRemoveDevice returned {remove_status}");

        let info_status = BluetoothGetDeviceInfo(Some(radio), &mut device_info);
        if info_status != 0 {
            println!("BluetoothGetDeviceInfo returned {info_status} (continuing anyway)");
        }

        println!("Authenticating (legacy PIN); blocks until the ceremony finishes...");
        const ERROR_BUSY: u32 = 170;
        let mut auth_status =
            BluetoothAuthenticateDevice(None, Some(radio), &mut device_info, Some(&pin_wide));
        let mut attempts = 0;
        while auth_status == ERROR_BUSY && attempts < 10 {
            attempts += 1;
            println!("Radio busy (ERROR_BUSY); retrying pairing (attempt {attempts})...");
            std::thread::sleep(std::time::Duration::from_millis(800));
            auth_status =
                BluetoothAuthenticateDevice(None, Some(radio), &mut device_info, Some(&pin_wide));
        }

        if auth_status != 0 {
            let _ = BluetoothFindRadioClose(radio_find);
            let _ = CloseHandle(radio);
            return Err(anyhow!("Win32 pairing failed with error {auth_status}"));
        }

        println!("Successfully paired with {board_address:012x}!");

        let _ = BluetoothGetDeviceInfo(Some(radio), &mut device_info);
        let hid_service = GUID::from_u128(0x00001124_0000_1000_8000_00805f9b34fb);
        let service_status =
            BluetoothSetServiceState(Some(radio), &device_info, &hid_service, BLUETOOTH_SERVICE_ENABLE);
        if service_status != 0 {
            println!("Warning: enabling the HID service returned {service_status}");
        } else {
            println!("HID service enabled; the board should now appear as a HID device.");
        }

        let _ = BluetoothFindRadioClose(radio_find);
        let _ = CloseHandle(radio);
        Ok(())
    }
}

fn parse_board_address(device_id: &str) -> Option<u64> {
    let mac = device_id.rsplit('-').next()?;
    let hex: String = mac.chars().filter(|c| *c != ':').collect();
    if hex.len() != 12 {
        return None;
    }
    u64::from_str_radix(&hex, 16).ok()
}

fn properties_has_matching_name(
    properties: &windows_collections::IMapView<HSTRING, windows_core::IInspectable>,
    target: &str,
) -> bool {
    let item_name_inspectable = match properties.Lookup(&HSTRING::from("System.ItemNameDisplay")) {
        Ok(value) => value,
        Err(_) => return false,
    };

    let item_name_property: IPropertyValue = match item_name_inspectable.cast() {
        Ok(value) => value,
        Err(_) => return false,
    };

    let value = match item_name_property.GetString() {
        Ok(value) => value,
        Err(_) => return false,
    };

    value == *target
}

// Windows RT stores the mac address in a u64, but we only want the relevant 48 bits
// Only using the lower 48 bits of the u64
fn convert_u64_to_mac_address(winrt_mac_address: u64) -> [u8; 6] {
    let mut mac_address = [0u8; 6];

    for i in 0..6 {
        mac_address[5 - i] = ((winrt_mac_address >> (8 * i)) & 0xFF) as u8;
    }

    mac_address
}

async fn convert_to_bluetooth_peripheral(device: BluetoothDevice) -> Result<BluetoothPeripheral> {
    let device_id = device.DeviceId()?;
    let device_information = device.DeviceInformation()?;
    // In windows, the BluetoothDevice::GetDeviceSelector query only returns the bluetooth devices
    // that have been paired.
    let mac_address = device.BluetoothAddress()?;
    let is_paired = device_information.Pairing()?.IsPaired()?;
    let is_connected = device.ConnectionStatus()? == BluetoothConnectionStatus::Connected;

    Ok(BluetoothPeripheral {
        id: device_id.to_string(),
        name: device.Name()?.to_string(),
        mac_address,
        is_paired,
        is_connected,
    })
}
