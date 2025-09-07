use anyhow::Result;
use lsl::{ChannelFormat, Pushable, StreamInfo};
use std::thread;
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc;
use tokio::sync::mpsc::{Receiver, Sender};
use crate::actors::balance_board_actor::{BalanceBoardCalibratedReading, BalanceBoardOutput};
use crate::processing::data_processor::ProcessedBoardData;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LslConnectionSettings {
    pub stream_name: String,
    pub source_id: String,
}

pub fn initialize(settings: LslConnectionSettings) -> Sender<BalanceBoardOutput> {
    let (main_tx, mut rx) = mpsc::channel(100);
    thread::spawn(move || {
        println!("LSL handler start.");

        let mut join_handles = Vec::new();

        let (raw_tx, raw_rx) = mpsc::channel(100);
        let settings_clone = settings.clone();
        let raw_thread = thread::spawn(move || {
            lsl_stream_loop_raw(raw_rx, settings_clone)
        });
        join_handles.push(raw_thread);

        let (processed_tx, processed_rx) = mpsc::channel(100);
        let processed_thread = thread::spawn(move || {
            lsl_stream_loop_processed(processed_rx, settings)
        });
        join_handles.push(processed_thread);

        while let Some(data) = rx.blocking_recv() {
            match data {
                BalanceBoardOutput::Raw(data) => {
                    raw_tx.blocking_send(data).unwrap();
                },
                BalanceBoardOutput::Processed(data) => {
                    processed_tx.blocking_send(data).unwrap();
                }
            }
        }
        for handle in join_handles {
            handle.join().expect("Thread panicked");
        }

        println!("LSL handler complete.");
    });

    main_tx
}

fn lsl_stream_loop_raw(mut rx: Receiver<BalanceBoardCalibratedReading>,
                       settings: LslConnectionSettings) -> Result<()> {
    println!("LSL raw writer execution start.");
    let stream_name = format!("{}_raw", settings.stream_name.as_str());
    let source_id = format!("{}_raw", settings.source_id.as_str());

    let mut stream_info = StreamInfo::new(
        &stream_name,
        "BalanceBoard_Raw",
        5, // timestamp + top_right + bottom_right + top_left + bottom_left
        100.0,
        ChannelFormat::Double64,
        &source_id)?;
    let mut desc = stream_info.desc();
    let mut channels = desc.append_child("channels");
    let mut add_channel = |label: &str, unit: &str, ctype: &str, desc_text: &str| {
        let mut ch = channels.append_child("channel");
        ch.append_child_value("label", label);
        ch.append_child_value("unit", unit);
        ch.append_child_value("type", ctype);
        ch.append_child_value("description", desc_text);
    };
    add_channel("timestamp", "nanoseconds", "timestamp", "Sample timestamp");
    add_channel("top_right", "kg", "force", "Top right sensor reading");
    add_channel("bottom_right", "kg", "force", "Bottom right sensor reading");
    add_channel("top_left", "kg", "force", "Top left sensor reading");
    add_channel("bottom_left", "kg", "force", "Bottom left sensor reading");

    let outlet = lsl::StreamOutlet::new(&stream_info, 0, 360)?;

    while let Some(data) = rx.blocking_recv() {
        let byte_array = vec![
                data.timestamp.timestamp_nanos_opt().unwrap_or(0) as f64,
                data.top_right as f64,
                data.bottom_right as f64,
                data.top_left as f64,
                data.bottom_left as f64,
        ];
        outlet.push_sample(&byte_array)?;
    }

    println!("LSL raw writer execution complete.");
    Ok(())
}

fn lsl_stream_loop_processed(mut rx: Receiver<ProcessedBoardData>,
                       settings: LslConnectionSettings) -> Result<()> {
    println!("LSL processed writer execution start.");
    let stream_name = format!("{}_processed", settings.stream_name.as_str());
    let source_id = format!("{}_processed", settings.source_id.as_str());

    let mut stream_info = StreamInfo::new(
        &stream_name,
        "BalanceBoard_Processed",
        8,
        100.0, // TODO: USE REAL SAMPLING RATE!
        ChannelFormat::Double64,
        &source_id
    )?;
    let mut desc = stream_info.desc();
    let mut channels = desc.append_child("channels");
    let mut add_channel = |label: &str, unit: &str, ctype: &str, desc_text: &str| {
        let mut ch = channels.append_child("channel");
        ch.append_child_value("label", label);
        ch.append_child_value("unit", unit);
        ch.append_child_value("type", ctype);
        ch.append_child_value("description", desc_text);
    };
    add_channel("timestamp", "nanoseconds", "timestamp", "Sample timestamp");
    add_channel("v_cop_x", "1/s", "velocity", "Center of pressure velocity X");
    add_channel("v_cop_y", "1/s", "velocity", "Center of pressure velocity Y");
    add_channel("stability_index", "1/s", "stability", "Overall stability index");
    add_channel("dpsi_mlsi", "1/s", "stability", "Dynamic Postural Stability Index - Medial-Lateral");
    add_channel("dpsi_apsi", "1/s", "stability", "Dynamic Postural Stability Index - Anterior-Posterior");
    add_channel("dpsi_vsi", "1/s", "stability", "Dynamic Postural Stability Index - Vertical");
    add_channel("dpsi_overall", "1/s", "stability", "Dynamic Postural Stability Index - Overall");

    let processed_outlet = lsl::StreamOutlet::new(&stream_info, 0, 360)?;

    while let Some(data) = rx.blocking_recv() {
        let mut sample = Vec::with_capacity(8);

        // Timestamp
        sample.push(data.timestamp.timestamp_nanos_opt().unwrap_or(0) as f64);

        // Sway metrics (v_cop_x, v_cop_y)
        if let Some(ref sway) = data.sway_metrics {
            sample.push(sway.v_cop_x as f64);
            sample.push(sway.v_cop_y as f64);
        } else {
            sample.push(f64::NAN);
            sample.push(f64::NAN);
        }

        // Stability index
        sample.push(data.stability_index.map(|v| v as f64).unwrap_or(f64::NAN));

        // DPSI metrics (mlsi, apsi, vsi, dpsi)
        if let Some(ref dpsi) = data.dpsi_metrics {
            sample.push(dpsi.mlsi as f64);
            sample.push(dpsi.apsi as f64);
            sample.push(dpsi.vsi as f64);
            sample.push(dpsi.dpsi as f64);
        } else {
            sample.extend_from_slice(&[f64::NAN; 4]);
        }

        processed_outlet.push_sample(&sample)?;
    }

    println!("LSL processed writer execution complete.");
    Ok(())
}
