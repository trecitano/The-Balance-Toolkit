use anyhow::Result;

use futures::future::join_all;

use windows::{Devices::Bluetooth::BluetoothAdapter, Devices::Enumeration::DeviceInformation, Devices::Enumeration::DeviceWatcher};
use windows::Devices::Bluetooth::{BluetoothConnectionStatus, BluetoothDevice};
use windows::Devices::Enumeration::{DevicePairingKinds, DevicePairingRequestedEventArgs, DeviceWatcherStatus};
use windows::Foundation::TypedEventHandler;

use tokio::time::{sleep, Duration, Instant};
use futures::executor::block_on;
use crate::bluetooth::bluetooth_communication::{mac_address_to_wii_pin, BluetoothAdapterInfo, BluetoothPeripheral, NINTENDO_BOARD_ID};

// In Windows, we can only use a single bluetooth adapter. (This is an assumption).
// Regardless of the assumption, it is extremely complicated to associate the adapters to the devices.
// As such, we assume that every connected device is directly connected to the default adapter.
#[cfg(target_os = "windows")]
pub async fn get_all_bluetooth_adapters_info() -> Result<Vec<Result<BluetoothAdapterInfo>>> {
    // Get list of all Bluetooth Adapters
    let adapter_selector = BluetoothAdapter::GetDeviceSelector()?;
    let adapter_collection = DeviceInformation::FindAllAsyncAqsFilter(&adapter_selector)?.await?;
    let adapter_futures = adapter_collection.into_iter().map(|info| async move {
        // Get the device ID and name
        let adapter_id = info.Id()?;
        let adapter_name = info.Name()?;
        let is_active = info.IsEnabled()?;

        let adapter = BluetoothAdapter::FromIdAsync(&adapter_id)?.await?;

        let mac_address = adapter.BluetoothAddress()?;
        let hexa_mac_address = format!("{:X}", mac_address);


        Ok(BluetoothAdapterInfo {
            id: adapter_id.to_string(),
            name: adapter_name.to_string(),
            mac_address: hexa_mac_address.clone(),
            wii_board_pin: mac_address_to_wii_pin(hexa_mac_address)?,
            is_active,
            devices: vec![]
        })
    });

    // Get list of all Bluetooth Devices
    let devices_selector = BluetoothDevice::GetDeviceSelector()?;
    let device_collection = DeviceInformation::FindAllAsyncAqsFilter(&devices_selector)?.await?;
    let device_futures = device_collection.into_iter().map(|info| async move {
        let device_id = info.Id()?;
        let device = BluetoothDevice::FromIdAsync(&device_id)?.await?;

        Ok(BluetoothPeripheral {
            id: device.BluetoothDeviceId()?.Id()?.to_string(),
            name: device.Name()?.to_string(),
            bluetooth_address: device.BluetoothAddress()?.to_string(),
            connection_status: device.ConnectionStatus()? == BluetoothConnectionStatus::Connected
        })
    });


    let mut adapter_list = join_all(adapter_futures).await;
    let device_list = join_all(device_futures).await;


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

#[cfg(target_os = "windows")]
pub async fn scan_and_pair_nintendo() -> Result<()> {
    // Create a device selector for Bluetooth devices
    let selector = BluetoothDevice::GetDeviceSelectorFromPairingState(false)?;
    // Create a DeviceWatcher to actively scan for devices
    let watcher = DeviceInformation::CreateWatcherAqsFilter(&selector)?;

    // Create the event handler for device discovery
    let added = TypedEventHandler::new(
        move |watcher: windows::core::Ref<DeviceWatcher>, info: windows::core::Ref<DeviceInformation>| {
            // Convert the `windows::core::Ref` to a usable reference
            let device_info: &DeviceInformation = info.unwrap();
            if let Ok(name) = device_info.Name() {
                println!("Discovered device: {}", name);
                if name.to_string() == NINTENDO_BOARD_ID.to_string() {
                    println!("Found the balance! Stopping the watcher.");
                    &watcher.as_ref().unwrap().Stop();

                    let device = block_on(async {BluetoothDevice::FromIdAsync(&device_info.Id()?)?.await })?;

                    // Create a pairing object
                    let pairing = device.DeviceInformation()?.Pairing()?.Custom()?;
                    // Register for pairing events

                    pairing.PairingRequested(&TypedEventHandler::new(
                        |_, args: windows::core::Ref<DevicePairingRequestedEventArgs>| {
                            if let Some(args) = args.as_ref() {
                                println!("{:#?}", args);
                                // When PIN is requested
                                // TODO CHANGE THIS!
                                let pin = "|©8ðyd"; // Your PIN
                                args.AcceptWithPin(&windows::core::HSTRING::from(pin))?;
                            }
                            Ok(())
                        }
                    ))?;

                    //pairing.PairWithProtectionLevelAsync(BluetoothPairingProtectionLevel::Pin)?;

                    // Start pairing
                    let pairing_result = block_on(async { pairing.PairAsync(DevicePairingKinds::ProvidePin)?.await })?;

                    if pairing_result.Status()?.0 == 0 { // Paired
                        println!("Successfully paired with the device!");
                        return Ok(());
                    } else {
                        println!("Pairing failed with status: {:#?}", pairing_result.Status()?.0);
                        //return Err(anyhow!("Failed to pair with device"));
                        return Ok(());
                    }
                }
            }
            Ok(())
        },
    );

    let enumeration =  TypedEventHandler::new(
        move |_watcher, _| {
            println!("Device discovery completed.");
            Ok(())
        },
    );

    watcher.Added(&added)?;
    watcher.EnumerationCompleted(&enumeration)?;

    // Start the watcher
    println!("Starting device watcher...");
    watcher.Start()?;

    let timeout = Duration::from_secs(60); // Total duration to loop
    let interval = Duration::from_secs(2); // Wait time between checks
    let start = Instant::now(); // Record the start time
    while start.elapsed() < timeout {
        // Check if something has happened
        let watcher_status = watcher.Status()?;

        if watcher_status == DeviceWatcherStatus::Stopped || watcher_status == DeviceWatcherStatus::Aborted {
            break;
        }

        println!("Waiting for 2 seconds...");
        sleep(interval).await; // Wait for 2 seconds
    }


    Ok(())
}