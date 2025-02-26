use anyhow::{anyhow, Result};

use crate::bluetooth::bluetooth_communication::{
    BluetoothAdapterInfo, BluetoothPeripheral, NINTENDO_BOARD_ID, better_mac_address_to_wii_pin,
};
use bluer::{Adapter, AdapterEvent, Address, DeviceEvent, DeviceProperty, DiscoveryFilter, DiscoveryTransport, Session};
use futures::future::join_all;
use futures::stream::StreamExt;
use std::collections::HashMap;
use std::pin::Pin;
use std::str::FromStr;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use bluer::agent::{Agent, ReqResult, RequestPinCode, RequestPinCodeFn};
use tokio::time::sleep;

pub async fn get_all_bluetooth_adapters_info() -> Result<Vec<Result<BluetoothAdapterInfo>>> {
    // Create a BlueZ session
    let session = Session::new().await?;

    // Get all available Bluetooth adapters
    let adapter_names = session.adapter_names().await?;

    // Create futures for each adapter to collect information
    let session_ref = &session;
    let adapter_futures = adapter_names.into_iter().map(|adapter_name| async move {
        let adapter = session_ref.adapter(&adapter_name)?;

        // Get basic adapter information
        let adapter_friendly_name = adapter.alias().await?;
        let adapter_modalias = adapter.modalias().await?;
        let adapter_name = adapter.name();
        let mac_address = adapter.address().await?.0;
        let is_active = adapter.is_powered().await?;

        // Get all devices associated with this adapter
        let mut devices: Vec<Result<BluetoothPeripheral>> = Vec::new();

        // Discover devices if adapter is powered on
        if is_active {
            // Get already known devices
            let device_addresses = adapter.device_addresses().await?;

            for address in device_addresses {
                let device = adapter.device(address)?;
                let device_name: String = device.name().await?.unwrap_or_default();
                let device_address = device.address().0;
                let is_connected = device.is_connected().await?;

                devices.push(Ok(BluetoothPeripheral {
                    id: address.to_string(),
                    name: device_name,
                    bluetooth_address: device_address,
                    connection_status: is_connected,
                }));
            }
        }

        Ok(BluetoothAdapterInfo {
            id: adapter_friendly_name,
            name: adapter_name.to_string(),
            mac_address,
            wii_board_pin: better_mac_address_to_wii_pin(mac_address),
            is_active,
            devices,
        })
    });

    // Collect information for all adapters
    let adapter_list = join_all(adapter_futures).await;

    Ok(adapter_list)
}

