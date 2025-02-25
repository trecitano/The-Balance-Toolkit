use bluez_async::BluetoothSession;

pub async fn get_all_bluetooth_adapters_info() -> Result<Vec<Result<BluetoothAdapterInfo>>> {
    let (_, session) = BluetoothSession::new().await?;

    let adapters = session.get_adapters().await?;

    Ok(adapters
        .into_iter()
        .map(|adapter| {
            let mac_address = adapter.mac_address.to_string().replace(":", "");
            let wii_board_pin = address_to_wii_pin(mac_address.clone())?;

            Ok(BluetoothAdapterInfo {
                name: adapter.name,
                mac_address,
                wii_board_pin,
            })
        })
        .collect())
}
