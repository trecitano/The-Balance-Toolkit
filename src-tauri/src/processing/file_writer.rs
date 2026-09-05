use crate::actors::balance_board_actor::BalanceBoardOutput;
use crate::actors::state::activities::Activity;
use crate::actors::toolkit_service::CoreSessionConfiguration;
use crate::file_system::ExistingSessionFileSystem;
use crate::processing::data_processor::InterpolationSetting;
use crate::types::{MacAddress, User};
use crate::utils;
use anyhow::Result;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io;
use std::path::PathBuf;
use std::time::Duration;
use tokio::fs::{File, OpenOptions};
use tokio::io::{AsyncWriteExt, BufWriter};
use tokio::sync::mpsc;
use tokio::sync::mpsc::{Receiver, Sender};
use tokio::time::Instant;

pub fn initialize(
    session_configuration: CoreSessionConfiguration,
    device_names: HashMap<MacAddress, String>,
    observe_raw_data: bool,
    observe_processed_data: bool,
) -> Sender<BalanceBoardOutput> {
    let (tx, rx) = mpsc::channel(1000);

    tokio::spawn(async move {
        if let Err(e) = main_file_writer_loop(
            rx,
            device_names,
            session_configuration,
            observe_raw_data,
            observe_processed_data,
        )
        .await
        {
            eprintln!("Error in file writer: {:?}", e);
        }
    });

    tx
}

async fn main_file_writer_loop(
    mut rx_param: Receiver<BalanceBoardOutput>,
    device_names: HashMap<MacAddress, String>,
    session_configuration: CoreSessionConfiguration,
    observe_raw_data: bool,
    observe_processed_data: bool,
) -> Result<()> {
    let mut device_tx_map = HashMap::new();
    let mut join_handles = Vec::new();

    let session_id = Utc::now().format("tbt-%Y-%m-%dT%H-%M-%S").to_string();
    let device_file_mapping = create_device_file_name_mapping(&device_names, &session_id);

    write_session_settings_to_disk(
        &session_configuration,
        &SessionStats::default(),
        &device_names,
        &device_file_mapping,
        &session_id,
    )
    .await?;

    for device_mac in device_names.keys() {
        let (tx, rx) = mpsc::channel(1000);
        let output_directory = session_configuration.output_directory.clone();
        let device_file_mapping = device_file_mapping.get(device_mac).unwrap().clone();

        device_tx_map.insert(device_mac, tx);

        println!("Starting file writer for device: {}", device_mac);

        let handle = tokio::spawn(async move {
            file_write_loop(
                rx,
                output_directory,
                device_file_mapping,
                observe_raw_data,
                observe_processed_data,
            )
            .await
            .unwrap()
        });
        join_handles.push(handle);
    }

    while let Some(data) = rx_param.recv().await {
        let mac_address = data.mac_address();
        if let Some(tx) = device_tx_map.get_mut(&mac_address) {
            tx.send(data).await?
        }
    }

    println!("File writer stopped receiving events, waiting for child tasks to complete.");
    // Drop the child file writer channels
    device_tx_map.clear();
    let mut first_device_metrics = SessionStats::default();
    for handle in join_handles {
        match handle.await {
            Ok(stats) => {
                first_device_metrics = stats;
            }
            _ => eprintln!("File writer failed."),
        }
    }

    // Update the session settings file with the session data.
    write_session_settings_to_disk(
        &session_configuration,
        &first_device_metrics,
        &device_names,
        &device_file_mapping,
        &session_id,
    )
    .await?;

    println!("Main File writer execution complete.");

    Ok(())
}

fn create_device_file_name_mapping(
    device_name_mapping: &HashMap<MacAddress, String>,
    session_id: &str,
) -> HashMap<MacAddress, FileNameMapping> {
    device_name_mapping.iter().map(|(mac_address, device_name) | {
        let device_name_without_spaces = device_name.replace(" ", "_");
        let file_readable_mac_address = utils::mac_address_human_name(*mac_address).replace(":", "");
        (*mac_address, FileNameMapping {
            raw_file_name: format!("{session_id}-{device_name_without_spaces}-{file_readable_mac_address}-raw.csv"),
            processed_file_name: format!("{session_id}-{device_name_without_spaces}-{file_readable_mac_address}-processed.csv")
        })
    }).collect()
}

