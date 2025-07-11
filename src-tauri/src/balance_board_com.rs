use anyhow::{anyhow, Result};
use hidapi::{HidApi, HidDevice};
use lsl::Pushable;
use std::sync::mpsc::{self, Receiver, Sender};
use std::thread::{self, JoinHandle};
use std::time::Duration;

// --- HID Command Constants ---
const HID_CMD_SET_REPORT_TYPE: u8 = 0x12;
const HID_CMD_DATA_REPORT_MODE: u8 = 0x34; // Core Buttons with 8 Extension bytes

// --- Memory and Calibration Constants ---
const CALIBRATION_DATA_SIZE: usize = 32;

// --- Data Packet Constants ---
const DATA_REPORT_READ_EVENT: u8 = 0x21;
const DATA_PACKET_MIN_LEN: usize = 10; // Minimum expected data packet size

// --- Main Struct to Manage the Balance Board ---

pub struct WiiBalanceBoard {
    device: HidDevice,
    calibration: BalanceBoardCalibrationData,
    thread_handles: Vec<JoinHandle<Result<()>>>,
    user_action_tx: Sender<UserAction>,
}

impl WiiBalanceBoard {
    pub fn new(device_id: &str) -> Result<Self> {
        let api = HidApi::new()?;
        // The serial number of a nintendo balance board is the string version of a mac address.
        // If the mac address is "00:23:31:87:B1:16", its serial number is "00233187B116".
        let balance_board_info = api
            .device_list()
            .find(|device| {
                if let Some(serial_number) = device.serial_number() {
                    serial_number == device_id
                } else {
                    false
                }
            })
            .ok_or(anyhow!("Device with the specified device_id was not found."))?;

        let device = balance_board_info.open_device(&api)?;
        println!("Successfully opened connection to the Wii Balance Board.");

        let calibration = Self::read_calibration_data(&device)?;
        println!("Successfully read calibration data.");

        // Configure report: https://wiibrew.org/wiki/Wiimote#Data_Reporting
        // We can change the report by sending 2 bytes to report 0x12.
        // The first byte can be 0x00 or 0x04. (Decides how often we receive data)
        // The second byte can be between 0x30 and 0x3f (Chooses the mode)
        // Recommended data report for Wii Balance Board: https://wiibrew.org/wiki/Wii_Balance_Board#Data_Reporting
        // "Since the weight data is in the first 8 bytes, report 0x32 'Core Buttons with 8 Extension bytes'"
        let set_report_cmd: [u8; 3] = [HID_CMD_SET_REPORT_TYPE, 0x00, HID_CMD_DATA_REPORT_MODE];
        device.write(&set_report_cmd)?;

        let (user_action_tx, _) = mpsc::channel(); // Will be cloned for use

        Ok(Self {
            device,
            calibration,
            thread_handles: Vec::new(),
            user_action_tx,
        })
    }

    pub fn run(&mut self) -> Result<()> {
        println!("Start!");
        let (raw_reading_tx, raw_reading_rx) = mpsc::channel::<BalanceBoardSensorReading>();
        let (processed_data_tx, processed_data_rx) = mpsc::channel::<[f32; 4]>();
        let (user_action_tx, user_action_rx) = mpsc::channel::<UserAction>();
        self.user_action_tx = user_action_tx;

        // --- 1. HID Reading Thread ---
        let api = HidApi::new()?;
        let device_path = self.device.get_device_info()?.path().to_owned();
        let device_clone = api.open_path(&device_path)?;
        let read_handle = thread::spawn(move || {
            Self::hid_read_loop(device_clone, raw_reading_tx)
        });
        self.thread_handles.push(read_handle);

        // --- 2. Data Processing Thread ---
        let calibration_clone = self.calibration.clone();
        let process_handle = thread::spawn(move || {
            Self::data_process_loop(calibration_clone, raw_reading_rx, processed_data_tx, user_action_rx)
        });
        self.thread_handles.push(process_handle);

        // --- 3. LSL Streaming Thread ---
        let lsl_handle = thread::spawn(move || {
            Self::lsl_stream_loop(processed_data_rx)
        });
        self.thread_handles.push(lsl_handle);

        println!("All systems running. Enter 'tare' to zero the scale or 'exit' to quit.");
        self.handle_user_input()?;

        Ok(())
    }

    pub fn tare(&self) -> Result<()> {
        self.user_action_tx.send(UserAction::Tare)?;
        Ok(())
    }

    fn handle_user_input(&self) -> Result<()> {
        loop {
            let mut input = String::new();
            std::io::stdin().read_line(&mut input)?;
            match input.trim() {
                "tare" => {
                    println!("Taring the board...");
                    self.tare()?;
                }
                "exit" => {
                    println!("Exiting...");
                    break;
                }
                _ => println!("Unknown command. Available commands: 'tare', 'exit'"),
            }
        }
        Ok(())
    }

