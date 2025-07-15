use crate::balance_board_com::{BalanceBoardConnection, BoardAction};
use anyhow::Result;


// Actions that the user is allowed to make
enum UserAction {
    Tare,
    IdentifyBoard,
    StartRecording,
    FinishRecording
}


// This is a long running task that we don't need to wait for it to finish.
async fn identify_device(board: &BalanceBoardConnection) -> Result<()> {
    tokio::spawn(async {
        board.handle_action(BoardAction::TurnOnLed)
    });
    Ok(())
}

/*
async fn start_device_session(board: BalanceBoardConnection, settings: BalanceBoardSessionSettings) {
    // Setup observers:
    // board.
}
*/

async fn finish_device_session() {

}