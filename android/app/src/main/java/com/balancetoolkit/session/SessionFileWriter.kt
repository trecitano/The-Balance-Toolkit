package com.balancetoolkit.session

import android.content.Context
import android.os.Environment
import com.balancetoolkit.bluetooth.SensorReading
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.File
import java.io.FileWriter
import java.io.BufferedWriter
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * Handles writing session data to files during a recording session.
 * Creates two files per session:
 * 1. Raw data CSV file with sensor readings
 * 2. Settings JSON file with session configuration and user info
 */
class SessionFileWriter(
    private val context: Context,
    private val outputDirectory: String,
    private val sessionId: String,
    private val deviceName: String,
    private val deviceMacAddress: String,
) {
    private var rawDataWriter: BufferedWriter? = null
    private var rawEventsWritten: Int = 0
    private var sessionStartTime: Long = 0L

    private val json = Json {
        prettyPrint = true
        encodeDefaults = true
    }

    companion object {
        private const val RAW_CSV_HEADER = "timestamp,top_right,bottom_right,top_left,bottom_left\n"

        /**
         * Generates a session ID based on current timestamp.
         * Format: tbt-YYYY-MM-DDTHH-MM-SS (matching Tauri app format)
         */
        fun generateSessionId(): String {
            val dateFormat = SimpleDateFormat("yyyy-MM-dd'T'HH-mm-ss", Locale.US)
            dateFormat.timeZone = TimeZone.getDefault()
            return "tbt-${dateFormat.format(Date())}"
        }

        /**
         * Gets the default sessions directory path.
         * Uses Documents/the-balance-toolkit/sessions/ for easy access via file managers.
         */
        @Suppress("DEPRECATION")
        fun getDefaultSessionsDirectory(context: Context): String {
            // Use public Documents directory for easy access
            val documentsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS)
            return if (documentsDir != null) {
                File(documentsDir, "the-balance-toolkit/sessions").absolutePath
            } else {
                // Fallback to app's external files directory
                val externalFilesDir = context.getExternalFilesDir(null)
                if (externalFilesDir != null) {
                    File(externalFilesDir, "sessions").absolutePath
                } else {
                    // Final fallback to internal storage
                    File(context.filesDir, "sessions").absolutePath
                }
            }
        }
    }

    /**
     * Initializes the file writer and creates necessary files.
     * Should be called when a session starts.
     */
    suspend fun initialize(): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            sessionStartTime = System.currentTimeMillis()

            // Ensure output directory exists
            val outputDir = File(outputDirectory)
            if (!outputDir.exists()) {
                outputDir.mkdirs()
            }

            // Create raw data CSV file
            val sanitizedDeviceName = deviceName.replace(" ", "_")
            val sanitizedMac = deviceMacAddress.replace(":", "")
            val rawFileName = "$sessionId-$sanitizedDeviceName-$sanitizedMac-raw.csv"
            val rawFile = File(outputDir, rawFileName)

            rawDataWriter = BufferedWriter(FileWriter(rawFile))
            rawDataWriter?.write(RAW_CSV_HEADER)
            rawDataWriter?.flush()

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Writes a sensor reading to the raw data CSV file.
     */
    suspend fun writeReading(reading: SensorReading): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            rawDataWriter?.let { writer ->
                val timestamp = getCurrentTimestamp()
                val line = "$timestamp,${reading.topRight},${reading.bottomRight},${reading.topLeft},${reading.bottomLeft}\n"
                writer.write(line)
                writer.flush()
                rawEventsWritten++
            }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Writes the session configuration/settings JSON file.
     * Should be called when the session ends.
     */
    suspend fun writeSessionConfiguration(configuration: SessionConfiguration): Result<String> = withContext(Dispatchers.IO) {
        try {
            val outputDir = File(outputDirectory)
            val settingsFileName = "$sessionId.settings.json"
            val settingsFile = File(outputDir, settingsFileName)

            // Calculate session stats
            val duration = System.currentTimeMillis() - sessionStartTime
            val durationSeconds = duration / 1000.0
            val samplingRate = if (durationSeconds > 0) {
                rawEventsWritten / durationSeconds
            } else {
                0.0
            }

            // Create the file mapping
            val sanitizedDeviceName = deviceName.replace(" ", "_")
            val sanitizedMac = deviceMacAddress.replace(":", "")
            val rawFileName = "$sessionId-$sanitizedDeviceName-$sanitizedMac-raw.csv"

            val configWithStats = configuration.copy(
                sessionStats = SessionStats(
                    boardSamplingRate = samplingRate,
                    durationMs = duration,
                ),
                deviceFileMappings = mapOf(
                    deviceMacAddress to FileNameMapping(
                        rawFileName = rawFileName,
                    )
                )
            )

            val jsonContent = json.encodeToString(configWithStats)
            settingsFile.writeText(jsonContent)

            Result.success(settingsFile.absolutePath)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Closes the file writer and releases resources.
     * Should be called when the session ends.
     */
    suspend fun close(): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            rawDataWriter?.close()
            rawDataWriter = null
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Gets the current timestamp in RFC3339 format with microsecond precision.
     */
    private fun getCurrentTimestamp(): String {
        val dateFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSSSS'Z'", Locale.US)
        dateFormat.timeZone = TimeZone.getTimeZone("UTC")
        return dateFormat.format(Date())
    }

    /**
     * Returns the number of raw events written so far.
     */
    fun getRawEventsWritten(): Int = rawEventsWritten

    /**
     * Returns the session start time.
     */
    fun getSessionStartTime(): Long = sessionStartTime
}
