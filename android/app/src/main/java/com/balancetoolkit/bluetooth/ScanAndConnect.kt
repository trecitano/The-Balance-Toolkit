package com.balancetoolkit.bluetooth

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.annotation.RequiresPermission

class ScanAndConnect(
    private val bluetoothAdapter: BluetoothAdapter,
    var hostMacAddress: String,
    private val listener: Listener,
) : BroadcastReceiver() {
    interface Listener {
        fun onDeviceFound(
            name: String,
            address: String,
        )

        fun onBalanceBoardFound(device: BluetoothDevice)

        fun onPairingStateChanged(state: PairingState)

        fun onDeviceConnected(device: BluetoothDevice)

        fun onDeviceDisconnected(device: BluetoothDevice)

        fun onError(message: String)

        fun onLog(message: String)
    }

    sealed class PairingState {
        object Scanning : PairingState()

        object Pairing : PairingState()

        data class Paired(
            val device: BluetoothDevice,
        ) : PairingState()

        data class Failed(
            val reason: String,
        ) : PairingState()
    }

    private val foundDevices = mutableSetOf<String>()

    @RequiresPermission(Manifest.permission.BLUETOOTH_SCAN)
    fun startScanning() {
        if (!bluetoothAdapter.isEnabled) {
            listener.onError("Bluetooth is not enabled")
            return
        }

        foundDevices.clear()
        listener.onPairingStateChanged(PairingState.Scanning)

        bluetoothAdapter.cancelDiscovery()
        bluetoothAdapter.startDiscovery()
        listener.onLog("Started scanning...")
    }

    @RequiresPermission(Manifest.permission.BLUETOOTH_CONNECT)
    fun findPairedBalanceBoard(): BluetoothDevice? = bluetoothAdapter.bondedDevices?.find { device -> isBalanceBoard(device) }

    @RequiresPermission(Manifest.permission.BLUETOOTH_CONNECT)
    override fun onReceive(
        context: Context,
        intent: Intent,
    ) {
        val device = getDeviceFromIntent(intent)
        if (device == null || !isBalanceBoard(device)) {
            return
        }

        when (intent.action) {
            BluetoothDevice.ACTION_FOUND -> {
                listener.onBalanceBoardFound(device)
                listener.onLog("Balance Board found! Starting pairing...")
                startPairing(device)
            }

            BluetoothDevice.ACTION_PAIRING_REQUEST -> {
                handlePairingRequest(device)
            }

            BluetoothDevice.ACTION_BOND_STATE_CHANGED -> {
                handleBondStateChange(device, intent)
            }

            BluetoothDevice.ACTION_ACL_CONNECTED -> {
                listener.onDeviceConnected(device)
            }

            BluetoothDevice.ACTION_ACL_DISCONNECTED -> {
                listener.onDeviceDisconnected(device)
            }
        }
    }

    // https://wiibrew.org/wiki/Wiimote#Bluetooth_Pairing
    @RequiresPermission(Manifest.permission.BLUETOOTH_CONNECT)
    private fun handlePairingRequest(device: BluetoothDevice) {
        try {
            val pin = parseMacAddress(hostMacAddress).reversedArray()

            listener.onLog("Setting PIN: ${pin.joinToString(":") { "%02X".format(it) }}")

            device.setPin(pin)

            // We abort the broadcast so there the user doesn't see a pop up asking for the pin
            abortBroadcast()

            listener.onLog("✓ PIN set successfully")
        } catch (e: Exception) {
            listener.onError("PIN setup failed: ${e.message}")
        }
    }

    private fun handleBondStateChange(
        device: BluetoothDevice,
        intent: Intent,
    ) {
        val state = intent.getIntExtra(BluetoothDevice.EXTRA_BOND_STATE, BluetoothDevice.ERROR)

        when (state) {
            BluetoothDevice.BOND_BONDING -> {
                listener.onPairingStateChanged(PairingState.Pairing)
            }

            BluetoothDevice.BOND_BONDED -> {
                device.let {
                    listener.onPairingStateChanged(PairingState.Paired(it))
                }
            }

            BluetoothDevice.BOND_NONE -> {
                listener.onPairingStateChanged(PairingState.Failed("Pairing failed or cancelled"))
            }
        }
    }

    @RequiresPermission(Manifest.permission.BLUETOOTH_CONNECT)
    private fun startPairing(device: BluetoothDevice) {
        try {
            listener.onLog("Pairing with ${device.name}...")
            device.createBond()
        } catch (e: Exception) {
            listener.onError("Pairing error: ${e.message}")
        }
    }

    private fun getDeviceFromIntent(intent: Intent): BluetoothDevice? =
        intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE, BluetoothDevice::class.java)

    @RequiresPermission(Manifest.permission.BLUETOOTH_CONNECT)
    private fun isBalanceBoard(device: BluetoothDevice): Boolean = device.name?.contains("RVL-WBC-01", ignoreCase = true) ?: false

    private fun parseMacAddress(macStr: String): ByteArray = macStr.split(':').map { it.toInt(16).toByte() }.toByteArray()
}
