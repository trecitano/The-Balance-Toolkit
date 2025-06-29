use anyhow::{Result, anyhow};

use windows::{
    Devices::Bluetooth::{BluetoothAdapter, BluetoothConnectionStatus, BluetoothDevice},
    Devices::Enumeration::{
        DeviceInformation, DevicePairingKinds, DevicePairingRequestedEventArgs, DeviceWatcher,
        DeviceWatcherStatus,
    },
    Foundation::TypedEventHandler,
};

use crate::NINTENDO_BOARD_ID;
use crate::bluetooth::bluetooth_communication::{
    BluetoothAdapterInfo, BluetoothPeripheral, mac_address_to_wii_pin,
};
use tokio::time::{Duration, Instant, sleep};
use windows::Devices::Enumeration::{DeviceInformationUpdate, DevicePairingResultStatus};
use windows::Foundation::IPropertyValue;
use windows::core::HSTRING;
use windows_core::Interface;

// In Windows, we can only use a single bluetooth adapter. (This is an assumption).
// Regardless of the assumption, it is extremely complicated to associate the adapters to the devices.
// As such, we assume that every connected device is directly connected to the default adapter.
pub async fn get_all_bluetooth_adapters_info() -> Result<Vec<Result<BluetoothAdapterInfo>>> {
    // Get list of all Bluetooth Adapters
    let adapter_selector = BluetoothAdapter::GetDeviceSelector()?;
    let adapter_collection = DeviceInformation::FindAllAsyncAqsFilter(&adapter_selector)?.await?;
    let adapter_futures = adapter_collection.into_iter().map(|info| async move {
        let adapter_id = info.Id()?;
        let adapter_name = info.Name()?;
        let is_active = info.IsEnabled()?;

        let adapter = BluetoothAdapter::FromIdAsync(&adapter_id)?.await?;

        let mac_address = convert_u64_to_mac_address(adapter.BluetoothAddress()?);

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
        // In windows, the BluetoothDevice::GetDeviceSelector query only returns the bluetooth devices
        // that have been paired.
        let is_paired = true;
        let is_connected = device.ConnectionStatus()? == BluetoothConnectionStatus::Connected;
        let mac_address = convert_u64_to_mac_address(device.BluetoothAddress()?);

        Ok(BluetoothPeripheral {
            id: device.BluetoothDeviceId()?.Id()?.to_string(),
            name: device.Name()?.to_string(),
            mac_address,
            is_paired,
            is_connected,
        })
    });

    let mut adapter_list = futures::future::join_all(adapter_futures).await;
    let device_list = futures::future::join_all(device_futures).await;

    // Add the device list to the default adapter
    let default_adapter = BluetoothAdapter::GetDefaultAsync()?.await?;
    let default_adapter_id = default_adapter.DeviceId()?;
    for entry in adapter_list.iter_mut() {
        if let Ok(adapter) = entry {
            if adapter.id == default_adapter_id {
                adapter.devices = device_list;
                break;
            }
        }
    }

    Ok(adapter_list)
}

//
// In Windows, when we start pairing the board, we get an "Added" event containing a device
// that does not have the name. This name is later added via an "Updated" event, that updates the
// "System.ItemNameDisplay" device property.
// As such, we need to pay attention to both "Added" and "Updated" events.
pub async fn scan_and_pair_nintendo(adapter: &BluetoothAdapterInfo) -> Result<()> {
    let selector = BluetoothDevice::GetDeviceSelectorFromPairingState(false)?;
    let watcher = DeviceInformation::CreateWatcherAqsFilter(&selector)?;
    let pin = mac_address_to_wii_pin(adapter.mac_address);
    println!("Pin: {:?}", pin);
    let hex_string: String = pin.iter()
        .map(|b| format!("{:02X}", b))
        .collect::<Vec<_>>()
        .join(" ");
    println!("Hexa Pin: {}", hex_string);
    println!("String Pin: {}", String::from_utf8_lossy(&pin));

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

                let _ = tokio::runtime::Runtime::new()?.block_on(async move {
                    match try_pair_with_board(device_id, pin).await {
                        Ok(_) => {
                            println!("Balance paired successfully!");
                            if let Err(e) = watcher.as_ref().unwrap().Stop() {
                                eprintln!("Failed to stop watcher: {:?}", e);
                            }
                        }
                        Err(e) => println!("{}", e.to_string()),
                    }
                });
            }

            Ok(())
        },
    );

    // Create the event handler for device discovery
    // If we receive an update that contains the device name, we must check if it is the board.
    // If it is the board, then we can stop the search and check it.
    let updated = TypedEventHandler::new(
        move |watcher: windows::core::Ref<DeviceWatcher>,
              info: windows::core::Ref<DeviceInformationUpdate>| {
            let device_update_info = match info.as_ref() {
                Some(info) => info,
                None => return Ok(()),
            };
            let device_id = device_update_info.Id()?;

            let properties = device_update_info.Properties()?;
            let properties_matches = properties_has_matching_name(&properties, NINTENDO_BOARD_ID);

            if properties_matches {
                let _ = tokio::runtime::Runtime::new()?.block_on(async move {
                    match try_pair_with_board(device_id, pin).await {
                        Ok(_) => {
                            println!("Balance paired successfully!");
                            if let Err(e) = watcher.as_ref().unwrap().Stop() {
                                eprintln!("Failed to stop watcher: {:?}", e);
                            }
                        }
                        Err(e) => println!("{}", e.to_string()),
                    }
                });
            }

            Ok(())
        },
    );

    watcher.Added(&added)?;
    watcher.Updated(&updated)?;

    // Start the watcher
    println!("Starting device watcher...");
    watcher.Start()?;

    let timeout = Duration::from_secs(30); // Total duration to loop
    let interval = Duration::from_secs(1); // Wait time between checks
    let start = Instant::now(); // Record the start time
    while start.elapsed() < timeout {
        // Check if something has happened
        let watcher_status = watcher.Status()?;

        if watcher_status == DeviceWatcherStatus::Stopped
            || watcher_status == DeviceWatcherStatus::Aborted
        {
            break;
        }

        sleep(interval).await; // Wait for 2 seconds
    }

    Ok(())
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

    value == HSTRING::from(target)
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
