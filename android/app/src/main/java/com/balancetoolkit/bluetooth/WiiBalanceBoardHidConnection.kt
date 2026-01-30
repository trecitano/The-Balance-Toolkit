package com.balancetoolkit.bluetooth

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothProfile
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.util.Log
import org.lsposed.hiddenapibypass.HiddenApiBypass
import java.lang.reflect.Method

class WiiBalanceBoardHidConnection(
    private val bluetoothAdapter: BluetoothAdapter,
    private val context: Context,
    private val device: BluetoothDevice,
    private val listener: BalanceBoardListener
) {

    companion object {
        private const val TAG = "WiiBalanceBoard"

        private const val HID_HOST_PROFILE = 4
        private const val REPORT_TYPE_OUTPUT: Byte = 0x02
        private const val REPORT_TYPE_INPUT: Byte = 0x01

        // Report IDs
        private const val REPORT_MEMORY: Byte = 0x21
        private const val REPORT_BUTTONS_EXTENSION: Byte = 0x32

        // Commands
        private val CMD_LED_ON = byteArrayOf(0x11, 0x10)
        private val CMD_START_READING = byteArrayOf(0x12, 0x00, 0x32)

        private val CMD_READ_CALIBRATION_0KG = byteArrayOf(
            0x17,                         // Read memory command
            0x04,                         // Address space
            0xA4.toByte(), 0x00, 0x20,    // Full address: 0xA40020
            0x00, 0x10                    // Size: 32 bytes
        )

        private val CMD_READ_CALIBRATION_17KG = byteArrayOf(
            0x17,                         // Read memory command
            0x04,                         // Address space
            0xA4.toByte(), 0x00, 0x30,    // Full address: 0xA40030
            0x00, 0x10                    // Size: 32 bytes
        )

        const val ACTION_REPORT = "android.bluetooth.input.profile.action.REPORT"
        const val EXTRA_REPORT = "android.bluetooth.BluetoothHidHost.extra.REPORT"
    }

    data class SensorCalibration(val kg0: Int, val kg17: Int, val kg34: Int)

    data class Calibration(
        val topRight: SensorCalibration,
        val bottomRight: SensorCalibration,
        val topLeft: SensorCalibration,
        val bottomLeft: SensorCalibration
    )

    private var hidHostProxy: Any? = null
    private var setReportMethod: Method? = null
    private var getReportMethod: Method? = null
    private var reportReceiver: BroadcastReceiver? = null

    private var pollingThread: Thread? = null
    @Volatile private var pollingReportId: Byte = REPORT_BUTTONS_EXTENSION

    var isConnected = false
        private set

    private var calibration: Calibration? = null
    private var pendingCalibrationData = mutableMapOf<Int, ByteArray>()

    init {
        HiddenApiBypass.addHiddenApiExemptions("")
    }

    private val tareManager = TareManager()

    fun connect() {
        listener.onLog("Connecting to HID service...")

        val profileListener = object : BluetoothProfile.ServiceListener {
            override fun onServiceConnected(profile: Int, proxy: BluetoothProfile) {
                hidHostProxy = proxy

                try {
                    val proxyClass = proxy.javaClass

                    setReportMethod = HiddenApiBypass.getDeclaredMethod(
                        proxyClass,
                        "setReport",
                        BluetoothDevice::class.java,
                        Byte::class.javaPrimitiveType,
                        String::class.java
                    )

                    getReportMethod = HiddenApiBypass.getDeclaredMethod(
                        proxyClass,
                        "getReport",
                        BluetoothDevice::class.java,
                        Byte::class.javaPrimitiveType,
                        Byte::class.javaPrimitiveType,
                        Int::class.javaPrimitiveType
                    )

                    isConnected = proxy.connectedDevices.contains(device)

                    if (isConnected) {
                        listener.onLog("✓ HID connected")
                        registerReportReceiver()
                        Thread { initialize() }.start()
                    } else {
                        listener.onError("Device not connected via HID")
                    }
                } catch (e: Exception) {
                    listener.onError("Failed to setup HID: ${e.message}")
                }
            }

            override fun onServiceDisconnected(profile: Int) {
                isConnected = false
                hidHostProxy = null
                stopPolling()
            }
        }

        bluetoothAdapter.getProfileProxy(context, profileListener, HID_HOST_PROFILE)
    }

    private fun initialize() {
        try {
            listener.onLog("Initializing board...")

            // Start polling for memory responses (calibration)
            startPolling(REPORT_MEMORY)

            Thread.sleep(200)
            sendCommand(CMD_LED_ON)
            listener.onLog("  LED on")

            Thread.sleep(100)
            loadCalibration()

            if (calibration != null) {
                listener.onLog("✓ Calibration loaded")

                // Switch to polling for sensor data
                setPollingReportId(REPORT_BUTTONS_EXTENSION)

                Thread.sleep(100)
                sendCommand(CMD_START_READING)
                listener.onLog("✓ Reading started")
            } else {
                listener.onError("Failed to load calibration")
            }
        } catch (e: Exception) {
            listener.onError("Init failed: ${e.message}")
        }
    }

    private fun loadCalibration() {
        pendingCalibrationData.clear()

        listener.onLog("  Reading calibration...")

        sendCommand(CMD_READ_CALIBRATION_0KG)
        Thread.sleep(200)
        sendCommand(CMD_READ_CALIBRATION_17KG)

        Thread.sleep(1000)

        if (pendingCalibrationData.size >= 2) {
            parseCalibration()
        } else {
            listener.onLog("  Calibration timeout (got ${pendingCalibrationData.size}/2)")
        }
    }

    private fun parseCalibration() {
        try {
            val firstHalf = pendingCalibrationData[0x20] ?: run {
                listener.onLog("  Missing calibration data at 0x20")
                return
            }
            val secondHalf = pendingCalibrationData[0x30] ?: run {
                listener.onLog("  Missing calibration data at 0x30")
                return
            }

            // Combine into full 32-byte calibration data (0x20-0x3F)
            val data = firstHalf + secondHalf

            if (data.size < 28) {
                listener.onError("Calibration data too short: ${data.size} bytes")
                return
            }

            // Offsets relative to 0x20 (start of fullData)
            // 0kg values at 0x24-0x2B (offsets 4-11)
            val tr0kg = readU16(data, 4)
            val br0kg = readU16(data, 6)
            val tl0kg = readU16(data, 8)
            val bl0kg = readU16(data, 10)

            // 17kg values at 0x2C-0x33 (offsets 12-19)
            val tr17kg = readU16(data, 12)
            val br17kg = readU16(data, 14)
            val tl17kg = readU16(data, 16)
            val bl17kg = readU16(data, 18)

            // 34kg values at 0x34-0x3B (offsets 20-27)
            val tr34kg = readU16(data, 20)
            val br34kg = readU16(data, 22)
            val tl34kg = readU16(data, 24)
            val bl34kg = readU16(data, 26)

            calibration = Calibration(
                topRight = SensorCalibration(tr0kg, tr17kg, tr34kg),
                bottomRight = SensorCalibration(br0kg, br17kg, br34kg),
                topLeft = SensorCalibration(tl0kg, tl17kg, tl34kg),
                bottomLeft = SensorCalibration(bl0kg, bl17kg, bl34kg)
            )

            Log.d(TAG, "Calibration parsed:")
            Log.d(TAG, "  TR: 0kg=$tr0kg, 17kg=$tr17kg, 34kg=$tr34kg")
            Log.d(TAG, "  BR: 0kg=$br0kg, 17kg=$br17kg, 34kg=$br34kg")
            Log.d(TAG, "  TL: 0kg=$tl0kg, 17kg=$tl17kg, 34kg=$tl34kg")
            Log.d(TAG, "  BL: 0kg=$bl0kg, 17kg=$bl17kg, 34kg=$bl34kg")

        } catch (e: Exception) {
            listener.onError("Parse calibration failed: ${e.message}")
        }
    }

    private fun registerReportReceiver() {
        reportReceiver = object : BroadcastReceiver() {
            override fun onReceive(ctx: Context, intent: Intent) {
                if (intent.action != ACTION_REPORT) return

                val reportDevice = intent.getParcelableExtra(
                    BluetoothDevice.EXTRA_DEVICE,
                    BluetoothDevice::class.java
                )
                if (reportDevice?.address != device.address) return

                val report = intent.getByteArrayExtra(EXTRA_REPORT) ?: return

                handleReport(report)
            }
        }

        val filter = IntentFilter(ACTION_REPORT)
        context.registerReceiver(reportReceiver, filter, Context.RECEIVER_EXPORTED)
    }

    fun tare() {
        tareManager.requestTare()
    }

    private fun handleReport(data: ByteArray) {
        if (data.isEmpty()) return

        val reportId = data[0].toInt() and 0xFF

        when (reportId) {
            0x21 -> handleMemoryResponse(data)
            0x32, 0x34 -> handleSensorData(data)
        }
    }

    private fun handleMemoryResponse(data: ByteArray) {
        if (data.size < 7) return

        val sizeError = data[3].toInt() and 0xFF
        val error = sizeError and 0x0F

        if (error != 0) {
            Log.e(TAG, "Memory read error: $error")
            return
        }

        val address = ((data[4].toInt() and 0xFF) shl 8) or (data[5].toInt() and 0xFF)
        val payload = data.copyOfRange(6, data.size)

        pendingCalibrationData[address and 0xFF] = payload
    }

    private fun handleSensorData(data: ByteArray) {
        val cal = calibration ?: return

        val offset = 3
        if (data.size < offset + 8) return

        val trRaw = readU16(data, offset)
        val brRaw = readU16(data, offset + 2)
        val tlRaw = readU16(data, offset + 4)
        val blRaw = readU16(data, offset + 6)

        fun toKg(raw: Int, sensor: SensorCalibration): Float {
            val rawF = raw.toFloat()
            val kg0F = sensor.kg0.toFloat()
            val kg17F = sensor.kg17.toFloat()
            val kg34F = sensor.kg34.toFloat()

            return if (rawF < kg17F) {
                17f * (rawF - kg0F) / (kg17F - kg0F).coerceAtLeast(1f)
            } else {
                17f + 17f * (rawF - kg17F) / (kg34F - kg17F).coerceAtLeast(1f)
            }
        }

        val tr = toKg(trRaw, cal.topRight)
        val br = toKg(brRaw, cal.bottomRight)
        val tl = toKg(tlRaw, cal.topLeft)
        val bl = toKg(blRaw, cal.bottomLeft)

        val rawReading = SensorReading(
            topLeft = tl,
            topRight = tr,
            bottomLeft = bl,
            bottomRight = br,
        )

        val taredReading = tareManager.applyTare(rawReading) { tare ->
            listener.onLog(
                "Tare set: TL=%.1f TR=%.1f BL=%.1f BR=%.1f".format(
                    tare.topLeft, tare.topRight, tare.bottomLeft, tare.bottomRight
                )
            )
        }

        listener.onWeightData(
            taredReading.topLeft,
            taredReading.topRight,
            taredReading.bottomLeft,
            taredReading.bottomRight,
        )
    }

    private fun requestReport(reportId: Byte, bufferSize: Int = 32): Boolean {
        if (!isConnected) return false

        return try {
            getReportMethod?.invoke(
                hidHostProxy,
                device,
                REPORT_TYPE_INPUT,
                reportId,
                bufferSize
            ) as? Boolean ?: false
        } catch (e: Exception) {
            Log.e(TAG, "Failed to request report", e)
            false
        }
    }

    private fun setPollingReportId(reportId: Byte) {
        pollingReportId = reportId
        Log.d(TAG, "Polling switched to report %02X".format(reportId.toInt() and 0xFF))
    }

    private fun startPolling(reportId: Byte, intervalMs: Long = 16) {
        pollingReportId = reportId

        pollingThread = Thread {
            Log.d(TAG, "Polling started for report %02X".format(reportId.toInt() and 0xFF))
            while (isConnected) {
                requestReport(pollingReportId)
                try {
                    Thread.sleep(intervalMs)
                } catch (_: InterruptedException) {
                    break
                }
            }
            Log.d(TAG, "Polling stopped")
        }.apply {
            name = "WiiBoard-Polling"
            start()
        }
    }

    private fun stopPolling() {
        pollingThread?.interrupt()
        pollingThread = null
    }

    private fun sendCommand(data: ByteArray): Boolean {
        if (!isConnected) return false

        return try {
            val report = data.joinToString("") { "%02x".format(it) }
            val result = setReportMethod?.invoke(
                hidHostProxy,
                device,
                REPORT_TYPE_OUTPUT,
                report
            ) as? Boolean ?: false

            Log.d(TAG, "Send ${data.toHexString()}: $result")
            result
        } catch (e: Exception) {
            Log.e(TAG, "Send failed", e)
            false
        }
    }

    fun close() {
        stopPolling()

        reportReceiver?.let {
            try {
                context.unregisterReceiver(it)
            } catch (_: Exception) {}
        }
        reportReceiver = null
        bluetoothAdapter.closeProfileProxy(HID_HOST_PROFILE, hidHostProxy as? BluetoothProfile)

        hidHostProxy = null
        isConnected = false
    }

    fun readU16(data: ByteArray, off: Int): Int {
        return ((data[off].toInt() and 0xFF) shl 8) or (data[off + 1].toInt() and 0xFF)
    }

    private fun ByteArray.toHexString() = joinToString(" ") { "%02X".format(it) }
}