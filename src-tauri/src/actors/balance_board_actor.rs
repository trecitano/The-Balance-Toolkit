 use anyhow::{anyhow, Result};
use chrono::Utc;
use hidapi::{HidApi, HidDevice};
use lsl::{ChannelFormat, Pushable};
use std::thread;
use tokio::fs::OpenOptions;
use tokio::io::AsyncWriteExt;
use tokio::net::TcpStream;
use tokio::sync::broadcast;
use tokio::sync::mpsc;
use tokio::task;

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
const BOARD_STOP_READING: [u8; 3] = [HID_INTERFACE_DATA_REPORTING, 0x00, 0x00];

// Board primitives
#[derive(Debug, Clone)]
pub enum BoardAction {
    Tare,
    TurnOnLed,
    TurnOffLed,
    StartRecording {
        settings: BalanceBoardSessionSettings
    },
    StopRecording,
}

pub enum BalanceBoardCommands {
    TurnOnLed,
    TurnOffLed,
    StartRecording,
    FinishRecording
}

#[derive(Clone, Debug)]
pub struct BalanceBoardSessionSettings {
    pub output_file: Option<String>,
    pub output_channel: Option<mpsc::Sender<ProcessedBoardData>>,
    pub lsl_connection: Option<LslConnectionSettings>,
    pub tcp_connection_string: Option<String>,
}

#[derive(Clone, Debug)]
pub struct LslConnectionSettings {
    stream_name: String,
    stream_type: String,
    channel_count: u32,
    nominal_srate: f64,
    channel_format: ChannelFormat,
    source_id: String,
}

pub struct BalanceBoardConnection {
    device: HidDevice,
    action_rx: mpsc::Receiver<BoardAction>
}

impl BalanceBoardConnection {
    pub fn new(serial_number: &str, action_rx: mpsc::Receiver<BoardAction>) -> Result<Self> {
        let api = HidApi::new()?;
        // The serial number of a nintendo balance board is the string version of a mac address.
        // If the mac address is "00:23:31:87:B1:16", its serial number is "00233187B116".
        println!("Look for {}", serial_number);
        let balance_board_info = api
            .device_list()
            .find(|device| {
                println!("Device: {:?}", device.serial_number());
                if let Some(hid_serial_number) = device.serial_number() {
                    hid_serial_number == serial_number
                } else {
                    false
                }
            })
            .ok_or(anyhow!("Device with the specified device_id was not found."))?;

        let device = balance_board_info.open_device(&api)?;
        println!("Successfully opened HID connection for {}.", serial_number);

        device.write(&BOARD_TURN_ON_LED)?;

        Ok(Self {
            device,
            action_rx,
        })
    }

    pub async fn run(mut self) -> Result<()> {
        println!("Board connection task started.");
        let device = self.device;

        let (hid_control_tx, hid_control_rx) = mpsc::channel(10);
        let (hid_data_tx, mut hid_data_rx) = mpsc::channel(10);

        // Since HIDAPI is blocking, we need to run the core device loop in a blocking thread.
        let hid_thread = thread::spawn(move || {
            Self::blocking_hid_loop(device, hid_control_rx, hid_data_tx)
        });

        let mut session: Option<SessionHandles> = None;

        loop {
            println!("Session state: {:?}", session);
            tokio::select! {
                // Received an action from the manager
                Some(action) = self.action_rx.recv() => {
                    match action {
                        BoardAction::Tare => {
                            // TODO
                            //hid_control_tx.send(BalanceBoardCommands::Tare).await?;
                        }
                        BoardAction::TurnOnLed => {
                            hid_control_tx.send(BalanceBoardCommands::TurnOnLed).await?;
                        },
                        BoardAction::TurnOffLed => {
                            hid_control_tx.send(BalanceBoardCommands::TurnOffLed).await?;
                        },
                        BoardAction::StartRecording { settings } => {
                            session = Some(Self::start_session(settings)?);
                            println!("Starting recording session with following sessions: {:?}", session);
                            hid_control_tx.send(BalanceBoardCommands::StartRecording).await?;
                        },
                        BoardAction::StopRecording => {
                            println!("Stopping the recording");
                            session = None;
                            hid_control_tx.send(BalanceBoardCommands::FinishRecording).await?;
                        },
                    }
                },

                // Received data from the HID thread
                Some(data) = hid_data_rx.recv() => {
                    // If there's a session, we forward the data to it.
                    if let Some(session) = &mut session {
                        session.receiver_channel.send(data).await?;
                    }
                },
                else => {
                    // Channels closed
                    break;
                }
            }
        }

        // Wait for the HID thread to finish.
        let _ = hid_thread.join();
        println!("Board connection task finished.");
        Ok(())
    }

