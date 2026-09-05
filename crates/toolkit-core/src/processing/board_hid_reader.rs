use crate::actors::balance_board_actor::{BalanceBoardCalibratedReading, BalanceBoardCommands};
use crate::types::MacAddress;
use anyhow::{Result, anyhow};
use chrono::Utc;
use hidapi::HidError::HidApiError;
use hidapi::{HidApi, HidDevice, HidResult};
use std::thread;
use std::time::Duration;
use tokio::sync::mpsc;
use tokio::sync::mpsc::Sender;

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

pub fn initialize(mac_address: MacAddress) -> Result<Sender<BalanceBoardCommands>> {
    let (tx, rx) = mpsc::channel(100);

    let device = connect_via_hid(mac_address)?;

    thread::spawn(move || blocking_hid_loop(device, mac_address, rx));

    Ok(tx)
}

/// Opens and returns (to hold open) the hid-wiimote balance-board input node
/// for `mac`, so the kernel keeps the board in report mode 0x34. We never read
/// from it; the open() side effect is the entire point. Best-effort: returns
/// None (with a warning) if the node can't be found/opened, in which case the
/// original ~30s reset behaviour remains.
fn hold_driver_extension_open(mac: MacAddress) -> Option<std::fs::File> {
    // Only meaningful on Linux (the hid-wiimote driver + sysfs layout). Bail
    // cheaply elsewhere so non-Linux doesn't run the retry loop or warn.
    if !cfg!(target_os = "linux") {
        return None;
    }
    let want = format!("{:012x}", mac);

    // The input node is created during hid-wiimote probe (~same time as
    // hidraw), but allow for a brief device-ordering race.
    for attempt in 0..10 {
        if let Some(path) = find_board_event_node(&want) {
            return match std::fs::File::open(&path) {
                Ok(file) => {
                    log::info!("Holding {path} open so hid-wiimote keeps DRM at 0x34 (KEE).");
                    Some(file)
                }
                Err(e) => {
                    log::error!("Could not open {path} ({e}); 30s-reset mitigation inactive.");
                    None
                }
            };
        }
        if attempt < 9 {
            thread::sleep(Duration::from_millis(100));
        }
    }
    log::error!(
        "WARNING: balance-board input node for {want} not found; hid-wiimote will \
         keep resetting the report mode every ~30s (recording still works between resets)."
    );
    None
}

/// Walks sysfs to find the `/dev/input/eventN` belonging to the balance board
/// whose HID device's `HID_UNIQ` matches `want_norm` (lowercase hex MAC, no
/// separators). Returns the device-node path. Defensive: skips unreadable
/// entries rather than aborting the whole search.
fn find_board_event_node(want_norm: &str) -> Option<String> {
    const BOARD_INPUT_NAME: &str = "Nintendo Wii Remote Balance Board";
    let normalize = |s: &str| -> String {
        s.chars()
            .filter(|c| c.is_ascii_hexdigit())
            .flat_map(|c| c.to_lowercase())
            .collect()
    };

    for hid in std::fs::read_dir("/sys/bus/hid/devices").ok()?.flatten() {
        let hid_dir = hid.path();
        let Ok(uevent) = std::fs::read_to_string(hid_dir.join("uevent")) else {
            continue;
        };
        let mac_matches = uevent
            .lines()
            .find_map(|l| l.strip_prefix("HID_UNIQ="))
            .is_some_and(|u| normalize(u) == want_norm);
        if !mac_matches {
            continue;
        }
        let Ok(inputs) = std::fs::read_dir(hid_dir.join("input")) else {
            continue;
        };
        for input in inputs.flatten() {
            let idir = input.path();
            let name = std::fs::read_to_string(idir.join("name")).unwrap_or_default();
            if name.trim() != BOARD_INPUT_NAME {
                continue;
            }
            let Ok(children) = std::fs::read_dir(&idir) else {
                continue;
            };
            for child in children.flatten() {
                let fname = child.file_name();
                let fname = fname.to_string_lossy();
                if let Some(num) = fname.strip_prefix("event")
                    && !num.is_empty()
                    && num.bytes().all(|b| b.is_ascii_digit())
                {
                    return Some(format!("/dev/input/{fname}"));
                }
            }
        }
    }
    None
}

