use crate::actors::balance_board_actor::{BalanceBoardCalibratedReading, BalanceBoardOutput};
use crate::processing::data_processor::ProcessedBoardData;
use anyhow::Result;
use lsl::{ChannelFormat, Pushable, StreamInfo, StreamOutlet};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::thread;
use tokio::sync::mpsc;
use tokio::sync::mpsc::{Receiver, Sender};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LslConnectionSettings {
    pub stream_name: String,
    pub source_id: String,
}

pub fn initialize(settings: LslConnectionSettings) -> Sender<BalanceBoardOutput> {
    let (main_tx, mut rx) = mpsc::channel(100);
    thread::spawn(move || {
        log::info!("LSL handler start.");

        let mut join_handles = Vec::new();

        let (raw_tx, raw_rx) = mpsc::channel(100);
        let settings_clone = settings.clone();
        let raw_thread = thread::Builder::new()
            .name("lsl-raw".into())
            .spawn(move || lsl_stream_loop_raw(raw_rx, settings_clone))
            .expect("failed to spawn lsl-raw thread");
        join_handles.push(raw_thread);

        let (processed_tx, processed_rx) = mpsc::channel(100);
        let processed_thread = thread::Builder::new()
            .name("lsl-processed".into())
            .spawn(move || lsl_stream_loop_processed(processed_rx, settings))
            .expect("failed to spawn lsl-processed thread");
        join_handles.push(processed_thread);

        while let Some(data) = rx.blocking_recv() {
            match data {
                BalanceBoardOutput::Raw(data) => {
                    if raw_tx.blocking_send(data).is_err() {
                        log::error!("raw stream thread closed; stopping dispatch");
                        break;
                    }
                }
                BalanceBoardOutput::Processed(data) => {
                    if processed_tx.blocking_send(data).is_err() {
                        log::error!("processed stream thread closed; stopping dispatch");
                        break;
                    }
                }
            }
        }

        drop(raw_tx);
        drop(processed_tx);

        for handle in join_handles {
            match handle.join() {
                Ok(Ok(())) => {}
                Ok(Err(e)) => log::error!("LSL worker returned error: {e:?}"),
                Err(_) => log::error!("LSL worker thread panicked"),
            }
        }

        log::info!("LSL handler complete.");
    });

    main_tx
}

fn lsl_stream_loop_raw(
    mut rx: Receiver<BalanceBoardCalibratedReading>,
    settings: LslConnectionSettings,
) -> Result<()> {
    log::info!("LSL raw writer execution start.");
    let stream_name = format!("{}_basic", settings.stream_name);
    let source_id = format!("{}_basic", settings.source_id);

    let mut stream_info = StreamInfo::new(
        &stream_name,
        "BalanceBoard_Basic",
        8, // timestamp + mac + 4 sensors + 2 cop
        100.0,
        ChannelFormat::Double64,
        &source_id,
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
    add_channel("timestamp", "microseconds", "timestamp", "Sample timestamp");
    add_channel(
        "mac_address",
        "unitless",
        "identifier",
        "Device MAC address",
    );
    add_channel("top_right", "kg", "force", "Top right sensor reading");
    add_channel("bottom_right", "kg", "force", "Bottom right sensor reading");
    add_channel("top_left", "kg", "force", "Top left sensor reading");
    add_channel("bottom_left", "kg", "force", "Bottom left sensor reading");
    add_channel(
        "cop_x",
        "unitless",
        "index",
        "Center of Pressure X Axis. (-1 to 1)",
    );
    add_channel(
        "cop_y",
        "unitless",
        "index",
        "Center of Pressure Y Axis. (-1 to 1)",
    );

    let outlet = StreamOutlet::new(&stream_info, 0, 360)?;

    while let Some(data) = rx.blocking_recv() {
        let cop = data.calculate_cop();
        let sample = vec![
            data.timestamp.timestamp_micros() as f64,
            data.mac_address as f64,
            data.top_right as f64,
            data.bottom_right as f64,
            data.top_left as f64,
            data.bottom_left as f64,
            cop.x as f64,
            cop.y as f64,
        ];
        outlet.push_sample(&sample)?;
    }

    log::info!("LSL raw writer execution complete.");
    Ok(())
}

fn lsl_stream_loop_processed(
    mut rx: Receiver<Arc<ProcessedBoardData>>,
    settings: LslConnectionSettings,
) -> Result<()> {
    log::info!("LSL processed writer execution start.");
    let stream_name = format!("{}_complex", settings.stream_name);
    let source_id = format!("{}_complex", settings.source_id);

    let mut stream_info = StreamInfo::new(
        &stream_name,
        "BalanceBoard_Complex",
        9,
        100.0, // TODO: USE REAL SAMPLING RATE!
        ChannelFormat::Double64,
        &source_id,
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
    add_channel("timestamp", "microseconds", "timestamp", "Sample timestamp");
    add_channel(
        "mac_address",
        "unitless",
        "identifier",
        "Device MAC address",
    );
    add_channel("v_cop_x", "1/s", "velocity", "Normalized CoP velocity X");
    add_channel("v_cop_y", "1/s", "velocity", "Normalized CoP velocity Y");
    add_channel(
        "stability_index",
        "unitless",
        "index",
        "Overall stability index",
    );
    add_channel("dpsi_mlsi", "unitless", "index", "DPSI - Medial-Lateral");
    add_channel(
        "dpsi_apsi",
        "unitless",
        "index",
        "DPSI - Anterior-Posterior",
    );
    add_channel("dpsi_vsi", "unitless", "index", "DPSI - Vertical");
    add_channel("dpsi_overall", "unitless", "index", "DPSI - Overall");

    // Stream-level metadata
    let mut general = desc.append_child("general");
    general.append_child_value("cop_normalization", "[-1,1] of board width/length");
    general.append_child_value("notes", "v_cop_* in normalized units per second");

    let outlet = StreamOutlet::new(&stream_info, 0, 360)?;

    while let Some(data) = rx.blocking_recv() {
        let mut sample = [f64::NAN; 9];
        sample[0] = data.timestamp.timestamp_micros() as f64;
        sample[1] = data.mac_address as f64;

        if let Some(ref sway) = data.sway_metrics {
            sample[2] = sway.v_cop_x as f64;
            sample[3] = sway.v_cop_y as f64;
        }

        sample[4] = data.stability_index.map(|v| v as f64).unwrap_or(f64::NAN);

        if let Some(ref dpsi) = data.dpsi_metrics {
            sample[5] = dpsi.mlsi as f64;
            sample[6] = dpsi.apsi as f64;
            sample[7] = dpsi.vsi as f64;
            sample[8] = dpsi.dpsi as f64;
        }

        outlet.push_sample(&sample.to_vec())?;
    }

    log::info!("LSL processed writer execution complete.");
    Ok(())
}
