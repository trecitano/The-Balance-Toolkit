// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod bluetooth;

use crate::bluetooth::bluetooth_communication;
use anyhow::Result;
use anyhow::anyhow;
use std::thread;

#[tokio::main]
async fn main() {
    let all_bluetooth_view = bluetooth_communication::get_all_bluetooth_adapters_info()
        .await
        .unwrap();
    let bluetooth_view = all_bluetooth_view
        .iter() // Borrow the original Vec
        .filter_map(|result| result.as_ref().ok()) // Extract references to Ok values
        .collect();

    eprintln!("Bluetooth view: {:#?}", all_bluetooth_view);

    let nintendo_board_opt = bluetooth_communication::find_nintendo_balance_board(&bluetooth_view);
    if let Some(nintendo_board) = nintendo_board_opt {
        if nintendo_board.connection_status == false {
            println!("Nintendo board is off. Please turn it on!");
        }
    } else {
        println!("Nintendo is not paired. Please turn on the sync.");
        bluetooth_communication::scan_and_pair_nintendo()
            .await
            .unwrap()
    }

    check_hid().unwrap();

    //wii_pin_generator::all_adapter_bluetooth_connections().await;

    //balance_toolkit_app_lib::run()
}

#[derive(Debug, Clone)]
struct BalanceBoardCalibrationData {
    kilos_0: BalanceBoardSensorReading,
    kilos_17: BalanceBoardSensorReading,
    kilos_34: BalanceBoardSensorReading,
}

#[derive(Debug, Clone)]
struct BalanceBoardSensorReading {
    top_right: i16,
    bottom_right: i16,
    top_left: i16,
    bottom_left: i16,
}

impl BalanceBoardSensorReading {
    fn top_right_weight(&self, calibration: &BalanceBoardCalibrationData) -> f32 {
        self.get_balance_board_sensor_value(
            self.top_right,
            calibration.kilos_0.top_right,
            calibration.kilos_17.top_right,
            calibration.kilos_34.top_right,
        )
    }

    fn bottom_right_weight(&self, calibration: &BalanceBoardCalibrationData) -> f32 {
        self.get_balance_board_sensor_value(
            self.bottom_right,
            calibration.kilos_0.bottom_right,
            calibration.kilos_17.bottom_right,
            calibration.kilos_34.bottom_right,
        )
    }

    fn top_left_weight(&self, calibration: &BalanceBoardCalibrationData) -> f32 {
        self.get_balance_board_sensor_value(
            self.top_left,
            calibration.kilos_0.top_left,
            calibration.kilos_17.top_left,
            calibration.kilos_34.top_left,
        )
    }

    fn bottom_left_weight(&self, calibration: &BalanceBoardCalibrationData) -> f32 {
        self.get_balance_board_sensor_value(
            self.bottom_left,
            calibration.kilos_0.bottom_left,
            calibration.kilos_17.bottom_left,
            calibration.kilos_34.bottom_left,
        )
    }

    fn total_weight(&self, calibration: &BalanceBoardCalibrationData) -> f32 {
        let top_right_weight = self.top_right_weight(calibration);
        let bottom_right_weight = self.bottom_right_weight(calibration);
        let top_left_weight = self.top_left_weight(calibration);
        let bottom_left_weight = self.bottom_left_weight(calibration);

        top_right_weight + bottom_right_weight + top_left_weight + bottom_left_weight
    }

    fn center_of_gravity_x(&self, calibration: &BalanceBoardCalibrationData) -> f32 {
        let top_right_weight = self.top_right_weight(calibration);
        let bottom_right_weight = self.bottom_right_weight(calibration);
        let top_left_weight = self.top_left_weight(calibration);
        let bottom_left_weight = self.bottom_left_weight(calibration);
        let total_weight = self.total_weight(calibration);

        if total_weight > 0.0 {
            ((top_right_weight + bottom_right_weight) - (top_left_weight + bottom_left_weight))
                / total_weight
        } else {
            0.0
        }
    }

