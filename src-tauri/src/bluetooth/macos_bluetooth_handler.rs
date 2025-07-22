use anyhow::{anyhow, Result};
use objc2::rc::Retained;
use objc2::runtime::{NSObject, ProtocolObject};
use objc2::{declare_class, msg_send, ClassType, AnyThread, define_class};
use objc2_core_bluetooth::*;
use objc2_foundation::{
    NSArray, NSDictionary, NSError, NSNumber, NSObjectProtocol, NSString,
};
use std::sync::{Arc, Mutex};
use std::sync::mpsc::Sender;
use std::thread;
use tokio::sync::mpsc;
use crate::actors::bluetooth_service::{BluetoothAdapterInfo, NativeBluetoothCommand, NativeBluetoothHandlerInterface};
use crate::types::MacAddress;

#[derive(Debug)]
enum BluetoothEvent {
    StateUpdated(CBManagerState),
    PeripheralDiscovered(Retained<CBPeripheral>),
    PeripheralConnected(Retained<CBPeripheral>),
    PeripheralDisconnected(Retained<CBPeripheral>),
}


pub struct NativeBluetoothHandler {
    rx: mpsc::Receiver<NativeBluetoothCommand>,
}

impl NativeBluetoothHandler {
    fn run(&mut self) {

    }
}

impl NativeBluetoothHandlerInterface for NativeBluetoothHandler {

    fn start_native_bluetooth_handler() -> mpsc::Sender<NativeBluetoothCommand> {
        let (tx, rx) = mpsc::channel(100);
        let handler = NativeBluetoothHandler {
          rx
        };

        tokio::spawn(async move {
            handler.run().await;
        });

        tx
    }

    async fn run(&self) {

    }

    async fn get_all_bluetooth_adapters_info(&self) -> Result<Vec<Result<BluetoothAdapterInfo>>> {
        match unsafe { CBManager::authorization_class() } {
            CBManagerAuthorization::AllowedAlways => (),
            _ => return Err(anyhow!("Error with bluetooth"))
        }

        Ok(vec!())
    }

    async fn scan_and_pair_nintendo(&self, adapter: &BluetoothAdapterInfo) -> Result<(MacAddress)> {
        todo!()
    }

    async fn remove_device(&self, mac_address: MacAddress) -> Result<()> {
        todo!()
    }
}
