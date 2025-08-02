use crate::processing::data_processor::ProcessedBoardData;
use tokio::fs::OpenOptions;
use tokio::io::AsyncWriteExt;
use tokio::sync::broadcast;
use tokio::task;

pub fn initialize(rx: broadcast::Receiver<ProcessedBoardData>,
                  output_file: String) -> task::JoinHandle<anyhow::Result<()>> {
    tokio::spawn(async move {
        file_write_loop(rx, output_file).await
    })
}

async fn file_write_loop(mut rx: broadcast::Receiver<ProcessedBoardData>, 
                         output_file: String) -> anyhow::Result<()> {
    let mut file = OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .open(output_file)
        .await?;

    // Write CSV header
    file.write_all(b"timestamp,top_right,bottom_right,top_left,bottom_left\n").await?;

    // Process incoming data
    loop {
        match rx.recv().await {
            Ok(data) => {
                // Format data as CSV row
                let csv_line = format!(
                    "{},{},{},{},{}\n",
                    data.timestamp.to_rfc3339(),
                    data.reading[0],  // top_right
                    data.reading[1],  // bottom_right
                    data.reading[2],  // top_left
                    data.reading[3]   // bottom_left
                );

                // Write and flush
                file.write_all(csv_line.as_bytes()).await?;
                file.flush().await?;
            }
            Err(broadcast::error::RecvError::Closed) => {
                // Channel closed, exit gracefully
                break;
            }
            Err(broadcast::error::RecvError::Lagged(_)) => {
                // We've missed some messages due to slow file writing
                eprintln!("Warning: File writing lagged behind data stream");
                continue;
            }
        }
    }

    println!("File writing loop terminated.");
    Ok(())
}