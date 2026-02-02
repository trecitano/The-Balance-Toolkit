package com.balancetoolkit.bluetooth

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.content.Context
import android.content.IntentFilter
import android.content.SharedPreferences
import android.util.Log
import androidx.annotation.RequiresPermission
import com.balancetoolkit.data.PreferenceKeys
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

sealed class ScanEvent {
    data class DeviceFound(
        val name: String,
        val address: String,
    ) : ScanEvent()

    data class BalanceBoardFound(
        val device: BluetoothDevice,
    ) : ScanEvent()

    data class PairingSucceeded(
        val device: BluetoothDevice,
    ) : ScanEvent()

    data class PairingFailed(
        val reason: String,
    ) : ScanEvent()

    data class Error(
        val message: String,
    ) : ScanEvent()

    data class Log(
        val message: String,
    ) : ScanEvent()
}

@Singleton
class BluetoothScanManager
    @Inject
    constructor(
        private val context: Context,
        private val bluetoothAdapter: BluetoothAdapter?,
        private val sharedPreferences: SharedPreferences,
    ) : ScanAndConnect.Listener {
        companion object {
            private const val TAG = "BluetoothScanManager"
        }

        private var scanAndConnect: ScanAndConnect? = null
        private var isReceiverRegistered = false

        private val _isScanning = MutableStateFlow(false)
        val isScanning: StateFlow<Boolean> = _isScanning.asStateFlow()

        private val _events = MutableSharedFlow<ScanEvent>(extraBufferCapacity = 16)
        val events: SharedFlow<ScanEvent> = _events.asSharedFlow()

        private val intentFilter =
            IntentFilter().apply {
                addAction(BluetoothDevice.ACTION_FOUND)
                addAction(BluetoothDevice.ACTION_PAIRING_REQUEST)
                addAction(BluetoothDevice.ACTION_BOND_STATE_CHANGED)
                addAction(BluetoothDevice.ACTION_ACL_CONNECTED)
                addAction(BluetoothDevice.ACTION_ACL_DISCONNECTED)
                priority = IntentFilter.SYSTEM_HIGH_PRIORITY - 1
            }

        @RequiresPermission(allOf = [Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT])
        fun startScanning(): Boolean {
            if (bluetoothAdapter == null) {
                _events.tryEmit(ScanEvent.Error("Bluetooth is not available on this device"))
                return false
            }

            if (!bluetoothAdapter.isEnabled) {
                _events.tryEmit(ScanEvent.Error("Bluetooth is not enabled"))
                return false
            }

            val hostMac = sharedPreferences.getString(PreferenceKeys.HOST_MAC_ADDRESS, null)
            if (hostMac.isNullOrBlank()) {
                _events.tryEmit(ScanEvent.Error("Host MAC address not configured"))
                return false
            }

            // Create new ScanAndConnect instance with current host MAC
            scanAndConnect = ScanAndConnect(bluetoothAdapter, hostMac, this)

            // Register the receiver
            if (!isReceiverRegistered) {
                context.registerReceiver(scanAndConnect, intentFilter, Context.RECEIVER_EXPORTED)
                isReceiverRegistered = true
            }

            // Start discovery
            scanAndConnect?.startScanning()
            _isScanning.value = true

            return true
        }

        fun stopScanning() {
            try {
                bluetoothAdapter?.cancelDiscovery()
            } catch (e: SecurityException) {
                Log.w(TAG, "Missing BLUETOOTH_SCAN permission for cancelDiscovery", e)
            }
            unregisterReceiver()
            _isScanning.value = false
        }

        private fun unregisterReceiver() {
            if (isReceiverRegistered) {
                try {
                    context.unregisterReceiver(scanAndConnect)
                } catch (e: IllegalArgumentException) {
                    Log.w(TAG, "Receiver was not registered", e)
                }
                isReceiverRegistered = false
            }
            scanAndConnect = null
        }

        // ScanAndConnect.Listener implementation

        override fun onDeviceFound(
            name: String,
            address: String,
        ) {
            _events.tryEmit(ScanEvent.DeviceFound(name, address))
        }

        override fun onBalanceBoardFound(device: BluetoothDevice) {
            _events.tryEmit(ScanEvent.BalanceBoardFound(device))
        }

        override fun onPairingStateChanged(state: ScanAndConnect.PairingState) {
            when (state) {
                is ScanAndConnect.PairingState.Scanning -> {
                    _isScanning.value = true
                }

                is ScanAndConnect.PairingState.Pairing -> {
                    _events.tryEmit(ScanEvent.Log("Pairing in progress..."))
                }

                is ScanAndConnect.PairingState.Paired -> {
                    _events.tryEmit(ScanEvent.PairingSucceeded(state.device))
                    stopScanningInternal()
                }

                is ScanAndConnect.PairingState.Failed -> {
                    _events.tryEmit(ScanEvent.PairingFailed(state.reason))
                }
            }
        }

        override fun onDeviceConnected(device: BluetoothDevice) {
            _events.tryEmit(ScanEvent.Log("Device connected: ${device.address}"))
        }

        override fun onDeviceDisconnected(device: BluetoothDevice) {
            _events.tryEmit(ScanEvent.Log("Device disconnected: ${device.address}"))
        }

        override fun onError(message: String) {
            _events.tryEmit(ScanEvent.Error(message))
        }

        override fun onLog(message: String) {
            Log.d(TAG, message)
            _events.tryEmit(ScanEvent.Log(message))
        }

        private fun stopScanningInternal() {
            try {
                bluetoothAdapter?.cancelDiscovery()
            } catch (e: SecurityException) {
                Log.w(TAG, "Missing BLUETOOTH_SCAN permission for cancelDiscovery", e)
            }
            _isScanning.value = false
            // Keep receiver registered to handle bond state changes
        }

        fun cleanup() {
            stopScanning()
        }
    }
