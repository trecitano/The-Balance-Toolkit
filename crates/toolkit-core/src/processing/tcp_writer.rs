use crate::actors::balance_board_actor::BalanceBoardOutput;
use std::sync::Arc;
use std::time::Duration;
use tokio::io::AsyncWriteExt;
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::mpsc::{Receiver, Sender};
use tokio::sync::{Mutex, mpsc};

pub fn initialize(
    tcp_connection_string_raw: String,
    tcp_connection_string_processed: String,
) -> Sender<BalanceBoardOutput> {
    let (tx, mut rx) = mpsc::channel(100);

    tokio::spawn(async move {
        let mut join_handles = Vec::new();

        let (raw_tx, raw_rx) = mpsc::channel(100);
        let raw_task =
            tokio::spawn(async move { tcp_server_loop(raw_rx, tcp_connection_string_raw).await });
        join_handles.push(raw_task);

        let (processed_tx, processed_rx) = mpsc::channel(100);
        let processed_task = tokio::spawn(async move {
            tcp_server_loop(processed_rx, tcp_connection_string_processed).await
        });
        join_handles.push(processed_task);

        while let Some(data) = rx.recv().await {
            match data {
                BalanceBoardOutput::Raw(_) => {
                    if raw_tx.send(data).await.is_err() {
                        log::warn!("raw stream task closed; stopping dispatch");
                        break;
                    }
                }
                BalanceBoardOutput::Processed(_) => {
                    if processed_tx.send(data).await.is_err() {
                        log::warn!("processed stream task closed; stopping dispatch");
                        break;
                    }
                }
            }
        }

        drop(raw_tx);
        drop(processed_tx);

        for handle in join_handles {
            match handle.await {
                Ok(Ok(())) => {}
                Ok(Err(e)) => log::error!("TCP worker returned error: {e:?}"),
                Err(e) => log::error!("TCP worker task failed: {e:?}"),
            }
        }

        log::debug!("TCP handler complete.");
    });

    tx
}

/// A client that cannot drain one record within this time is dropped so it cannot stall the
/// broadcast to the others.
const CLIENT_WRITE_TIMEOUT: Duration = Duration::from_millis(250);

async fn tcp_server_loop(
    mut rx: Receiver<BalanceBoardOutput>,
    tcp_bind_address: String,
) -> anyhow::Result<()> {
    log::debug!("TCP server starting. (Binding to: {})", tcp_bind_address);

    let listener = TcpListener::bind(&tcp_bind_address).await?;
    log::info!("TCP server listening on: {}", tcp_bind_address);

    // Shared vector to hold all connected clients
    let clients = Arc::new(Mutex::new(Vec::<TcpStream>::new()));

    // Clone for the connection acceptance task
    let clients_clone = Arc::clone(&clients);

    let accept_task = tokio::spawn(async move {
        // Accept new connections
        loop {
            match listener.accept().await {
                Ok((stream, addr)) => {
                    log::info!("New TCP client connected from: {}", addr);
                    let mut clients_guard = clients_clone.lock().await;
                    clients_guard.push(stream);
                }
                Err(e) => {
                    log::error!("Failed to accept TCP connection: {}", e);
                }
            }
        }
    });

    // Handle data broadcasting to all clients
    while let Some(data) = rx.recv().await {
        let byte_data = data.to_byte_array();
        let mut clients_guard = clients.lock().await;

        // Clients parse the stream as fixed-size records, so every record must land in full:
        // `write_all` rather than `try_write`, which could leave a partial record behind and
        // desynchronise the client's framing for good.
        let mut alive = Vec::with_capacity(clients_guard.len());
        for mut stream in clients_guard.drain(..) {
            match tokio::time::timeout(CLIENT_WRITE_TIMEOUT, stream.write_all(&byte_data)).await {
                Ok(Ok(())) => alive.push(stream),
                Ok(Err(e)) => log::info!("TCP client disconnected: {}", e),
                Err(_) => log::warn!("TCP client is not keeping up; dropping it."),
            }
        }
        *clients_guard = alive;
    }

    // Stop accepting, which also closes the listener so the port is free for the next
    // session. Leaving this task running kept the port bound for the life of the process.
    accept_task.abort();

    log::debug!(
        "TCP server execution complete. (Was binding to: {})",
        tcp_bind_address
    );
    Ok(())
}
