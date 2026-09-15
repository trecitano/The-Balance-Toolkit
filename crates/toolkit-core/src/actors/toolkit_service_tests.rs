use super::*;

#[tokio::test]
async fn stopping_a_run_cancels_its_timer_before_restart() {
    let token = CancellationToken::new();
    let mut running = Some(RunningSession::new(token.clone()));
    let (board, mut board_rx) = mpsc::channel(1);
    let connections = HashMap::from([(1, board)]);
    let (manager, mut commands) = mpsc::channel(1);

    stop_running(&mut running, &connections).await.unwrap();
    assert!(running.is_none());
    assert!(matches!(
        board_rx.try_recv(),
        Ok(BoardAction::StopRecording)
    ));

    running = Some(RunningSession::new(CancellationToken::new()));
    // Both expiry and cancellation are ready: the cancelled timer must not stop the new run.
    auto_stop(Duration::ZERO, token, SessionTarget::Replay, manager).await;
    assert!(commands.try_recv().is_err());
    assert!(!running.as_ref().unwrap().cancellation_token.is_cancelled());
}

#[tokio::test]
async fn queued_timer_is_invalidated_when_its_run_is_replaced() {
    let token = CancellationToken::new();
    let mut running = Some(RunningSession::new(token.clone()));
    let (manager, mut commands) = mpsc::channel(1);
    let timer = tokio::spawn(auto_stop(
        Duration::ZERO,
        token,
        SessionTarget::Replay,
        manager,
    ));
    let command = commands.recv().await.unwrap();
    assert!(!running.as_ref().unwrap().cancellation_token.is_cancelled());

    running = Some(RunningSession::new(CancellationToken::new()));
    let ToolkitCommand::AutoStop {
        cancellation_token, ..
    } = command
    else {
        panic!("expected auto-stop command");
    };
    assert!(cancellation_token.is_cancelled());
    assert!(!running.as_ref().unwrap().cancellation_token.is_cancelled());
    timer.await.unwrap();

    let current_token = running.as_ref().unwrap().cancellation_token.clone();
    drop(running.take());
    assert!(current_token.is_cancelled());
}

#[tokio::test]
async fn failed_board_stop_still_cancels_timer_and_clears_running_state() {
    let token = CancellationToken::new();
    let mut running = Some(RunningSession::new(token.clone()));
    let (board, board_rx) = mpsc::channel(1);
    drop(board_rx);
    assert!(
        stop_running(&mut running, &HashMap::from([(1, board)]))
            .await
            .is_err()
    );
    assert!(running.is_none());
    assert!(token.is_cancelled());
}