    fn blocking_hid_loop(
        device: HidDevice,
        mut hid_control_rx: mpsc::Receiver<BalanceBoardCommands>,
        hid_data_tx: mpsc::Sender<BalanceBoardSensorReading>,
    ) -> Result<()> {
        let mut buf = [0u8; 32];
        let calibration = Self::read_calibration_data(&device)?;

        loop {
            match hid_control_rx.try_recv() {
                Ok(command) => match command {
                    BalanceBoardCommands::TurnOnLed => { device.write(&BOARD_TURN_ON_LED)?; }
                    BalanceBoardCommands::TurnOffLed => { device.write(&BOARD_TURN_OFF_LED)?; }
                    BalanceBoardCommands::StartRecording => { device.write(&BOARD_START_READING)?; },
                    BalanceBoardCommands::FinishRecording => { device.write(&BOARD_STOP_READING)?; },
                },
                Err(mpsc::error::TryRecvError::Empty) => { /* No command, continue */ },
                Err(mpsc::error::TryRecvError::Disconnected) => {
                    // The async part has shut down. We must exit.
                    println!("HID Loop: Control channel disconnected. Shutting down.");
                    break;
                }
            }

            match device.read_timeout(&mut buf, 100) {
                Ok(len) if len > 0 => {
                    if len >= DATA_PACKET_MIN_LEN {
                        println!("Got reading! {:?}", buf);
                        let reading = BalanceBoardSensorRawReading {
                            top_right: i16::from_be_bytes([buf[3], buf[4]]),
                            bottom_right: i16::from_be_bytes([buf[5], buf[6]]),
                            top_left: i16::from_be_bytes([buf[7], buf[8]]),
                            bottom_left: i16::from_be_bytes([buf[9], buf[10]]),
                        };

                        let calibrated_reading = reading.calculate_weights(&calibration);

                        //let tared_reading = reading.apply_tare(&tare_offset);
                        //let weights = tared_reading.calculate_weights(&calibration);

                        if hid_data_tx.blocking_send(calibrated_reading).is_err() {
                            // Main task has disconnected, shut down.
                            break;
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
        let _ = device.write(&BOARD_STOP_READING);
        println!("Blocking HID loop terminated.");
        Ok(())
    }

    fn start_session(settings: BalanceBoardSessionSettings) -> Result<SessionHandles> {
        let mut thread_handles: Vec<thread::JoinHandle<Result<()>>> = vec!();
        let mut task_handles: Vec<task::JoinHandle<Result<()>>> = vec!();

        let (processed_data_tx, _) = broadcast::channel::<ProcessedBoardData>(100);

        if let Some(output_file) = settings.output_file {
            let file_sender = processed_data_tx.clone();
            let handle = tokio::spawn(async move {
                let rx = file_sender.subscribe();
                Self::file_write_loop(rx, output_file).await
            });
            task_handles.push(handle);
        }

        if let Some(lsl_connection) = settings.lsl_connection {
            let lsl_sender = processed_data_tx.clone();
            let handle = thread::spawn(move || {
                let rx = lsl_sender.subscribe();
                Self::lsl_stream_loop(rx, lsl_connection)
            });
            thread_handles.push(handle);
        }

        if let Some(tcp_connection_string) = settings.tcp_connection_string {
            let tcp_sender = processed_data_tx.clone();
            let handle = tokio::spawn(async move {
                let rx = tcp_sender.subscribe();
                Self::tcp_stream_loop(rx, tcp_connection_string).await
            });
            task_handles.push(handle);
        };

        let (data_process_tx, data_process_rx) = mpsc::channel(100);
        let handle = tokio::spawn(async move {
            Self::data_process_loop(data_process_rx, processed_data_tx).await
        });
        task_handles.push(handle);

        Ok(SessionHandles { thread_handles, task_handles, receiver_channel: data_process_tx })
    }

    async fn data_process_loop(
        mut rx: mpsc::Receiver<BalanceBoardSensorReading>,
        tx: broadcast::Sender<ProcessedBoardData>,
    ) -> Result<()> {
        println!("Starting Data Process!");
        loop {
            match rx.recv().await {
                Some(data) => {
                    let timestamp = Utc::now();
                    let reading: [f32; 4] = [
                        data.top_right,
                        data.bottom_right,
                        data.top_left,
                        data.bottom_left,
                    ];

                    if tx.send(ProcessedBoardData { timestamp, reading} ).is_err() {
                        break; // Receiver has disconnected
                    }
                }
                None => break
            }
        }
        println!("Data processing loop terminated.");
        Ok(())
    }

    async fn file_write_loop(mut rx: broadcast::Receiver<ProcessedBoardData>, output_file: String) -> Result<()> {
        let mut file = OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(true)
            .open(output_file)
            .await?;

        // Write CSV header
        file.write_all(b"timestamp,top_right,bottom_right,top_left,bottom_left\n").await?;

        // Process incoming data
        loop {
            match rx.recv().await {
                Ok(data) => {
                    // Format data as CSV row
                    let csv_line = format!(
                        "{},{},{},{},{}\n",
                        data.timestamp.to_rfc3339(),
                        data.reading[0],  // top_right
                        data.reading[1],  // bottom_right
                        data.reading[2],  // top_left
                        data.reading[3]   // bottom_left
                    );

                    // Write and flush
                    file.write_all(csv_line.as_bytes()).await?;
                    file.flush().await?;
                }
                Err(broadcast::error::RecvError::Closed) => {
                    // Channel closed, exit gracefully
                    break;
                }
                Err(broadcast::error::RecvError::Lagged(_)) => {
                    // We've missed some messages due to slow file writing
                    eprintln!("Warning: File writing lagged behind data stream");
                    continue;
                }
            }
        }

        println!("File writing loop terminated.");
        Ok(())
    }

    fn lsl_stream_loop(mut lsl_data_rx: broadcast::Receiver<ProcessedBoardData>, settings: LslConnectionSettings) -> Result<()> {
        let info = lsl::StreamInfo::new(
            settings.stream_name.as_str(),
            settings.stream_type.as_str(),
            settings.channel_count,
            settings.nominal_srate,
            ChannelFormat::Double64,
            "The-Balance-Toolkit"
        )?;
        let outlet = lsl::StreamOutlet::new(&info, 0, 360)?;

        while let Ok(data) = lsl_data_rx.blocking_recv() {
            let byte_array = data.to_byte_array();
            let byte_slices: Vec<&[u8]> = vec![&byte_array];
            outlet.push_sample(&byte_slices)?;
        }

        Ok(())
    }

    async fn tcp_stream_loop(mut tcp_data_rx: broadcast::Receiver<ProcessedBoardData>, tcp_connection_string: String) -> Result<()> {
        let mut stream = TcpStream::connect(tcp_connection_string).await?;

        while let Ok(data) = tcp_data_rx.recv().await {
            stream.write_all(&data.to_byte_array()).await?
        }
        Ok(())
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

 #[derive(Debug)]
struct SessionHandles {
    thread_handles: Vec<thread::JoinHandle<Result<()>>>,
    task_handles: Vec<task::JoinHandle<Result<()>>>,
    receiver_channel: mpsc::Sender<BalanceBoardSensorReading>,
}

// --- Data Structures for Balance Board Readings ---

#[derive(Debug, Clone, Default)]
struct BalanceBoardSensorRawReading {
    top_right: i16,
    bottom_right: i16,
    top_left: i16,
    bottom_left: i16,
}

struct BalanceBoardSensorReading {
    top_right: f32,
    bottom_right: f32,
    top_left: f32,
    bottom_left: f32,
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

    fn calculate_weights(&self, cal: &BalanceBoardCalibrationData) -> BalanceBoardSensorReading {
        BalanceBoardSensorReading {
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

#[derive(Debug, Clone, Copy)]
pub struct ProcessedBoardData {
    timestamp: chrono::DateTime<Utc>,
    reading: [f32; 4],
}

impl ProcessedBoardData {
    pub fn to_byte_array(&self) -> [u8; 24] {
        let mut buf = [0u8; 24];

        // 1. Serialize the timestamp (8 bytes)
        let timestamp_nanos = self.timestamp.timestamp_nanos_opt().unwrap_or(0);
        buf[0..8].copy_from_slice(&timestamp_nanos.to_be_bytes());

        // 2. Serialize the f32 readings (16 bytes)
        let mut offset = 8;
        for &value in self.reading.iter() {
            buf[offset..offset + 4].copy_from_slice(&value.to_be_bytes());
            offset += 4;
        }

        buf
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