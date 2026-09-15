use crate::actors::balance_board_actor::BalanceBoardOutput;
use tokio::sync::mpsc::{Sender, error::TrySendError};

/// A slow consumer skips this sample; only disconnected consumers are removed.
pub(crate) fn broadcast(
    observers: &mut Vec<Sender<BalanceBoardOutput>>,
    output: BalanceBoardOutput,
    warned_about_drops: &mut bool,
) {
    observers.retain(|observer| match observer.try_send(output.clone()) {
        Ok(()) => true,
        Err(TrySendError::Full(_)) => {
            if !*warned_about_drops {
                *warned_about_drops = true;
                let kind = match output {
                    BalanceBoardOutput::Raw(_) => "raw",
                    BalanceBoardOutput::Processed(_) => "processed",
                };
                log::warn!("A {kind} data consumer is falling behind; dropping samples for it.");
            }
            true
        }
        Err(TrySendError::Closed(_)) => false,
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::actors::balance_board_actor::BalanceBoardCalibratedReading;
    use tokio::sync::mpsc;

    #[test]
    fn full_consumer_recovers_and_closed_consumer_is_removed() {
        let (slow, mut slow_rx) = mpsc::channel(1);
        let (fast, mut fast_rx) = mpsc::channel(1);
        let (closed, closed_rx) = mpsc::channel(1);
        drop(closed_rx);
        let reading = |mac_address| {
            BalanceBoardOutput::Raw(BalanceBoardCalibratedReading {
                mac_address,
                ..Default::default()
            })
        };
        slow.try_send(reading(1)).unwrap();
        let mut observers = vec![slow, fast, closed];
        let mut warned = false;

        broadcast(&mut observers, reading(2), &mut warned);
        assert_eq!(observers.len(), 2);
        assert!(warned);
        assert_eq!(slow_rx.try_recv().unwrap().mac_address(), 1);
        assert_eq!(fast_rx.try_recv().unwrap().mac_address(), 2);

        broadcast(&mut observers, reading(3), &mut warned);
        assert_eq!(slow_rx.try_recv().unwrap().mac_address(), 3);
        assert_eq!(fast_rx.try_recv().unwrap().mac_address(), 3);
    }
}
