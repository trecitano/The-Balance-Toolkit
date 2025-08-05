use std::thread;
use anyhow::anyhow;
use chrono::Utc;
use hidapi::{HidDevice, HidResult};
use tokio::sync::mpsc;
use crate::actors::balance_board_actor::BalanceBoardCalibratedReading;

// --- HID Command Constants ---
const HID_INTERFACE_LED_INPUT: u8 = 0x11;
const HID_INTERFACE_DATA_REPORTING: u8 = 0x12;

// Configure report: https://wiibrew.org/wiki/Wiimote#Data_Reporting
// We can change the report by sending 2 bytes to report 0x12.
// The first byte can be 0x00 or 0x04. (Decides how often we receive data)
// The second byte can be between 0x30 and 0x3f (Chooses the mode)
// Recommended data report for Wii Balance Board: https://wiibrew.org/wiki/Wii_Balance_Board#Data_Reporting
// "Since the weight data is in the first 8 bytes, report 0x32 'Core Buttons with 8 Extension bytes'"
const HID_CMD_DATA_REPORT_MODE: u8 = 0x34; // Core Buttons with 8 Extension bytes

// --- Memory and Calibration Constants ---
const CALIBRATION_DATA_SIZE: usize = 32;

// --- Data Packet Constants ---
const DATA_REPORT_READ_EVENT: u8 = 0x21;
const DATA_PACKET_MIN_LEN: usize = 10; // Minimum expected data packet size

// --- BALANCE BOARD COMMANDS ---
// https://wiibrew.org/wiki/Wiimote#Player_LEDs
const BOARD_TURN_ON_LED: [u8; 2] = [HID_INTERFACE_LED_INPUT, 0x10];
const BOARD_TURN_OFF_LED: [u8; 2] = [HID_INTERFACE_LED_INPUT, 0x00];

const BOARD_START_READING: [u8; 3] = [HID_INTERFACE_DATA_REPORTING, 0x00, HID_CMD_DATA_REPORT_MODE];
const BOARD_STOP_READING: [u8; 3] = [HID_INTERFACE_DATA_REPORTING, 0x00, 0x30];

#[derive(Debug)]
pub enum BalanceBoardCommands {
    TurnOnLed,
    TurnOffLed,
    ApplyTare,
    StartRecording(mpsc::Sender<BalanceBoardCalibratedReading>),
    FinishRecording,
}

pub fn initialize(
    device: HidDevice,
    rx: mpsc::Receiver<BalanceBoardCommands>
) -> thread::JoinHandle<anyhow::Result<()>> {

    thread::spawn(move || {
        blocking_hid_loop(device, rx)
    })
}

fn blocking_hid_loop(
    device: HidDevice,
    mut hid_control_rx: mpsc::Receiver<BalanceBoardCommands>,
) -> anyhow::Result<()> {
    let mut buf = [0u8; 32];

    write_to_device(&device, &BOARD_TURN_ON_LED)?;
    let calibration = read_calibration_data(&device)?;
    let mut tx_channel: Option<mpsc::Sender<BalanceBoardCalibratedReading>> = None;
    // By default, we use an empty tare value.
    // If the user wants to tare, then in the next balance board reading, the tare_value is updated.
    let mut update_tare = false;
    let mut tare_value: BalanceBoardSensorRawReading = BalanceBoardSensorRawReading::default();

    loop {
        match hid_control_rx.try_recv() {
            Ok(command) => {
                println!("blocking hid: Got command: {:?}", command);
                match command {
                    BalanceBoardCommands::TurnOnLed => { write_to_device(&device, &BOARD_TURN_ON_LED)?; }
                    BalanceBoardCommands::TurnOffLed => { write_to_device(&device, &BOARD_TURN_OFF_LED)?; }
                    BalanceBoardCommands::ApplyTare => { update_tare = true; }
                    BalanceBoardCommands::StartRecording(tx) => {
                        tx_channel = Some(tx);
                        write_to_device(&device, &BOARD_START_READING)?; 
                    },
                    BalanceBoardCommands::FinishRecording => {
                        tx_channel = None;
                        write_to_device(&device, &BOARD_STOP_READING)?;
                    },
                }
            },
            Err(mpsc::error::TryRecvError::Empty) => { /* No command, continue */ },
            Err(mpsc::error::TryRecvError::Disconnected) => {
                // The async part has shut down. We must exit.
                println!("HID Loop: Control channel disconnected. Shutting down.");
                break;
            }
        }

        match read_from_device(&device, &mut buf) {
            Ok(len) if len > 0 => {
                if len >= DATA_PACKET_MIN_LEN {
                    let reading = BalanceBoardSensorRawReading {
                        top_right: i16::from_be_bytes([buf[3], buf[4]]),
                        bottom_right: i16::from_be_bytes([buf[5], buf[6]]),
                        top_left: i16::from_be_bytes([buf[7], buf[8]]),
                        bottom_left: i16::from_be_bytes([buf[9], buf[10]]),
                    };

                    if update_tare {
                        update_tare = false;
                        tare_value = reading.clone();
                    }

                    let tared_reading = reading.apply_tare(&tare_value);
                    let calibrated_reading = tared_reading.calculate_weights(&calibration);

                    if let Some(tx) = &tx_channel {
                        tx.blocking_send(calibrated_reading)?;
                    }
                }
            }
            Ok(_) => { /* Timeout, continue */ }
            Err(e) => {
                eprintln!("Error reading from HID device: {}", e);
                break;
            }
        }
    }
    let _ = write_to_device(&device, &BOARD_STOP_READING);
    println!("Blocking HID loop terminated.");
    Ok(())
}

