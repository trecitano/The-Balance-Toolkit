use anyhow::{anyhow, Result};

#[cfg(target_os = "windows")]
use futures::future::join_all;
#[cfg(target_os = "windows")]
use windows::{Devices::Bluetooth::BluetoothAdapter, Devices::Enumeration::DeviceInformation, Devices::Enumeration::DeviceWatcher};
use windows::Devices::Bluetooth::{BluetoothConnectionStatus, BluetoothDevice};
use windows::Devices::Enumeration::{DeviceInformationUpdate, DevicePairingKinds, DevicePairingRequestedEventArgs};
use windows::Foundation::TypedEventHandler;
#[cfg(target_os = "linux")]
use bluez_async::BluetoothSession;

#[derive(Debug)]
pub struct BluetoothAdapterInfo {
    id: String,
    name: String,
    mac_address: String, // # u64 as upper hex string
    wii_board_pin: String,
    is_active: bool,
    devices: Vec<Result<BluetoothPeripheral>>
}

#[derive(Debug)]
pub struct BluetoothPeripheral {
    id: String,
    name: String,
    bluetooth_address: String,
    pub connection_status: bool,
}

#[cfg(target_os = "linux")]
pub async fn get_all_bluetooth_adapters_info() -> Result<Vec<Result<BluetoothAdapterInfo>>> {
    let (_, session) = BluetoothSession::new().await?;

    let adapters = session.get_adapters().await?;

    Ok(adapters
        .into_iter()
        .map(|adapter| {
            let mac_address = adapter.mac_address.to_string().replace(":", "");
            let wii_board_pin = address_to_wii_pin(mac_address.clone())?;

            Ok(BluetoothAdapterInfo {
                name: adapter.name,
                mac_address,
                wii_board_pin,
            })
        })
        .collect())
}

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
            wii_board_pin: address_to_wii_pin(hexa_mac_address)?,
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
        // Use if let to handle the Ok case
        if let Ok(adapter) = entry {
            if adapter.id == default_adapter_id {
                adapter.devices = device_list;
                break;
            }
        }
    }

    // Wait for all futures to complete
    Ok(adapter_list)
}

static NINTENDO_BOARD_ID: &str = "Nintendo RVL-WBC-01";
// Given a bluetooth detailed view, check if the nintendo board exists.
pub fn find_nintendo_balance_board<'a>(bluetooth_view: &'a Vec<&'a BluetoothAdapterInfo>) -> Option<&'a BluetoothPeripheral> {
    for adapter in bluetooth_view {
        for device_result in &adapter.devices {
            if let Ok(device) = device_result {
                if device.name == NINTENDO_BOARD_ID {
                    return Some(device);
                }
            }
        }
    }
    None
}

use futures::executor::block_on;

pub async fn scan_and_pair_nintendo() -> Result<()> {
    // Create a device selector for Bluetooth devices
    let selector = BluetoothDevice::GetDeviceSelectorFromPairingState(false).unwrap();
    // Create a DeviceWatcher to actively scan for devices
    let watcher = DeviceInformation::CreateWatcherAqsFilter(&selector).unwrap();

    // Create the event handler for device discovery
    let added = TypedEventHandler::new(
        move |_watcher: windows::core::Ref<DeviceWatcher>, info: windows::core::Ref<DeviceInformation>| {
            // Convert the `windows::core::Ref` to a usable reference
            let device_info: &DeviceInformation = info.unwrap();
            if let Ok(name) = device_info.Name() {
                println!("Discovered device: {}", name);
                if name.to_string() == NINTENDO_BOARD_ID.to_string() {
                    println!("Found the bazooka!");
                    &_watcher.as_ref().unwrap().Stop();

                    let device = block_on(async {BluetoothDevice::FromIdAsync(&device_info.Id()?)?.await })?;

                    // Create a pairing object
                    let pairing = device.DeviceInformation()?.Pairing()?;
                    let pairing_level = pairing.ProtectionLevel()?;
                    println!("Pairing level: {:?}", pairing_level);
                    let custom_pairing = pairing.Custom()?;
                    // Register for pairing events
                    let token = custom_pairing.PairingRequested(&TypedEventHandler::new(
                        |_, args: windows::core::Ref<DevicePairingRequestedEventArgs>| {
                            if let Some(args) = args.as_ref() {
                                println!("{:#?}", args);
                                // When PIN is requested
                                let pin = "|©8ðyd"; // Your PIN
                                args.AcceptWithPin(&windows::core::HSTRING::from(pin))?;
                            }
                            Ok(())
                        }
                    ))?;

                    if pairing.IsPaired()? {

                    }
                    if pairing.CanPair()? {

                    }

                    //pairing.PairWithProtectionLevelAsync(BluetoothPairingProtectionLevel::Pin)?;

                    // Start pairing
                    let pairing_result = block_on(async { custom_pairing.PairAsync(DevicePairingKinds::ProvidePin)?.await })?;

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

    let enumeration =  windows::Foundation::TypedEventHandler::new(
        move |_watcher, _| {
            println!("Device discovery completed.");
            Ok(())
        },
    );

    watcher.Status();

    watcher.Added(&added)?;
    watcher.EnumerationCompleted(&enumeration)?;

    // Start the watcher
    println!("Starting device watcher...");
    watcher.Start()?;

    // Keep the program running to allow the watcher to process events
    println!("Press Enter to stop the watcher...");
    let mut input = String::new();
    std::io::stdin().read_line(&mut input).unwrap();

    // Stop the watcher
    watcher.Stop()?;
    println!("Device discovery finished.");

    Ok(())
}



// https://github.com/lshachar/WiiBalanceWalker/blob/f44c8d8fff96f6fef7b1ccf9336c09fc0a01dbcd/WiiBalanceWalker/FormBluetooth.cs#L143
fn address_to_wii_pin(bluetooth_mac_address: String) -> Result<String> {
    if bluetooth_mac_address.len() != 12 {
        return Err(anyhow!(
            "Invalid Bluetooth Address: {}",
            bluetooth_mac_address
        ));
    }

    let mut bluetooth_pin = String::new();
    let mut double_zero_in_addr = false;

    // Process address in reverse pairs
    for i in (0..bluetooth_mac_address.len()).rev().step_by(2) {
        if i < 1 {
            break;
        }
        let hex = &bluetooth_mac_address[i - 1..=i];

        if hex == "00" {
            double_zero_in_addr = true;
        }

        let value = u8::from_str_radix(hex, 16).unwrap();
        bluetooth_pin.push(value as char);
    }

    if double_zero_in_addr {
        // Note: You'll need to implement double_zero_msg_box() equivalent
        // or handle this case differently in Rust
        return Ok("Invalid bt MAC address".to_string());
    }

    Ok(bluetooth_pin)
}
