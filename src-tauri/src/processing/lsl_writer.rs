use crate::processing::data_processor::ProcessedBoardData;
use lsl::{ChannelFormat, Pushable};
use std::thread;
use tokio::sync::broadcast;

#[derive(Clone, Debug)]
pub struct LslConnectionSettings {
    pub stream_name: String,
    pub stream_type: String,
    pub channel_count: u32,
    pub nominal_srate: f64,
}

pub fn initialize(rx: broadcast::Receiver<ProcessedBoardData>,
                  settings: LslConnectionSettings) -> thread::JoinHandle<anyhow::Result<()>> {
    thread::spawn(move || {
        lsl_stream_loop(rx, settings)
    })
}

fn lsl_stream_loop(mut rx: broadcast::Receiver<ProcessedBoardData>, 
                   settings: LslConnectionSettings) -> anyhow::Result<()> {
    let info = lsl::StreamInfo::new(
        settings.stream_name.as_str(),
        settings.stream_type.as_str(),
        settings.channel_count,
        settings.nominal_srate,
        ChannelFormat::Double64,
        "The-Balance-Toolkit"
    )?;
    let outlet = lsl::StreamOutlet::new(&info, 0, 360)?;

    while let Ok(data) = rx.blocking_recv() {
        let byte_array = data.to_byte_array();
        let byte_slices: Vec<&[u8]> = vec![&byte_array];
        outlet.push_sample(&byte_slices)?;
    }

    Ok(())
}