fn read_calibration_data(device: &HidDevice) -> anyhow::Result<BalanceBoardCalibrationData> {
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
    write_to_device(&device, &cmd)?;

    let mut calibration_buf = [0u8; CALIBRATION_DATA_SIZE];
    let mut bytes_read: usize = 0;

    while bytes_read < CALIBRATION_DATA_SIZE {
        let mut buf = [0u8; 32];
        let len = read_from_device(&device, &mut buf)?;

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


pub fn write_to_device(device: &HidDevice, data: &[u8]) -> HidResult<usize> {
    print!("DEVICE_WRITE: ");
    for b in data {
        print!("{:02x} ", b);
    }
    println!();
    device.write(data)
}

pub fn read_from_device(device: &HidDevice, buf: &mut [u8]) -> HidResult<usize> {
    let result = device.read_timeout(buf, 1000);

    match &result {
        Ok(len) => {
            if *len > 0 {
                /*
                print!("DEVICE_READ: ");
                for b in buf {
                    print!("{:02x} ", b);
                }
                println!();

                 */
            }
        }
        Err(e) => {
            println!("Read failed: {:?}", e);
        }
    }

    result
}

#[derive(Debug, Clone, Default)]
struct BalanceBoardSensorRawReading {
    top_right: i16,
    bottom_right: i16,
    top_left: i16,
    bottom_left: i16,
}

impl BalanceBoardSensorRawReading {
    fn apply_tare(&self, tare_offset: &BalanceBoardSensorRawReading) -> Self {
        Self {
            top_right: self.top_right.saturating_sub(tare_offset.top_right),
            bottom_right: self.bottom_right.saturating_sub(tare_offset.bottom_right),
            top_left: self.top_left.saturating_sub(tare_offset.top_left),
            bottom_left: self.bottom_left.saturating_sub(tare_offset.bottom_left),
        }
    }

    fn calculate_weights(&self, cal: &BalanceBoardCalibrationData) -> BalanceBoardCalibratedReading {
        BalanceBoardCalibratedReading {
            timestamp: Utc::now(),
            top_right: self.calculate_single_weight(self.top_right, &cal.top_right),
            bottom_right: self.calculate_single_weight(self.bottom_right, &cal.bottom_right),
            top_left: self.calculate_single_weight(self.top_left, &cal.top_left),
            bottom_left: self.calculate_single_weight(self.bottom_left, &cal.bottom_left),
        }
    }

    fn calculate_single_weight(&self, sensor_val: i16, cal_pt: &CalibrationPoint) -> f32 {
        let val_f = sensor_val as f32;
        let min_f = cal_pt.min as f32;
        let mid_f = cal_pt.mid as f32;
        let max_f = cal_pt.max as f32;

        if val_f < mid_f {
            17.0 * (val_f - min_f) / (mid_f - min_f).max(1.0)
        } else {
            17.0 + 17.0 * (val_f - mid_f) / (max_f - mid_f).max(1.0)
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
    fn from_bytes(buf: [u8; 32]) -> anyhow::Result<Self> {
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