    fn center_of_gravity_y(&self, calibration: &BalanceBoardCalibrationData) -> f32 {
        let top_right_weight = self.top_right_weight(calibration);
        let bottom_right_weight = self.bottom_right_weight(calibration);
        let top_left_weight = self.top_left_weight(calibration);
        let bottom_left_weight = self.bottom_left_weight(calibration);
        let total_weight = self.total_weight(calibration);

        if total_weight > 0.0 {
            ((top_left_weight + top_right_weight) - (bottom_left_weight + bottom_right_weight))
                / total_weight
        } else {
            0.0
        }
    }

    fn get_balance_board_sensor_value(&self, sensor: i16, min: i16, mid: i16, max: i16) -> f32 {
        if max == mid || mid == min {
            return 0.0;
        }

        if sensor < mid {
            17.0 * ((sensor - min) as f32 / (mid - min) as f32)
        } else {
            17.0 * ((sensor - mid) as f32 / (max - mid) as f32) + 17.0
        }
    }

    // This function would need proper calibration data from the balance board
    fn convert_to_weight(raw_value: i16) -> f32 {
        // Placeholder conversion - you'll need to implement proper calibration
        // based on the balance board's calibration data
        raw_value as f32 * 0.01
    }
}

fn check_hid() -> Result<()> {
    let api = hidapi::HidApi::new().unwrap();
    // Print out information about all connected devices
    for device in api.device_list() {
        println!("{:?}", device);
        println!("{:?}", device.manufacturer_string());
        println!("{:?}", device.product_string());
    }

    let nintendo_device = api
        .device_list()
        .find(|device| device.product_string().unwrap() == "Nintendo RVL-CNT-01")
        .unwrap();
    let open = nintendo_device.open_device(&api).unwrap();

    // Configure report: https://wiibrew.org/wiki/Wiimote#Data_Reporting
    // We can change the report by sending 2 bytes to report 0x12.
    // The first byte can be 0x00 or 0x04. (Decides how often we receive data)
    // The second byte can be between 0x30 and 0x3f (Chooses the mode)
    let ir: [u8; 3] = [0x12, 0x00, 0x32];
    open.write(&ir)?;

    // https://wiibrew.org/wiki/Wiimote#Reading_and_Writing
    // Example: (a2) 17 MM FF FF FF SS SS
    // Read calibration data 0x04  a4  00  20
    let ir2: [u8; 7] = [0x17, 0x04, 0xA4, 0x00, 0x20, 0x00, 0x20];
    println!("Writing !");
    open.write(&ir2)?;
    //thread::sleep(tokio::time::Duration::from_millis(500));

    let mut buf = vec![0; 100];
    println!("Reading data from device ...\n");

    loop {
        let len = open.read(&mut buf)?;
        println!("Read {} bytes", len);
        // Check if we have enough data
        if len < 21 {
            return Err(anyhow!("Data packet too small"));
        }
        // Print each value as uppercase hexadecimal
        for value in &buf[..len] {
            print!("{:02X} ", value);
        }
        println!(); // Add a newline at the end

        // 32 BB BB EE EE EE EE EE EE EE EE
        // BBBB is the core Buttons data
        // The 8 EE bytes are from the Extension Controller currently connected to the Wii Remote.

        // Extract raw sensor values (typically at fixed offsets)
        let top_right = i16::from_be_bytes([buf[3], buf[4]]);
        let bottom_right = i16::from_be_bytes([buf[5], buf[6]]);
        let top_left = i16::from_be_bytes([buf[7], buf[8]]);
        let bottom_left = i16::from_be_bytes([buf[9], buf[10]]);

        let b = BalanceBoardSensorReading {
            top_right,
            bottom_right,
            top_left,
            bottom_left,
        };

        println!("{:?}", b);
        println!(); // Add a newline at the end
        //      thread::sleep(tokio::time::Duration::from_millis(2000));
    }

    Ok(())
}

fn read_memory_data(buf: &[u8]) -> BalanceBoardCalibrationData {
    // https://wiibrew.org/wiki/Wiimote#Reading_and_Writing
    // Example: (a2) 17 MM FF FF FF SS SS
    // Read calibration data 0x04  a4  00  20
    let ir2: [u8; 7] = [0x17, 0x04, 0xA4, 0x00, 0x20, 0x00, 0x20];
    println!("Writing !");
    open.write(&ir2)?;
}
