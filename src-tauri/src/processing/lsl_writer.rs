use anyhow::Result;
use lsl::{ChannelFormat, Pushable};
use std::thread;
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc;
use tokio::sync::mpsc::{Receiver, Sender};
use crate::actors::balance_board_actor::BalanceBoardOutput;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LslConnectionSettings {
    pub stream_name: String,
    pub source_id: String,
}

pub fn initialize(settings: LslConnectionSettings) -> Sender<BalanceBoardOutput> {
    let (tx, rx) = mpsc::channel(100);
    
    thread::spawn(move || {
        lsl_stream_loop(rx, settings)
    });
    
    tx
}

fn lsl_stream_loop(mut rx: Receiver<BalanceBoardOutput>, 
                   settings: LslConnectionSettings) -> Result<()> {
    println!("LSL writer execution start.");

    let info = lsl::StreamInfo::new(
        settings.stream_name.as_str(),
        "MoCap",
        4,
        100.0,
        ChannelFormat::Double64,
        settings.source_id.as_str(),
    )?;
    let outlet = lsl::StreamOutlet::new(&info, 0, 360)?;

    while let Some(data) = rx.blocking_recv() {
        let byte_array = data.to_byte_array();
        let byte_slices: Vec<&[u8]> = vec![&byte_array];
        outlet.push_sample(&byte_slices)?;
    }
    
    println!("LSL writer execution complete.");
    Ok(())
}