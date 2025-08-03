use anyhow::Result;
use lsl::{ChannelFormat, Pushable};
use std::thread;
use tokio::sync::mpsc;
use tokio::sync::mpsc::{Receiver, Sender};
use crate::actors::balance_board_actor::BalanceBoardOutput;

#[derive(Clone, Debug)]
pub struct LslConnectionSettings {
    pub stream_name: String,
    pub stream_type: String,
    pub channel_count: u32,
    pub nominal_srate: f64,
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
    let info = lsl::StreamInfo::new(
        settings.stream_name.as_str(),
        settings.stream_type.as_str(),
        settings.channel_count,
        settings.nominal_srate,
        ChannelFormat::Double64,
        "The-Balance-Toolkit"
    )?;
    let outlet = lsl::StreamOutlet::new(&info, 0, 360)?;

    while let Some(data) = rx.blocking_recv() {
        let byte_array = data.to_byte_array();
        let byte_slices: Vec<&[u8]> = vec![&byte_array];
        outlet.push_sample(&byte_slices)?;
    }

    Ok(())
}