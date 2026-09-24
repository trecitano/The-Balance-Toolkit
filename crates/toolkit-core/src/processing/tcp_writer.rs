use crate::actors::balance_board_actor::BalanceBoardOutput;
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr};
use std::sync::Arc;
use std::time::Duration;
use tokio::io::AsyncWriteExt;
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::mpsc::{Receiver, Sender};
use tokio::sync::{Mutex, mpsc};
use tokio::task::JoinSet;

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

// A hostname passed directly to TcpListener::bind selects only the first successful
// address. localhost needs separate loopback listeners to serve both IP families.
async fn bind_listeners(address: &str) -> std::io::Result<Vec<TcpListener>> {
    let Some((host, port)) = address.rsplit_once(':') else {
        return Ok(vec![TcpListener::bind(address).await?]);
    };
    if !host.eq_ignore_ascii_case("localhost") {
        return Ok(vec![TcpListener::bind(address).await?]);
    }
    let mut port: u16 = port
        .parse()
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidInput, e))?;
    let mut listeners = Vec::new();
    let mut last_error = None;
    for ip in [
        IpAddr::V4(Ipv4Addr::LOCALHOST),
        IpAddr::V6(Ipv6Addr::LOCALHOST),
    ] {
        let address = SocketAddr::new(ip, port);
        match TcpListener::bind(address).await {
            Ok(listener) => {
                // Port zero must still select the same port for both families.
                port = listener.local_addr()?.port();
                listeners.push(listener);
            }
            Err(error) => {
                log::warn!("Could not listen on {address}: {error}");
                last_error = Some(error);
            }
        }
    }
    if listeners.is_empty() {
        return Err(last_error.expect("both loopback binds failed"));
    }
    Ok(listeners)
}

fn accept_clients(listeners: Vec<TcpListener>, clients: Arc<Mutex<Vec<TcpStream>>>) -> JoinSet<()> {
    let mut tasks = JoinSet::new();
    for listener in listeners {
        let clients = Arc::clone(&clients);
        tasks.spawn(async move {
            loop {
                match listener.accept().await {
                    Ok((stream, addr)) => {
                        log::info!("New TCP client connected from: {}", addr);
                        clients.lock().await.push(stream);
                    }
                    Err(e) => log::error!("Failed to accept TCP connection: {}", e),
                }
            }
        });
    }
    tasks
}

async fn tcp_server_loop(
    rx: Receiver<BalanceBoardOutput>,
    tcp_bind_address: String,
) -> anyhow::Result<()> {
    let listeners = bind_listeners(&tcp_bind_address).await?;
    for listener in &listeners {
        log::info!("TCP server listening on: {}", listener.local_addr()?);
    }
    let clients = Arc::new(Mutex::new(Vec::new()));
    let mut accept_tasks = accept_clients(listeners, Arc::clone(&clients));
    broadcast(rx, clients).await;
    // Await cancellation so every listener is closed before the session finishes.
    // JoinSet also aborts these tasks if the server itself is cancelled.
    accept_tasks.shutdown().await;
    log::debug!("TCP server execution complete. (Was binding to: {tcp_bind_address})");
    Ok(())
}

async fn broadcast(mut rx: Receiver<BalanceBoardOutput>, clients: Arc<Mutex<Vec<TcpStream>>>) {
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
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::actors::balance_board_actor::BalanceBoardCalibratedReading;
    use tokio::io::AsyncReadExt;

    #[tokio::test]
    async fn localhost_broadcasts_to_both_families_and_releases_listeners() {
        tokio::time::timeout(Duration::from_secs(5), async {
            let listeners = bind_listeners("localhost:0").await.unwrap();
            assert_eq!(
                listeners.len(),
                2,
                "this test requires IPv4 and IPv6 loopback"
            );
            let addresses: Vec<_> = listeners.iter().map(|l| l.local_addr().unwrap()).collect();
            assert!(addresses[0].is_ipv4());
            assert!(addresses[1].is_ipv6());
            assert_eq!(addresses[0].port(), addresses[1].port());
            assert!(addresses.iter().all(|a| a.ip().is_loopback()));

            let clients = Arc::new(Mutex::new(Vec::new()));
            let mut accept_tasks = accept_clients(listeners, Arc::clone(&clients));
            let mut ipv4 = TcpStream::connect(addresses[0]).await.unwrap();
            let mut ipv6 = TcpStream::connect(addresses[1]).await.unwrap();
            while clients.lock().await.len() != 2 {
                tokio::task::yield_now().await;
            }
            let (tx, rx) = mpsc::channel(1);
            let writer = tokio::spawn(broadcast(rx, clients));
            let sample = BalanceBoardOutput::Raw(BalanceBoardCalibratedReading {
                top_right: 12.5,
                bottom_left: 7.0,
                ..Default::default()
            });
            let expected = sample.to_byte_array();
            tx.send(sample).await.unwrap();
            let mut received4 = vec![0; expected.len()];
            let mut received6 = vec![0; expected.len()];
            ipv4.read_exact(&mut received4).await.unwrap();
            ipv6.read_exact(&mut received6).await.unwrap();
            assert_eq!(received4, expected);
            assert_eq!(received6, expected);
            drop(tx);
            writer.await.unwrap();
            accept_tasks.shutdown().await;
            drop((ipv4, ipv6));
            for address in addresses {
                TcpListener::bind(address).await.unwrap();
            }
        })
        .await
        .expect("TCP broadcast or shutdown timed out");
    }

    #[tokio::test]
    async fn localhost_keeps_available_family_when_other_port_is_occupied() {
        let occupied = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = occupied.local_addr().unwrap().port();
        let listeners = bind_listeners(&format!("localhost:{port}")).await.unwrap();
        assert_eq!(listeners.len(), 1);
        assert_eq!(
            listeners[0].local_addr().unwrap(),
            SocketAddr::new(Ipv6Addr::LOCALHOST.into(), port)
        );
        assert!(bind_listeners(&format!("localhost:{port}")).await.is_err());
    }

    #[tokio::test]
    async fn explicit_addresses_keep_a_single_listener() {
        for address in ["127.0.0.1:0", "[::1]:0"] {
            let listeners = bind_listeners(address).await.unwrap();
            assert_eq!(listeners.len(), 1);
            assert_eq!(
                listeners[0].local_addr().unwrap().ip(),
                address.parse::<SocketAddr>().unwrap().ip()
            );
        }
        assert!(bind_listeners("localhost:invalid").await.is_err());
    }
}
