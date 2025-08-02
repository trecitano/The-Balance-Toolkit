use tokio::io::AsyncWriteExt;
use tokio::net::TcpStream;
use tokio::sync::broadcast;
use tokio::task;
use crate::processing::data_processor::ProcessedBoardData;

pub fn initialize(rx: broadcast::Receiver<ProcessedBoardData>,
                  tcp_connection_string: String) -> task::JoinHandle<anyhow::Result<()>> {
    tokio::spawn(async move {
        tcp_stream_loop(rx, tcp_connection_string).await
    })
}

async fn tcp_stream_loop(mut rx: broadcast::Receiver<ProcessedBoardData>, 
                         tcp_connection_string: String) -> anyhow::Result<()> {
    let mut stream = TcpStream::connect(tcp_connection_string).await?;

    while let Ok(data) = rx.recv().await {
        stream.write_all(&data.to_byte_array()).await?
    }
    Ok(())
}