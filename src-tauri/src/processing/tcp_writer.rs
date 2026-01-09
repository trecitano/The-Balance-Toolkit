use crate::actors::balance_board_actor::BalanceBoardOutput;
use std::sync::Arc;
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
                        eprintln!("raw stream task closed; stopping dispatch");
                        break;
                    }
                }
                BalanceBoardOutput::Processed(_) => {
                    if processed_tx.send(data).await.is_err() {
                        eprintln!("processed stream task closed; stopping dispatch");
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
                Ok(Err(e)) => eprintln!("TCP worker returned error: {e:?}"),
                Err(e) => eprintln!("TCP worker task failed: {e:?}"),
            }
        }

        println!("TCP handler complete.");
    });

    tx
}

async fn tcp_server_loop(
    mut rx: Receiver<BalanceBoardOutput>,
    tcp_bind_address: String,
) -> anyhow::Result<()> {
    println!("TCP server starting. (Binding to: {})", tcp_bind_address);

    let listener = TcpListener::bind(&tcp_bind_address).await?;
    println!("TCP server listening on: {}", tcp_bind_address);

    // Shared vector to hold all connected clients
    let clients = Arc::new(Mutex::new(Vec::<TcpStream>::new()));

    // Clone for the connection acceptance task
    let clients_clone = Arc::clone(&clients);

    tokio::spawn(async move {
        // Accept new connections
        loop {
            match listener.accept().await {
                Ok((stream, addr)) => {
                    println!("New client connected from: {}", addr);
                    let mut clients_guard = clients_clone.lock().await;
                    clients_guard.push(stream);
                }
                Err(e) => {
                    eprintln!("Failed to accept connection: {}", e);
                }
            }
        }
    });

    // Handle data broadcasting to all clients
    while let Some(data) = rx.recv().await {
        let byte_data = data.to_byte_array();
        let mut clients_guard = clients.lock().await;

        // Remove disconnected clients and send data to connected ones
        clients_guard.retain_mut(|stream| {
            match stream.try_write(&byte_data) {
                Ok(_) => true, // Keep this client
                Err(e) => {
                    eprintln!("Client disconnected: {}", e);
                    false // Remove this client
                }
            }
        });
    }

    println!(
        "TCP server execution complete. (Was binding to: {})",
        tcp_bind_address
    );
    Ok(())
}