    fn hid_read_loop(device: HidDevice, tx: Sender<BalanceBoardSensorReading>) -> Result<()> {
        loop {
            let mut buf = [0u8; 32]; // Buffer large enough for expected reports
            let len = device.read_timeout(&mut buf, 1000)?;

            if len == 0 { continue; } // Timeout, just continue

            if len >= DATA_PACKET_MIN_LEN {
                let reading = BalanceBoardSensorReading {
                    top_right: i16::from_be_bytes([buf[3], buf[4]]),
                    bottom_right: i16::from_be_bytes([buf[5], buf[6]]),
                    top_left: i16::from_be_bytes([buf[7], buf[8]]),
                    bottom_left: i16::from_be_bytes([buf[9], buf[10]]),
                };
                println!("Raw reading: {:?}", reading);
                if tx.send(reading).is_err() {
                    break; // Receiver has disconnected
                }
            }
        }
        Err(anyhow!("HID read loop terminated."))
    }

    fn data_process_loop(
        calibration: BalanceBoardCalibrationData,
        raw_rx: Receiver<BalanceBoardSensorReading>,
        processed_tx: Sender<[f32; 4]>,
        user_action_rx: Receiver<UserAction>,
    ) -> Result<()> {
        let mut tare_offset = BalanceBoardSensorReading::default();

        loop {
            // Non-blocking check for user actions
            if let Ok(action) = user_action_rx.try_recv() {
                match action {
                    UserAction::Tare => {
                        // To tare, we need the *next* stable reading.
                        // This is a simplification; a real implementation might average a few readings.
                        if let Ok(latest_reading) = raw_rx.recv_timeout(Duration::from_secs(1)) {
                            tare_offset = latest_reading;
                            println!("Tare offset captured.");
                        }
                    }
                }
            }

            match raw_rx.recv() {
                Ok(raw_reading) => {
                    let tared_reading = raw_reading.apply_tare(&tare_offset);
                    let weights = tared_reading.calculate_weights(&calibration);
                    println!("Tared reading: {:?}", weights);
                    if processed_tx.send(weights).is_err() {
                        break; // Receiver has disconnected
                    }
                }
                Err(_) => break, // Sender has disconnected
            }
        }
        Err(anyhow!("Data processing loop terminated."))
    }

    fn lsl_stream_loop(processed_rx: Receiver<[f32; 4]>) -> Result<()> {
        let info = lsl::StreamInfo::new(
            "TheBalanceToolkit", "Weight", 4, 100.0,
            lsl::ChannelFormat::Float32, "BalanceBoard",
        )?;
        let outlet = lsl::StreamOutlet::new(&info, 0, 360)?;

        println!("LSL stream started.");
        while let Ok(weights) = processed_rx.recv() {
            let total_weight: f32 = weights.iter().sum();
            println!(
                "Total: {:.2}kg | TR: {:.2}, BR: {:.2}, TL: {:.2}, BL: {:.2}",
                total_weight, weights[0], weights[1], weights[2], weights[3]
            );
            outlet.push_sample(&weights.to_vec())?;
        }
        Err(anyhow!("LSL stream loop terminated."))
    }

    fn read_calibration_data(device: &HidDevice) -> Result<BalanceBoardCalibrationData> {
        // https://wiibrew.org/wiki/Wiimote#Reading_and_Writing
        // Example: (a2) 17 MM FF FF FF SS SS
        // https://wiibrew.org/wiki/Wii_Balance_Board#Calibration_Data
        // Read calibration data:
        // 17 (Output Control)
        // 04 (Address Space) 
        // a40020 (Memory Address)
        // 20 (Bytes to Read)
        // We need to read at least 2 packets, as each packet is not large enough to contain
        // all of the calibration data.
        let cmd: [u8; 7] = [0x17, 0x04, 0xA4, 0x00, 0x20, 0x00, 0x20];
        device.write(&cmd)?;

        let mut calibration_buf = [0u8; CALIBRATION_DATA_SIZE];
        let mut bytes_read: usize = 0;

        while bytes_read < CALIBRATION_DATA_SIZE {
            let mut buf = [0u8; 32];
            let len = device.read_timeout(&mut buf, 1000)?;

            if len == 0 { return Err(anyhow!("Timeout reading calibration data.")); }
            // We ignore everything that isn't what we want.
            // When we send a request for this specific data, we receive a data reading through
            // Input Report 0x21
            if buf[0] != DATA_REPORT_READ_EVENT { continue; }

            println!("Reading is: {:?}", buf);
            for byte in buf {
                // Print each byte as a 2-digit lowercase hex number, followed by a space
                print!("{:02x} ", byte);
            }
            println!();

            let packet_data_size  = ((buf[3] >> 4) + 1) as usize;
            let error_code = buf[3] & 0x0F;
            
            if error_code != 0 { return Err(anyhow!("Error reading board memory: code {}", error_code)); }
            if bytes_read + packet_data_size > CALIBRATION_DATA_SIZE { return Err(anyhow!("Calibration data overflow.")); }

            let data_chunk = &buf[6..(6 + packet_data_size)];
            calibration_buf[bytes_read..(bytes_read + packet_data_size)].copy_from_slice(data_chunk);
            bytes_read += packet_data_size;

            if bytes_read == CALIBRATION_DATA_SIZE {
                break;
            }
        }

        BalanceBoardCalibrationData::from_bytes(calibration_buf)
    }
}

