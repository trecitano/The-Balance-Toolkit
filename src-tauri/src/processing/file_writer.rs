use crate::actors::balance_board_actor::BalanceBoardOutput;
use crate::actors::toolkit_service::{SessionConfiguration, CoreSessionConfiguration};
use crate::file_system::{DeviceFileSystem, ExistingSessionFileSystem};
use crate::types::MacAddress;
use crate::utils;
use anyhow::Result;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::io;
use std::path::PathBuf;
use tokio::fs::{File, OpenOptions};
use tokio::io::AsyncWriteExt;
use tokio::sync::mpsc;
use tokio::sync::mpsc::{Receiver, Sender};
use crate::actors::state::activities::Activity;
use crate::processing::data_processor::InterpolationSetting;

pub fn initialize(session_configuration: CoreSessionConfiguration,
                  device_names: HashMap<MacAddress, String>,
                  observe_raw_data: bool,
                  observe_processed_data: bool) -> Sender<BalanceBoardOutput> {

    let (tx, rx) = mpsc::channel(1000);
    
    tokio::spawn(async move {
        if let Err(e) = main_file_writer_loop(rx,
                                              device_names,
                                              session_configuration,
                                              observe_raw_data,
                                              observe_processed_data
        ).await {
            eprintln!("Error in file writer: {:?}", e);
        }
    });

    tx
}

async fn main_file_writer_loop(mut rx_param: Receiver<BalanceBoardOutput>,
                               device_names: HashMap<MacAddress, String>,
                               session_configuration: CoreSessionConfiguration,
                               observe_raw_data: bool,
                               observe_processed_data: bool) -> Result<()> {

    // write settings to file
    let mut device_tx_map = HashMap::new();

    let session_id = Utc::now().format("tbt-%Y-%m-%dT%H-%M-%S").to_string();
    let device_file_mapping = create_device_file_name_mapping(&device_names, &session_id);

    write_session_settings_to_disk(&session_configuration, &device_names, &device_file_mapping, &session_id).await?;

    for device_mac in device_names.keys() {
        let (tx, rx) = mpsc::channel(1000);
        let output_directory = session_configuration.output_directory.clone();
        let device_file_mapping = device_file_mapping.get(&device_mac).unwrap().clone();

        device_tx_map.insert(device_mac, tx);

        println!("Starting file writer for device: {}", device_mac);

        tokio::spawn(async move {
            file_write_loop(rx,
                            output_directory,
                            device_file_mapping,
                            observe_raw_data,
                            observe_processed_data).await.unwrap();
        });
    }

    while let Some(data) = rx_param.recv().await {
        let mac_address = data.mac_address();
        if let Some(tx) = device_tx_map.get_mut(&mac_address) { tx.send(data).await? }
    }

    println!("Main File writer execution complete.");

    Ok(())
}

