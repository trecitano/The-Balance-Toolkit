package com.balancetoolkit.bluetooth

import android.bluetooth.BluetoothAdapter
import android.content.Context
import android.content.SharedPreferences
import com.balancetoolkit.data.PreferenceKeys
import com.balancetoolkit.data.local.dao.DeviceDao
import com.balancetoolkit.data.local.entity.toDevice
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.runBlocking
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Unified connection manager that delegates to mock or real connections
 * based on the app's mock mode setting.
 */
@Singleton
class BalanceBoardConnectionManagerImpl
    @Inject
    constructor(
        @param:ApplicationContext private val context: Context,
        private val sharedPreferences: SharedPreferences,
        private val deviceDao: DeviceDao,
        private val bluetoothAdapter: BluetoothAdapter?,
    ) : BalanceBoardConnectionManager {
        private var mockConnection: MockBalanceBoardConnection? = null
        private var realConnection: WiiBalanceBoardHidConnection? = null
        private var currentListener: BalanceBoardListener? = null
        private var isUsingMockConnection = false

        override val isRunning: Boolean
            get() =
                if (isUsingMockConnection) {
                    mockConnection != null
                } else {
                    realConnection?.isConnected == true
                }

        override fun start(listener: BalanceBoardListener): Boolean {
            stop()
            currentListener = listener

            val isMockMode = sharedPreferences.getBoolean(PreferenceKeys.MOCK_MODE_ENABLED, false)

            return if (isMockMode) {
                startMockConnection(listener)
            } else {
                startRealConnection(listener)
            }
        }

        private fun startMockConnection(listener: BalanceBoardListener): Boolean {
            mockConnection =
                MockBalanceBoardConnection(listener).also {
                    it.start()
                }
            isUsingMockConnection = true
            return true
        }

        private fun startRealConnection(listener: BalanceBoardListener): Boolean {
            val adapter =
                bluetoothAdapter ?: run {
                    listener.onError("Bluetooth adapter not available")
                    return false
                }

            // Get the selected device
            val selectedDevice =
                runBlocking {
                    deviceDao.getSelectedDeviceOnce()
                }

            if (selectedDevice == null) {
                listener.onError("No device selected. Please select a device in the Devices page.")
                return false
            }

            val device = selectedDevice.toDevice()
            val macAddress =
                device.macAddress ?: run {
                    listener.onError("Device has no MAC address")
                    return false
                }

            val bluetoothDevice =
                try {
                    adapter.getRemoteDevice(macAddress)
                } catch (e: IllegalArgumentException) {
                    listener.onError("Invalid MAC address: $macAddress")
                    return false
                }

            realConnection =
                WiiBalanceBoardHidConnection(
                    bluetoothAdapter = adapter,
                    context = context,
                    device = bluetoothDevice,
                    listener = listener,
                ).also {
                    it.connect()
                }
            isUsingMockConnection = false
            return true
        }

        override fun stop() {
            if (isUsingMockConnection) {
                mockConnection?.stop()
                mockConnection = null
            } else {
                realConnection?.close()
                realConnection = null
            }
            currentListener = null
        }

        override fun tare() {
            if (isUsingMockConnection) {
                mockConnection?.tare()
            } else {
                realConnection?.tare()
            }
        }
    }
