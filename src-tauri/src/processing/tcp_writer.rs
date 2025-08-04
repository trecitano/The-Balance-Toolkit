use tokio::io::AsyncWriteExt;
use tokio::net::TcpStream;
use tokio::sync::mpsc;
use tokio::sync::mpsc::{Receiver, Sender};
use crate::actors::balance_board_actor::{BalanceBoardOutput};

pub fn initialize(tcp_connection_string: String) -> Sender<BalanceBoardOutput> {
    let (tx, rx) = mpsc::channel(100);
    
    tokio::spawn(async move {
        tcp_stream_loop(rx, tcp_connection_string).await
    });

    tx
}

async fn tcp_stream_loop(mut rx: Receiver<BalanceBoardOutput>, 
                         tcp_connection_string: String) -> anyhow::Result<()> {
    println!("TCP writer execution start.");
    
    let mut stream = TcpStream::connect(tcp_connection_string).await?;

    while let Some(data) = rx.recv().await {
        stream.write_all(&data.to_byte_array()).await?
    }

    println!("TCP writer execution complete.");
    Ok(())
}