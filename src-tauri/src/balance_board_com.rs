use anyhow::Result;
use anyhow::anyhow;
use hidapi::HidDevice;

#[derive(Debug, Clone)]
struct BalanceBoardCalibrationData {
    kilos_0: BalanceBoardSensorReading,
    kilos_17: BalanceBoardSensorReading,
    kilos_34: BalanceBoardSensorReading,
}

impl BalanceBoardCalibrationData {
    fn from_memory_reading(buf: [u8; 32]) -> Result<BalanceBoardCalibrationData> {
        // Ensure buf has the expected initial data
        if buf[1] != 0x69 || buf[2] != 0 || buf[3] != 0 {
            return Err(anyhow!("Received incorrect data from the board!"));
        }

        let kilos_0 = BalanceBoardSensorReading {
            top_right:      i16::from_be_bytes([buf[4], buf[5]]),
            bottom_right:   i16::from_be_bytes([buf[6], buf[7]]),
            top_left:       i16::from_be_bytes([buf[8], buf[9]]),
            bottom_left:    i16::from_be_bytes([buf[10], buf[11]])
        };

        let kilos_17 = BalanceBoardSensorReading {
            top_right:      i16::from_be_bytes([buf[12], buf[13]]),
            bottom_right:   i16::from_be_bytes([buf[14], buf[15]]),
            top_left:       i16::from_be_bytes([buf[16], buf[17]]),
            bottom_left:    i16::from_be_bytes([buf[18], buf[19]])
        };

        let kilos_34 = BalanceBoardSensorReading {
            top_right:      i16::from_be_bytes([buf[20], buf[21]]),
            bottom_right:   i16::from_be_bytes([buf[22], buf[23]]),
            top_left:       i16::from_be_bytes([buf[24], buf[25]]),
            bottom_left:    i16::from_be_bytes([buf[26], buf[27]])
        };

        Ok(BalanceBoardCalibrationData {
            kilos_0,
            kilos_17,
            kilos_34,
        })
    }
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

pub fn check_hid() -> Result<()> {
    let api = hidapi::HidApi::new()?;
    // Print out information about all connected devices
    for device in api.device_list() {
        println!("{:?}", device);
        println!("{:?}", device.manufacturer_string());
        println!("{:?}", device.product_string());
    }

    let nintendo_device = api
        .device_list()
        .find(|device| device.product_string().unwrap() == "Nintendo RVL-CNT-01").ok_or(anyhow!("Device not found"))?;
    let open = nintendo_device.open_device(&api)?;

    // First, let's read the calibration data.
    let calibration_data = read_memory_data(&open)?;

    // Configure report: https://wiibrew.org/wiki/Wiimote#Data_Reporting
    // We can change the report by sending 2 bytes to report 0x12.
    // The first byte can be 0x00 or 0x04. (Decides how often we receive data)
    // The second byte can be between 0x30 and 0x3f (Chooses the mode)
    // Recommended data report for Wii Balance Board: https://wiibrew.org/wiki/Wii_Balance_Board#Data_Reporting
    // "Since the weight data is in the first 8 bytes, report 0x32 'Core Buttons with 8 Extension bytes'"
    let ir: [u8; 3] = [0x12, 0x00, 0x34];
    open.write(&ir)?;

    let mut buf = vec![0; 100];
    println!("Reading data from device ...\n");

    loop {
        let len = open.read(&mut buf)?;
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

        print!(
            "{}: {} {}, {}, {}",
            b.total_weight(&calibration_data),
            b.top_left_weight(&calibration_data),
            b.bottom_right_weight(&calibration_data),
            b.top_left_weight(&calibration_data),
            b.bottom_left_weight(&calibration_data)
        );
        println!();
        println!("{:?}", b);
        println!(); // Add a newline at the end
        std::thread::sleep(tokio::time::Duration::from_millis(1000));
    }

    Ok(())
}

fn read_memory_data(hid_device: &HidDevice) -> Result<BalanceBoardCalibrationData> {
    // https://wiibrew.org/wiki/Wiimote#Reading_and_Writing
    // Example: (a2) 17 MM FF FF FF SS SS
    // Read calibration data 0x04  a4  00  20
    let ir2: [u8; 7] = [0x17, 0x04, 0xA4, 0x00, 0x20, 0x00, 0x20];
    println!("Writing !");
    hid_device.write(&ir2)?;

    let mut buf = vec![0; 25];
    let mut calibration_data_buf: [u8; 32] = [0; 32];
    println!("Reading data from device ...\n");

    let mut current_read = 0;

    loop {
        // (a1) 21 BB BB SE FF FF DD DD DD DD DD DD DD DD DD DD DD DD DD DD DD DD
        // BB BB is the button state, so we ignore
        // SE - S is the size of bytes to read (1 to 16), E is an error value (0 means its ok)
        // FF FF is the offset of memory that has been read
        // DD is data to read
        let len = hid_device.read(&mut buf)?;

        // Print each value as uppercase hexadecimal
        for value in &buf[..len] {
            print!("{:02X} ", value);
        }
        println!(); // Add a newline at the end

        // We ignore everything that isn't what we want.
        if buf[0] != 0x21 {
            continue;
        }

        let size = (buf[3] >> 4) + 1;
        let error_flag = buf[3] << 4;
        let _offset = u16::from_be_bytes([buf[4], buf[5]]);

        println!("Read {} bytes", size);

        if size == 1 {
            return Err(anyhow!("Trying to read 0 bytes from memory?"));
        }
        if error_flag != 0 {
            return Err(anyhow!("Error while reading memory: {}", error_flag));
        }

        // TODO check this in a better way
        if current_read <= 32 {
            calibration_data_buf[current_read as usize..(current_read + size) as usize]
                .copy_from_slice(&buf[6..6 + (size as usize)]);
        } else {
            return Err(anyhow!("Trying to read more bytes than expected."));
        }

        current_read += size;

        // if we've read it all, return the result
        // THIS IS VERY HARDCODED!
        if current_read >= 32 {
            break;
        }
    }

    BalanceBoardCalibrationData::from_memory_reading(calibration_data_buf)
}