fn create_device_file_name_mapping(device_name_mapping: &HashMap<MacAddress, String>, session_id: &str) -> HashMap<MacAddress, FileNameMapping> {
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
    pub selected_user: &'a str,
    pub window_size_ms: u64,
    pub window_slide_ms: u64,
    pub sampling_rate: u64,
    pub interpolation: &'a InterpolationSetting,
    pub device_names: &'a HashMap<MacAddress, String>,
    pub device_file_mappings: &'a HashMap<MacAddress, FileNameMapping>,
    pub activity: &'a Option<Activity>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SessionConfigurationFileFormat {
    pub selected_user: String,
    pub window_size_ms: u64,
    pub window_slide_ms: u64,
    pub sampling_rate: u64,
    pub interpolation: InterpolationSetting,
    pub device_names: HashMap<MacAddress, String>,
    pub device_file_mappings: HashMap<MacAddress, FileNameMapping>,
    pub activity: Option<Activity>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FileNameMapping {
    pub raw_file_name: String,
    pub processed_file_name: String
}

async fn write_session_settings_to_disk(session_configuration: &CoreSessionConfiguration,
                                        device_names: &HashMap<MacAddress, String>,
                                        device_file_mappings: &HashMap<MacAddress, FileNameMapping>,
                                        session_id: &str) -> Result<()> {
    let data = SessionConfigurationFileFormatRef {
        selected_user: &session_configuration.selected_user,
        window_size_ms: session_configuration.window_size_ms,
        window_slide_ms: session_configuration.window_slide_ms,
        sampling_rate: session_configuration.sampling_rate,
        interpolation: &session_configuration.interpolation,
        device_names,
        device_file_mappings,
        activity: &None,
    };
    let path = session_configuration.output_directory.clone();
    let file_path = path.join(format!("{session_id}.settings.json"));
    ExistingSessionFileSystem::save(file_path.as_path(), &data)?;
    Ok(())
}

async fn file_write_loop(mut rx: Receiver<BalanceBoardOutput>,
                         output_directory: PathBuf,
                         file_mapping: FileNameMapping,
                         observe_raw_data: bool,
                         observe_processed_data: bool) -> Result<()> {

    // Create a file to optionally store the raw values;
    let mut raw_values_file = if observe_raw_data {
        let file_path = output_directory.join(&file_mapping.raw_file_name);
        println!("WRITING TO RAW FILE ${:?}", file_path);
        let mut file = create_file(file_path).await?;
        file.write_all(b"timestamp,top_right,bottom_right,top_left,bottom_left\n").await?;
        Some(file)
    } else {
        None
    };

    // Create a file to optionally store the processed values;
    let mut processed_values_file = if observe_processed_data {
        let file_path = output_directory.join(&file_mapping.processed_file_name);
        let mut file = create_file(file_path).await?;
        file.write_all(b"timestamp,mean_velocity,total_path_length,velocity_moment,mean_power_frequency,center_of_spectrum,frequency_total_power,dfa_alpha,jerk\n").await?;
        Some(file)
    } else {
        None
    };

    while let Some(data) = rx.recv().await {
        match data {
            BalanceBoardOutput::Raw(data) => {
                if let Some(ref mut file) = raw_values_file {
                    let csv_line = format!(
                        "{},{},{},{},{}\n",
                        data.timestamp.to_rfc3339_opts(chrono::SecondsFormat::Micros, true),
                        data.top_right,
                        data.bottom_right,
                        data.top_left,
                        data.bottom_left
                    );

                    file.write_all(csv_line.as_bytes()).await?;
                    file.flush().await?;
                }
            },
            BalanceBoardOutput::Processed(data) => {
                if let Some(ref mut file) = processed_values_file {
                    let csv_line = format!(
                        "{},{},{},{},{},{},{},{},{}\n",
                        data.timestamp.to_rfc3339_opts(chrono::SecondsFormat::Micros, true),
                        data.sway_metrics.as_ref().map_or(String::new(), |v| v.mean_velocity.to_string()),
                        data.sway_metrics.as_ref().map_or(String::new(), |v| v.total_path_length.to_string()),
                        data.sway_metrics.as_ref().map_or(String::new(), |v| v.velocity_moment.to_string()),
                        data.frequency_metrics.as_ref().map_or(String::new(), |f| f.mean_power_frequency.to_string()),
                        data.frequency_metrics.as_ref().map_or(String::new(), |f| f.center_of_spectrum.to_string()),
                        data.frequency_metrics.as_ref().map_or(String::new(), |f| f.total_power.to_string()),
                        data.dfa_alpha.map_or(String::new(), |v| v.to_string()),
                        data.jerk.map_or(String::new(), |v| v.to_string())
                    );

                    // Write and flush
                    file.write_all(csv_line.as_bytes()).await?;
                    file.flush().await?;
                }
            },
        }
    }

    println!("File writer execution complete.");
    Ok(())
}

async fn create_file(output_path: PathBuf) -> io::Result<File> {
    OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .open(output_path.to_str().unwrap()).await
}