fn connect_via_hid(mac_address: MacAddress) -> HidResult<HidDevice> {
    let api = HidApi::new()?;

    // The serial number of a nintendo balance board is the string version of a mac address.
    // If the mac address is "00:23:31:87:B1:16", its serial number is "00233187B116".
    // Note: We must convert the mac address from u64 to the serial number format.
    let serial_number = format!("{:012x}", mac_address);
    log::debug!(
        "Looking for HID serial {serial_number} among {:?}",
        api.device_list()
            .map(|device| device.serial_number().unwrap_or(""))
            .collect::<Vec<_>>()
    );
    let normalized_serial = serial_number.replace(":", "").to_lowercase();
    let balance_board_info = api
        .device_list()
        .find(|device| {
            device
                .serial_number()
                .is_some_and(|s| s.replace(":", "").to_lowercase() == normalized_serial)
        })
        .ok_or(HidApiError {
            message: format!(
                "Device with the specified device_id was not found. {}",
                serial_number
            ),
        })?;
    balance_board_info.open_device(&api)
}

fn blocking_hid_loop(
    device: HidDevice,
    mac_address: MacAddress,
    mut hid_control_rx: mpsc::Receiver<BalanceBoardCommands>,
) -> anyhow::Result<()> {
    let mut buf = [0u8; 32];

    // On Linux the in-kernel hid-wiimote driver re-applies its own data-report
    // mode after every ~30s UPower battery-poll status report. Unless it thinks
    // the extension is "in use" it resets the board to mode 0x30 (buttons-only)
    // and kills our 0x34 hidraw stream. Opening (and merely holding open, never
    // reading) the driver's balance-board input node runs wiimod_bboard_open()
    // in the kernel -> sets WIIPROTO_FLAG_EXT_USED -> select_drm() returns
    // DRM_KEE (report 0x34), which the driver then re-applies after each status
    // report. Bound here so the fd is held for the whole life of this loop;
    // no-op (None) on non-Linux.
    let _ext_keepalive = hold_driver_extension_open(mac_address);

    write_to_device(&device, &BOARD_TURN_ON_LED)?;
    let calibration = read_calibration_data(&device)?;
    let mut tx_channel: Option<mpsc::Sender<BalanceBoardCalibratedReading>> = None;
    // By default, we use an empty tare value.
    // If the user wants to tare, then in the next balance board reading, the tare_value is updated.
    let mut update_tare = false;
    let mut tare_value: BalanceBoardCalibratedReading = BalanceBoardCalibratedReading::default();

    loop {
        // While recording, the blocking device read below paces this loop, so commands are
        // only polled. While idle there is nothing to read from the board, so block on the
        // control channel instead of spinning on `try_recv` at 100% of a core.
        let command = if tx_channel.is_some() {
            match hid_control_rx.try_recv() {
                Ok(command) => Some(command),
                Err(mpsc::error::TryRecvError::Empty) => None,
                Err(mpsc::error::TryRecvError::Disconnected) => {
                    // The async part has shut down. We must exit.
                    log::info!("HID Loop: Control channel disconnected. Shutting down.");
                    break;
                }
            }
        } else {
            match hid_control_rx.blocking_recv() {
                Some(command) => Some(command),
                None => {
                    log::info!("HID Loop: Control channel disconnected. Shutting down.");
                    break;
                }
            }
        };

        if let Some(command) = command {
            log::debug!("HID loop: got command {:?}", command);
            match command {
                BalanceBoardCommands::TurnOnLed => {
                    write_to_device(&device, &BOARD_TURN_ON_LED)?;
                }
                BalanceBoardCommands::TurnOffLed => {
                    write_to_device(&device, &BOARD_TURN_OFF_LED)?;
                }
                BalanceBoardCommands::ApplyTare => {
                    update_tare = true;
                }
                BalanceBoardCommands::StartRecording(tx) => {
                    tx_channel = Some(tx);
                    write_to_device(&device, &BOARD_START_READING)?;
                }
                BalanceBoardCommands::FinishRecording => {
                    tx_channel = None;
                    write_to_device(&device, &BOARD_STOP_READING)?;
                }
            }
        }

        // If there is a listener, then read data from the balance board
        if let Some(tx) = &tx_channel {
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
                            tare_value =
                                reading.clone().calculate_weights(&calibration, mac_address);
                        }

                        let calibrated_reading =
                            reading.calculate_weights(&calibration, mac_address);
                        let tared_reading = calibrated_reading.apply_tare(&tare_value);

                        tx.blocking_send(tared_reading)?;
                    }
                }
                Ok(_) => {
                    // Read timeout with no data; keep polling.
                    log::debug!("HID read timed out without data");
                }
                Err(e) => {
                    log::error!("Error reading from HID device: {}", e);
                    break;
                }
            }
        }
    }
    let _ = write_to_device(&device, &BOARD_STOP_READING);
    log::info!("Blocking HID loop terminated.");
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
    write_to_device(device, &cmd)?;

    let mut calibration_buf = [0u8; CALIBRATION_DATA_SIZE];
    let mut bytes_read: usize = 0;

    while bytes_read < CALIBRATION_DATA_SIZE {
        let mut buf = [0u8; 32];
        let len = read_from_device(device, &mut buf)?;

        if len == 0 {
            return Err(anyhow!("Timeout reading calibration data."));
        }
        // We ignore everything that isn't what we want.
        // When we send a request for this specific data, we receive a data reading through
        // Input Report 0x21
        if buf[0] != DATA_REPORT_READ_EVENT {
            continue;
        }

        log::debug!("Calibration packet: {}", hex_dump(&buf));

        let packet_data_size = ((buf[3] >> 4) + 1) as usize;
        let error_code = buf[3] & 0x0F;

        if error_code != 0 {
            return Err(anyhow!("Error reading board memory: code {}", error_code));
        }
        if bytes_read + packet_data_size > CALIBRATION_DATA_SIZE {
            return Err(anyhow!("Calibration data overflow."));
        }

        let data_chunk = &buf[6..(6 + packet_data_size)];
        calibration_buf[bytes_read..(bytes_read + packet_data_size)].copy_from_slice(data_chunk);
        bytes_read += packet_data_size;

        if bytes_read == CALIBRATION_DATA_SIZE {
            break;
        }
    }

    BalanceBoardCalibrationData::from_bytes(calibration_buf)
}

fn hex_dump(bytes: &[u8]) -> String {
    bytes
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect::<Vec<_>>()
        .join(" ")
}

pub fn write_to_device(device: &HidDevice, data: &[u8]) -> HidResult<usize> {
    log::debug!("DEVICE_WRITE: {}", hex_dump(data));
    device.write(data)
}

pub fn read_from_device(device: &HidDevice, buf: &mut [u8]) -> HidResult<usize> {
    let result = device.read_timeout(buf, 500);
    if let Err(e) = &result {
        log::warn!("HID read failed: {:?}", e);
    }
    result
}

#[derive(Debug, Clone)]
struct BalanceBoardSensorRawReading {
    top_right: i16,
    bottom_right: i16,
    top_left: i16,
    bottom_left: i16,
}

impl BalanceBoardSensorRawReading {
    fn calculate_weights(
        &self,
        cal: &BalanceBoardCalibrationData,
        mac_address: MacAddress,
    ) -> BalanceBoardCalibratedReading {
        BalanceBoardCalibratedReading {
            timestamp: Utc::now(),
            mac_address,
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
