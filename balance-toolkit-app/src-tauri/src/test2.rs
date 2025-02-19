use bluest::Adapter;
use std::error::Error;

pub async fn f2() -> Result<(), Box<dyn Error>> {
    let adapter = Adapter::default()
        .await
        .ok_or("Bluetooth adapter not found")?;
    adapter.wait_available().await?;

    Ok(())
}