// In Linux with Bluer, we need to set up the agent that will handle the PIN.
pub async fn scan_and_pair_nintendo(adapter: &BluetoothAdapterInfo) -> Result<()> {
    let mut bluetooth_pin = String::new();

    // Process address in reverse pairs
    for byte in adapter.wii_board_pin {
        bluetooth_pin.push(byte as char);
    }

    let unchecked_pw = String::from_utf8_lossy(&adapter.wii_board_pin).to_string();


    println!("Pin is {}", bluetooth_pin);

    print!("Mac address:   ");
    for byte in adapter.mac_address {
        print!("{:02X} ", byte); // {:02X} formats as two-digit uppercase hex
    }
    println!();

    print!("Hexa pin:      ");
    for byte in adapter.wii_board_pin {
        print!("{:02X} ", byte); // {:02X} formats as two-digit uppercase hex
    }
    println!();

    print!("Hardcoded pin: ");
    for byte in  "|©8ðyd".as_bytes() {
        print!("{:02X} ", byte); // {:02X} formats as two-digit uppercase hex
    }
    println!();

    print!("String pin:    ");
    for byte in bluetooth_pin.as_bytes() {
        print!("{:02X} ", byte); // {:02X} formats as two-digit uppercase hex
    }
    println!();

    println!("Pin is {:?}", adapter.wii_board_pin);
    println!("Pin unchecked is {:?}", unchecked_pw);
    for byte in &adapter.wii_board_pin {
        print!("{:02X} ", byte); // Print each byte in uppercase hexadecimal
    }
    println!(); // Add a newline at the end

    // Convert to a single number (big-endian)
    let big_endian_number = adapter.wii_board_pin.iter().fold(0u64, |acc, &byte| (acc << 8) | byte as u64);
    println!("Big-endian number: {}", big_endian_number);

    let c = "|©8ðyd";
    // Set up a custom Bluetooth agent to handle the pairing
    let agent = Agent {
        request_pin_code: Some(Box::new(move |req| Box::pin({
            let v = c.clone();
            async move { Ok(v.into()) }
        }))),
        request_default: true,
        ..Default::default()
    };;

    let session = Session::new().await?;
    let agent_handle = session.register_agent(agent).await?;

    println!("Using Bluetooth adapter: {}", adapter.name);

    let adapter = session.adapter(&adapter.name)?;

    // Set up discovery filter

    let mut events = adapter.discover_devices().await?;

    // Set timeout for scanning
    let timeout = Duration::from_secs(60);
    let start_time = Instant::now();

    while let Some(event) = events.next().await {
        // Check if we've exceeded the timeout
        if start_time.elapsed() > timeout {
            println!("Discovery timeout reached");
            break;
        }

        if let AdapterEvent::DeviceAdded(addr) = event {
            // Try to get the device
            match adapter.device(addr) {
                Ok(device) => {
                    // Get device name
                    if let Ok(Some(name)) = device.name().await {
                        println!("Discovered device: {} ({})", name, addr);

                        if name == NINTENDO_BOARD_ID {
                            println!("Found Nintendo balance board! Attempting to pair...");

                            // Stop discovery before pairing
                            //adapter.stop_discovery().await?;

                            // Check if device is already paired
                            if let Ok(paired) = device.is_paired().await {
                                if paired {
                                    println!("Device is already paired");
                                    return Ok(());
                                }
                            }

                            // Pair with the device using the PIN
                            println!("Initiating pairing with PIN...");

                            // Register for pairing events
                            let mut device_events = device.events().await?;

                            // Set the device to connectable and pairable
                            println!("Trusting device");
                            device.set_trusted(true).await?;

                            // Attempt to pair
                            println!("Starting pairing...");
                            let pair_fut = device.pair();


                            // Handle pairing events simultaneously
                            tokio::select! {
                                pair_result = pair_fut => {
                                    match pair_result {
                                        Ok(_) => println!("Pairing successful!"),
                                        Err(e) => println!("Pairing failed: {}", e),
                                    }
                                }

                                Some(device_event) = device_events.next() => {
                                    match device_event {
                                        DeviceEvent::PropertyChanged(DeviceProperty::Paired(paired)) => {
                                            if paired {
                                                println!("Device successfully paired!");
                                                return Ok(());
                                            }
                                        }
                                        DeviceEvent::PropertyChanged(prop) => {
                                            println!("Property changed: {:?}", prop);
                                        }
                                        _ => { println!("{:?}", device_event); }
                                    }
                                }

                                _ = sleep(Duration::from_secs(30)) => {
                                    return Err(anyhow!("Pairing timed out"));
                                }
                            }


                            // Try to connect after pairing
                            if device.is_paired().await.unwrap_or(false) {
                                println!("Connecting to the device...");
                                if let Err(e) = device.connect().await {
                                    println!("Failed to connect: {}", e);
                                } else {
                                    println!("Successfully connected to the device!");
                                }
                                return Ok(());
                            }
                        }
                    }
                }
                Err(e) => {
                    println!("Error accessing device {}: {}", addr, e);
                }
            }
        }
    }

    // Stop discovery when done
    if adapter.is_discovering().await? {
        println!("Still discovering!");
        //adapter.stop_discovery().await?;
    }

    Ok(())
}
