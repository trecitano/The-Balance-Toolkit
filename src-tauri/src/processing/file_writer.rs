use crate::actors::balance_board_actor::BalanceBoardOutput;
use crate::processing::data_processor::ProcessingSettings;
use anyhow::Result;
use chrono::Utc;
use std::io;
use std::path::PathBuf;
use tokio::fs::{File, OpenOptions};
use tokio::io::AsyncWriteExt;
use tokio::sync::mpsc;
use tokio::sync::mpsc::{Receiver, Sender};

pub fn initialize(output_directory: String,
                  session_name: String,
                  observe_raw_data: bool,
                  observe_processed_data: bool,
                  device_name: String,
                  processing_settings: ProcessingSettings) -> Sender<BalanceBoardOutput> {
    let (tx, rx) = mpsc::channel(100);
    
    tokio::spawn(async move {
        file_write_loop(rx,
                        session_name,
                        output_directory,
                        observe_raw_data,
                        observe_processed_data,
                        device_name,
                        processing_settings
        ).await
    });

    tx
}

async fn file_write_loop(mut rx: Receiver<BalanceBoardOutput>,
                         output_directory: String,
                         session_name: String,
                         observe_raw_data: bool,
                         observe_processed_data: bool,
                         device_name: String,
                         processing_settings: ProcessingSettings) -> Result<()> {
    println!("File writer execution start.");
    let path = PathBuf::from(output_directory);
    let prepared_file_name = format!("{session_name}-{device_name}");

    // Create a file to store the session processing settings;
    if observe_processed_data {
        let file_path = path.join(format!("{prepared_file_name}-settings.txt"));
        println!("Storing settings in {:?}", file_path);
        let mut file = create_file(file_path).await?;
        let content = toml::to_string_pretty(&processing_settings)?;
        file.write_all(content.as_ref()).await?;
    }

    // Create a file to optionally store the raw values;
    let mut raw_values_file = if observe_raw_data {
        let file_path = path.join(format!("{prepared_file_name}-raw-values.txt"));
        println!("Storing processed session in {:?}", file_path);
        let mut file = create_file(file_path).await?;
        file.write_all(b"timestamp,top_right,bottom_right,top_left,bottom_left\n").await?;
        Some(file)
    } else {
        None
    };

    // Create a file to optionally store the processed values;
    let mut processed_values_file = if observe_processed_data {
        let file_path = path.join(format!("{prepared_file_name}-processed-values.txt"));
        let mut file = create_file(file_path).await?;
        file.write_all(b"timestamp,mean_velocity,total_path_length,velocity_moment,confidence_ellipse_area,convex_hull_area,mean_power_frequency,center_of_spectrum,frequency_total_power,dfa_alpha,jerk\n").await?;
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
                        data.timestamp.format("%Y-%m-%dT%H:%M:%S%.6fZ"),
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
                        "{},{},{},{},{},{},{},{},{},{},{}\n",
                        data.timestamp.format("%Y-%m-%dT%H:%M:%S%.6fZ"),
                        data.sway_metrics.as_ref().map_or(String::new(), |v| v.mean_velocity.to_string()),
                        data.sway_metrics.as_ref().map_or(String::new(), |v| v.total_path_length.to_string()),
                        data.sway_metrics.as_ref().map_or(String::new(), |v| v.velocity_moment.to_string()),
                        data.area_metrics.as_ref().map_or(String::new(), |a| a.confidence_ellipse_area.to_string()),
                        data.area_metrics.as_ref().map_or(String::new(), |a| a.convex_hull_area.to_string()),
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