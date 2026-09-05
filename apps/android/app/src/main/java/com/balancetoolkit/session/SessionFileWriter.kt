package com.balancetoolkit.session

import android.content.Context
import android.net.Uri
import android.os.Environment
import android.provider.DocumentsContract
import com.balancetoolkit.bluetooth.SensorReading
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.BufferedWriter
import java.io.File
import java.io.FileWriter
import java.io.OutputStreamWriter
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
    private var rawFileName: String? = null
    private var outputMode: OutputMode? = null
    private var lastFlushTimestampMs: Long = 0L

    private val writerMutex = Mutex()
    private val timestampFormatter =
        SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSSSS'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }

    private val json =
        Json {
            prettyPrint = true
            encodeDefaults = true
        }

    companion object {
        private const val RAW_CSV_HEADER = "timestamp,top_right,bottom_right,top_left,bottom_left\n"
        private const val RAW_FILE_MIME_TYPE = "text/csv"
        private const val SETTINGS_FILE_MIME_TYPE = "application/json"
        private const val FLUSH_INTERVAL_MS = 250L

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

    private sealed interface OutputMode {
        data class FileSystem(
            val outputDir: File,
        ) : OutputMode

        data class SafTree(
            val treeUri: Uri,
            val treeDocumentUri: Uri,
        ) : OutputMode
    }

    /**
     * Initializes the file writer and creates necessary files.
     * Should be called when a session starts.
     */
    suspend fun initialize(): Result<Unit> =
        withContext(Dispatchers.IO) {
            writerMutex.withLock {
                try {
                    sessionStartTime = System.currentTimeMillis()
                    val mode = resolveOutputMode()
                    outputMode = mode

                    val sanitizedDeviceName = deviceName.replace(" ", "_")
                    val sanitizedMac = deviceMacAddress.replace(":", "")
                    rawFileName = "$sessionId-$sanitizedDeviceName-$sanitizedMac-raw.csv"

                    val writer =
                        when (mode) {
                            is OutputMode.FileSystem -> {
                                val rawFile = File(mode.outputDir, rawFileName!!)
                                BufferedWriter(FileWriter(rawFile))
                            }

                            is OutputMode.SafTree -> {
                                val rawFileUri = createSafDocument(mode.treeDocumentUri, RAW_FILE_MIME_TYPE, rawFileName!!)
                                openBufferedWriter(rawFileUri)
                            }
                        }

                    rawDataWriter = writer
                    writer.write(RAW_CSV_HEADER)
                    writer.flush()
                    rawEventsWritten = 0
                    lastFlushTimestampMs = System.currentTimeMillis()

                    Result.success(Unit)
                } catch (e: Exception) {
                    Result.failure(e)
                }
            }
        }

    /**
     * Writes a sensor reading to the raw data CSV file.
     */
    suspend fun writeReading(reading: SensorReading): Result<Unit> =
        withContext(Dispatchers.IO) {
            writerMutex.withLock {
                try {
                    val writer =
                        rawDataWriter ?: return@withLock Result.failure(IllegalStateException("Session file writer is not initialized"))
                    val timestamp = getCurrentTimestamp()
                    val line = "$timestamp,${reading.topRight},${reading.bottomRight},${reading.topLeft},${reading.bottomLeft}\n"
                    writer.write(line)
                    rawEventsWritten++

                    val now = System.currentTimeMillis()
                    if (now - lastFlushTimestampMs >= FLUSH_INTERVAL_MS) {
                        writer.flush()
                        lastFlushTimestampMs = now
                    }

                    Result.success(Unit)
                } catch (e: Exception) {
                    Result.failure(e)
                }
            }
        }

    /**
     * Writes the session configuration/settings JSON file.
     * Should be called when the session ends.
     */
    suspend fun writeSessionConfiguration(configuration: SessionConfiguration): Result<String> =
        withContext(Dispatchers.IO) {
            writerMutex.withLock {
                try {
                    rawDataWriter?.flush()

                    val settingsFileName = "$sessionId.settings.json"

                    val duration = System.currentTimeMillis() - sessionStartTime
                    val durationSeconds = duration / 1000.0
                    val samplingRate =
                        if (durationSeconds > 0) {
                            rawEventsWritten / durationSeconds
                        } else {
                            0.0
                        }

                    val configWithStats =
                        configuration.copy(
                            sessionStats =
                                SessionStats(
                                    boardSamplingRate = samplingRate,
                                    durationMs = duration,
                                ),
                            deviceFileMappings =
                                mapOf(
                                    deviceMacAddress to
                                        FileNameMapping(
                                            rawFileName = rawFileName ?: "",
                                        ),
                                ),
                        )

                    val jsonContent = json.encodeToString(configWithStats)
                    val mode = outputMode ?: return@withLock Result.failure(IllegalStateException("Session output is not initialized"))

                    when (mode) {
                        is OutputMode.FileSystem -> {
                            val settingsFile = File(mode.outputDir, settingsFileName)
                            settingsFile.writeText(jsonContent)
                            Result.success(settingsFile.absolutePath)
                        }

                        is OutputMode.SafTree -> {
                            val settingsFileUri = createSafDocument(mode.treeDocumentUri, SETTINGS_FILE_MIME_TYPE, settingsFileName)
                            context.contentResolver.openOutputStream(settingsFileUri, "wt")?.use { outputStream ->
                                outputStream.write(jsonContent.toByteArray())
                                outputStream.flush()
                            } ?: return@withLock Result.failure(IllegalStateException("Failed to open output stream for settings file"))
                            Result.success(settingsFileUri.toString())
                        }
                    }
                } catch (e: Exception) {
                    Result.failure(e)
                }
            }
        }

    /**
     * Closes the file writer and releases resources.
     * Should be called when the session ends.
     */
    suspend fun close(): Result<Unit> =
        withContext(Dispatchers.IO) {
            writerMutex.withLock {
                try {
                    rawDataWriter?.flush()
                    rawDataWriter?.close()
                    rawDataWriter = null
                    Result.success(Unit)
                } catch (e: Exception) {
                    Result.failure(e)
                }
            }
        }

    /**
     * Gets the current timestamp in RFC3339 format with microsecond precision.
     */
    private fun getCurrentTimestamp(): String = timestampFormatter.format(Date())

    private fun resolveOutputMode(): OutputMode {
        if (outputDirectory.startsWith("content://")) {
            val treeUri = Uri.parse(outputDirectory)
            val treeDocId = DocumentsContract.getTreeDocumentId(treeUri)
            val treeDocumentUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, treeDocId)
            return OutputMode.SafTree(treeUri = treeUri, treeDocumentUri = treeDocumentUri)
        }

        val outputDir = File(outputDirectory)
        if (!outputDir.exists() && !outputDir.mkdirs()) {
            throw IllegalStateException("Unable to create output directory: $outputDirectory")
        }
        if (!outputDir.isDirectory) {
            throw IllegalStateException("Output path is not a directory: $outputDirectory")
        }
        return OutputMode.FileSystem(outputDir)
    }

    private fun createSafDocument(
        parentDocumentUri: Uri,
        mimeType: String,
        displayName: String,
    ): Uri =
        DocumentsContract
            .createDocument(context.contentResolver, parentDocumentUri, mimeType, displayName)
            ?: throw IllegalStateException("Failed to create SAF document: $displayName")

    private fun openBufferedWriter(uri: Uri): BufferedWriter {
        val outputStream =
            context.contentResolver.openOutputStream(uri, "wt")
                ?: throw IllegalStateException("Failed to open output stream for URI: $uri")
        return BufferedWriter(OutputStreamWriter(outputStream))
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