#[derive(Serialize)]
pub struct SessionConfigurationFileFormatRef<'a> {
    pub user: &'a User,
    pub window_size_ms: u64,
    pub window_slide_ms: u64,
    pub sampling_rate: u64,
    pub interpolation: &'a InterpolationSetting,
    pub device_names: &'a HashMap<MacAddress, String>,
    pub device_file_mappings: &'a HashMap<MacAddress, FileNameMapping>,
    pub activity: &'a Option<Activity>,
    pub session_stats: &'a SessionStats,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SessionConfigurationFileFormat {
    pub user: User,
    pub window_size_ms: u64,
    pub window_slide_ms: u64,
    pub sampling_rate: u64,
    pub interpolation: InterpolationSetting,
    pub device_names: HashMap<MacAddress, String>,
    pub device_file_mappings: HashMap<MacAddress, FileNameMapping>,
    pub activity: Option<Activity>,
    pub session_stats: SessionStats,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct SessionStats {
    board_sampling_rate: f64,
    pub duration: Duration,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FileNameMapping {
    pub raw_file_name: String,
    pub processed_file_name: String,
}

async fn write_session_settings_to_disk(
    session_configuration: &CoreSessionConfiguration,
    session_stats: &SessionStats,
    device_names: &HashMap<MacAddress, String>,
    device_file_mappings: &HashMap<MacAddress, FileNameMapping>,
    session_id: &str,
) -> Result<()> {
    let data = SessionConfigurationFileFormatRef {
        user: &session_configuration.user,
        window_size_ms: session_configuration.window_size_ms,
        window_slide_ms: session_configuration.window_slide_ms,
        sampling_rate: session_configuration.sampling_rate,
        interpolation: &session_configuration.interpolation,
        device_names,
        device_file_mappings,
        activity: &session_configuration.activity,
        session_stats,
    };
    let path = session_configuration.output_directory.clone();
    let file_path = path.join(format!("{session_id}.settings.json"));
    ExistingSessionFileSystem::save(file_path.as_path(), &data)?;
    Ok(())
}

/// How often buffered CSV rows are flushed to disk. Bounds the data lost on a crash
/// (the release profile aborts on panic) without paying a syscall per sample.
const FLUSH_INTERVAL: Duration = Duration::from_millis(250);

async fn file_write_loop(
    mut rx: Receiver<BalanceBoardOutput>,
    output_directory: PathBuf,
    file_mapping: FileNameMapping,
    observe_raw_data: bool,
    observe_processed_data: bool,
) -> Result<SessionStats> {
    let start = Instant::now();
    let mut raw_events_written: usize = 0;

    // Create a file to optionally store the raw values;
    let mut raw_values_file = if observe_raw_data {
        let file_path = output_directory.join(&file_mapping.raw_file_name);
        println!("WRITING TO RAW FILE ${:?}", file_path);
        let mut file = BufWriter::new(create_file(file_path).await?);
        file.write_all(b"timestamp,top_right,bottom_right,top_left,bottom_left\n")
            .await?;
        Some(file)
    } else {
        None
    };

    // Create a file to optionally store the processed values;
    let mut processed_values_file = if observe_processed_data {
        let file_path = output_directory.join(&file_mapping.processed_file_name);
        let mut file = BufWriter::new(create_file(file_path).await?);
        file.write_all(b"timestamp,vcopx,vcopy,stability_index,mlsi,apsi,vsi,dpsi\n")
            .await?;
        Some(file)
    } else {
        None
    };

    let mut flush_interval = tokio::time::interval(FLUSH_INTERVAL);
    flush_interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);

    loop {
        tokio::select! {
            received = rx.recv() => {
                let Some(data) = received else { break };
                match data {
                    BalanceBoardOutput::Raw(data) => {
                        if let Some(ref mut file) = raw_values_file {
                            raw_events_written += 1;
                            let csv_line = format!(
                                "{},{},{},{},{}\n",
                                data.timestamp
                                    .to_rfc3339_opts(chrono::SecondsFormat::Micros, true),
                                data.top_right,
                                data.bottom_right,
                                data.top_left,
                                data.bottom_left
                            );

                            file.write_all(csv_line.as_bytes()).await?;
                        }
                    }
                    BalanceBoardOutput::Processed(data) => {
                        if let Some(ref mut file) = processed_values_file {
                            let csv_line = format!(
                                "{},{},{},{},{},{},{},{}\n",
                                data.timestamp
                                    .to_rfc3339_opts(chrono::SecondsFormat::Micros, true),
                                data.sway_metrics
                                    .as_ref()
                                    .map_or(String::new(), |v| v.v_cop_x.to_string()),
                                data.sway_metrics
                                    .as_ref()
                                    .map_or(String::new(), |v| v.v_cop_y.to_string()),
                                data.stability_index
                                    .as_ref()
                                    .map_or(String::new(), |v| v.to_string()),
                                data.dpsi_metrics
                                    .as_ref()
                                    .map_or(String::new(), |d| d.mlsi.to_string()),
                                data.dpsi_metrics
                                    .as_ref()
                                    .map_or(String::new(), |d| d.apsi.to_string()),
                                data.dpsi_metrics
                                    .as_ref()
                                    .map_or(String::new(), |d| d.vsi.to_string()),
                                data.dpsi_metrics
                                    .as_ref()
                                    .map_or(String::new(), |d| d.dpsi.to_string()),
                            );

                            file.write_all(csv_line.as_bytes()).await?;
                        }
                    }
                }
            }
            _ = flush_interval.tick() => {
                if let Some(ref mut file) = raw_values_file {
                    file.flush().await?;
                }
                if let Some(ref mut file) = processed_values_file {
                    file.flush().await?;
                }
            }
        }
    }

    // Push whatever is still buffered before reporting completion.
    if let Some(ref mut file) = raw_values_file {
        file.flush().await?;
    }
    if let Some(ref mut file) = processed_values_file {
        file.flush().await?;
    }

    let duration = start.elapsed();
    println!("File writer execution complete.");
    Ok(SessionStats {
        board_sampling_rate: raw_events_written as f64 / duration.as_secs_f64(),
        duration,
    })
}

async fn create_file(output_path: PathBuf) -> io::Result<File> {
    OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .open(output_path.to_str().unwrap())
        .await
}