// --- Enums for Actions and Events ---
#[derive(Debug, Clone, Copy)]
enum UserAction {
    Tare,
}

// --- Data Structures for Balance Board Readings ---

#[derive(Debug, Clone, Default)]
struct  BalanceBoardSensorReading {
    top_right: i16,
    bottom_right: i16,
    top_left: i16,
    bottom_left: i16,
}

impl BalanceBoardSensorReading {
    fn apply_tare(&self, tare_offset: &BalanceBoardSensorReading) -> Self {
        Self {
            top_right: self.top_right.saturating_sub(tare_offset.top_right),
            bottom_right: self.bottom_right.saturating_sub(tare_offset.bottom_right),
            top_left: self.top_left.saturating_sub(tare_offset.top_left),
            bottom_left: self.bottom_left.saturating_sub(tare_offset.bottom_left),
        }
    }

    fn calculate_weights(&self, cal: &BalanceBoardCalibrationData) -> [f32; 4] {
        [
            self.calculate_single_weight(self.top_right, &cal.top_right),
            self.calculate_single_weight(self.bottom_right, &cal.bottom_right),
            self.calculate_single_weight(self.top_left, &cal.top_left),
            self.calculate_single_weight(self.bottom_left, &cal.bottom_left),
        ]
    }

    fn calculate_single_weight(&self, sensor_val: i16, cal_pt: &CalibrationPoint) -> f32 {
        if sensor_val < cal_pt.mid {
            17.0 * (sensor_val - cal_pt.min) as f32 / (cal_pt.mid - cal_pt.min).max(1) as f32
        } else {
            17.0 + 17.0 * (sensor_val - cal_pt.mid) as f32 / (cal_pt.max - cal_pt.mid).max(1) as f32
        }
    }
}

#[derive(Debug, Clone, Default)]
struct CalibrationPoint {
    min: i16, // 0kg
    mid: i16, // 17kg
    max: i16, // 34kg
}

#[derive(Debug, Clone, Default)]
struct BalanceBoardCalibrationData {
    top_right: CalibrationPoint,
    bottom_right: CalibrationPoint,
    top_left: CalibrationPoint,
    bottom_left: CalibrationPoint,
}

impl BalanceBoardCalibrationData {
    fn from_bytes(buf: [u8; 32]) -> Result<Self> {
        Ok(Self {
            top_right: CalibrationPoint {
                min: i16::from_be_bytes([buf[4], buf[5]]),
                mid: i16::from_be_bytes([buf[12], buf[13]]),
                max: i16::from_be_bytes([buf[20], buf[21]]),
            },
            bottom_right: CalibrationPoint {
                min: i16::from_be_bytes([buf[6], buf[7]]),
                mid: i16::from_be_bytes([buf[14], buf[15]]),
                max: i16::from_be_bytes([buf[22], buf[23]]),
            },
            top_left: CalibrationPoint {
                min: i16::from_be_bytes([buf[8], buf[9]]),
                mid: i16::from_be_bytes([buf[16], buf[17]]),
                max: i16::from_be_bytes([buf[24], buf[25]]),
            },
            bottom_left: CalibrationPoint {
                min: i16::from_be_bytes([buf[10], buf[11]]),
                mid: i16::from_be_bytes([buf[18], buf[19]]),
                max: i16::from_be_bytes([buf[26], buf[27]]),
            },
        })
    }
}

// --- Public-Facing API ---

// This function is now a simple wrapper around the struct.
// In a real Tauri app, you might manage the WiiBalanceBoard instance in your AppState.
pub fn connect(device_id: String) -> Result<()> {
    let mut board = WiiBalanceBoard::new(&device_id)?;
    board.run()
}
