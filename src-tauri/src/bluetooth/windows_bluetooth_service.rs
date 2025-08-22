use anyhow::{Result, anyhow};
use async_trait::async_trait;
use windows::{
    Devices::Bluetooth::{BluetoothAdapter, BluetoothConnectionStatus, BluetoothDevice},
    Devices::Enumeration::{
        DeviceInformation, DevicePairingKinds, DevicePairingRequestedEventArgs, DeviceWatcher,
    },
    Foundation::TypedEventHandler,
};

use crate::NINTENDO_BOARD_ID;
use crate::actors::bluetooth_service::{BluetoothAdapterInfo, BluetoothPeripheral, mac_address_to_wii_pin, BluetoothHandler};
use windows::Devices::Enumeration::{DeviceInformationUpdate, DevicePairingResultStatus, DeviceUnpairingResultStatus};
use windows::Foundation::IPropertyValue;
use windows::core::HSTRING;
use windows_core::Interface;
use crate::types::MacAddress;

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
                let device_collection = DeviceInformation::FindAllAsyncAqsFilter(&devices_selector)?.await?;
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
                        && adapter.id == default_adapter_id {
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
    async fn scan_and_pair_nintendo(&self) -> Result<BluetoothPeripheral> {
        tokio::task::spawn_blocking(move || {
            futures::executor::block_on(async {
                let default_adapter = BluetoothAdapter::GetDefaultAsync()?.await?;
                let adapter_mac_address = convert_u64_to_mac_address(default_adapter.BluetoothAddress()?);

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
                    try_pair_with_board(device_id.clone(), pin).await?;
                    let bluetooth_device = BluetoothDevice::FromIdAsync(&device_id)?.await?;
                    return convert_to_bluetooth_peripheral(bluetooth_device).await;
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

                let devices = DeviceInformation::FindAllAsyncAqsFilter(&devices_selector)?
                    .await?;

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

                let connection_status = device.ConnectionStatus()?;
                if connection_status == BluetoothConnectionStatus::Connected {
                    // Windows is very weird. If we check the pairing status, it will say that it's not paired.
                    // However, to disconnect it, we must unpair it.
                    let pairing = device.DeviceInformation()?.Pairing()?;
                    let unpair_result = pairing.UnpairAsync()?.await?;

                    return match unpair_result.Status()? {
                        DeviceUnpairingResultStatus::Unpaired => {
                            println!("Device successfully unpaired");
                            Ok(())
                        },
                        _ => {
                            Err(anyhow!("Failed to unpair: Unknown status: {:?}", unpair_result.Status()))
                        }
                    }
                }
                Ok(())
            })
        }).await?
    }
}

async fn try_pair_with_board(device_id: HSTRING, pin: [u8; 6]) -> Result<()> {
    println!("Trying to pair with device {}", device_id);

    let device_info = DeviceInformation::CreateFromIdAsync(&device_id)?.await?;
    let pairing = device_info.Pairing()?.Custom()?;

    pairing.PairingRequested(&TypedEventHandler::new(
        move |_, args: windows::core::Ref<DevicePairingRequestedEventArgs>| {
            if let Some(args) = args.as_ref() {
                let pin_as_u16: [u16; 6] = pin.map(|x| x as u16);
                args.AcceptWithPin(&HSTRING::from_wide(&pin_as_u16))?;
            }
            Ok(())
        },
    ))?;

    let pairing_result = pairing.PairAsync(DevicePairingKinds::ProvidePin)?.await?;
    if pairing_result.Status()? == DevicePairingResultStatus::Paired {
        println!("Successfully paired with device {}!", device_id);
        Ok(())
    } else {
        Err(anyhow!(
            "Pairing failed with status: {}",
            pairing_result.Status()?.0
        ))
    }
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