package com.balancetoolkit.viewmodel

import android.content.Context
import android.content.SharedPreferences
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.balancetoolkit.bluetooth.BalanceBoardConnectionManager
import com.balancetoolkit.bluetooth.FullDataListener
import com.balancetoolkit.bluetooth.SensorReading
import com.balancetoolkit.data.PreferenceKeys
import com.balancetoolkit.data.local.dao.DeviceDao
import com.balancetoolkit.data.local.dao.UserDao
import com.balancetoolkit.data.local.entity.toUser
import com.balancetoolkit.data.model.User
import com.balancetoolkit.session.SessionConfiguration
import com.balancetoolkit.session.SessionFileWriter
import com.balancetoolkit.session.SessionUser
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.io.File
import javax.inject.Inject

/**
 * Represents a Center of Pressure (CoP) position on the balance board.
 * Coordinates are normalized to [-1, 1] range.
 * X: -1 = full left, +1 = full right
 * Y: -1 = full back, +1 = full front
 * Z: total force in kg (used for VSI calculation)
 */
data class CopPosition(
    val x: Float = 0f,
    val y: Float = 0f,
    val z: Float = 0f, // Total force for VSI calculation
    val timestampMs: Long = System.currentTimeMillis()
)

/**
 * Dynamic Postural Stability Index metrics.
 * MLSI: Medial-Lateral Stability Index (RMS of X)
 * APSI: Anterior-Posterior Stability Index (RMS of Y)
 * VSI: Vertical Stability Index (RMS of force deviation from baseline)
 * DPSI: Combined Dynamic Postural Stability Index
 */
data class DpsiMetrics(
    val mlsi: Float = 0f,
    val apsi: Float = 0f,
    val vsi: Float = 0f,
    val dpsi: Float = 0f
)

/**
 * FFT Amplitude Spectrum data.
 * Contains frequencies and corresponding amplitudes for X, Y, and combined signals.
 */
data class AmplitudeSpectrum(
    val freqsHz: List<Float> = emptyList(),
    val amplitudeX: List<Float> = emptyList(),
    val amplitudeY: List<Float> = emptyList(),
    val amplitudeXY: List<Float> = emptyList()
)

data class SessionUiState(
    val deviceName: String = "Nintendo RVL-WBC-01",
    val deviceMacAddress: String = "00:23:31:87:14:14",
    val currentLoop: Int = 2,
    val totalLoops: Int = 10,
    val currentTime: String = "00:22:02:10",
    val sliderPosition: Float = 0.3f,
    val startTime: Float = 4.0f,
    val endTime: Float = 13f,
    val isPlaying: Boolean = false,
    // Visualization toggles
    val showConfidenceEllipse: Boolean = true,
    val showConvexHull: Boolean = true,
    // FFT chart toggles
    val showMlSi: Boolean = true,
    val showApSi: Boolean = false,
    val showVsi: Boolean = true,
    val showDpsi: Boolean = false,
    // Direction values
    val leftValue: Int = 0,
    val rightValue: Int = 0,
    val frontValue: Int = 0,
    // Real-time data
    val isRecording: Boolean = false,
    val isMockMode: Boolean = false,
    val currentCop: CopPosition = CopPosition(),
    val currentReading: SensorReading = SensorReading(),
    // CoP trail for visualization (last N positions)
    val copTrail: List<CopPosition> = emptyList(),
    // Velocity metrics (vCopX, vCopY are mean absolute velocities)
    val vCopX: Float = 0f,
    val vCopY: Float = 0f,
    // Velocity trails for plotting (instantaneous velocity at each point)
    val vCopXTrail: List<Float> = emptyList(),
    val vCopYTrail: List<Float> = emptyList(),
    // DPSI metrics
    val dpsiMetrics: DpsiMetrics = DpsiMetrics(),
    // DPSI metric trails for plotting
    val mlsiTrail: List<Float> = emptyList(),
    val apsiTrail: List<Float> = emptyList(),
    val vsiTrail: List<Float> = emptyList(),
    val dpsiTrail: List<Float> = emptyList(),
    // FFT Amplitude Spectrum
    val amplitudeSpectrum: AmplitudeSpectrum = AmplitudeSpectrum(),
    // FFT display toggles
    val showFftX: Boolean = true,
    val showFftY: Boolean = true,
    val showFftCombined: Boolean = true,
    // Confidence ellipse points (for 95% confidence)
    val confidenceEllipsePoints: List<Pair<Float, Float>> = emptyList(),
    // Log messages
    val logMessages: List<String> = emptyList(),
    // Session file writing
    val sessionId: String = "",
    val isWritingToFile: Boolean = false,
    val lastSavedFilePath: String? = null,
    // Device connection status
    val hasConnectedDevice: Boolean = false,
    // Selected user
    val selectedUser: User? = null,
    // Reading frequency in Hz
    val readingFrequencyHz: Float = 0f,
    // Session start timestamp (for UI protection)
    val sessionStartTimeMs: Long = 0L,
) {
    val canStartSession: Boolean
        get() = isMockMode || hasConnectedDevice

    // Protect checkboxes from accidental changes for 500ms after session start
    val isSessionStarting: Boolean
        get() = isRecording && (System.currentTimeMillis() - sessionStartTimeMs) < 500L
}

@HiltViewModel
class SessionViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val sharedPreferences: SharedPreferences,
    private val userDao: UserDao,
    private val deviceDao: DeviceDao,
    private val connectionManager: BalanceBoardConnectionManager,
) : ViewModel() {
    private val _uiState = MutableStateFlow(SessionUiState())
    val uiState: StateFlow<SessionUiState> = _uiState.asStateFlow()

    private var sessionFileWriter: SessionFileWriter? = null
    private var currentUserId: String? = null

    companion object {
        // Maximum trail length to keep (10 seconds at 100Hz = 1000 points)
        private const val MAX_TRAIL_LENGTH = 1000
        // Number of samples to average for frequency calculation
        private const val FREQUENCY_SAMPLE_COUNT = 20
        // Interval for derived metrics (FFT, velocity, DPSI) - 50ms = 20 Hz
        private const val METRICS_COMPUTE_INTERVAL_MS = 50L
    }

    // For frequency calculation
    private var lastReadingTimestampMs: Long = 0L
    private val recentIntervals = mutableListOf<Long>()

    // For metrics throttling
    private var lastMetricsComputeMs: Long = 0L

    // For checkbox debouncing (prevent spurious toggles)
    private var lastConvexHullToggleMs: Long = 0L
    private var lastEllipseToggleMs: Long = 0L
    private val TOGGLE_DEBOUNCE_MS = 300L

    // Cached metrics computation results
    private var cachedVCopX = 0f
    private var cachedVCopY = 0f
    private var cachedVCopXTrail = emptyList<Float>()
    private var cachedVCopYTrail = emptyList<Float>()
    private var cachedDpsiMetrics = DpsiMetrics()
    private var cachedMlsiTrail = emptyList<Float>()
    private var cachedApsiTrail = emptyList<Float>()
    private var cachedVsiTrail = emptyList<Float>()
    private var cachedDpsiTrail = emptyList<Float>()
    private var cachedAmplitudeSpectrum = AmplitudeSpectrum()
    private var cachedConfidenceEllipse = emptyList<Pair<Float, Float>>()

    init {
        // Load the selected user ID
        currentUserId = sharedPreferences.getString(PreferenceKeys.SELECTED_USER_ID, null)
        // Load mock mode setting
        val isMockMode = sharedPreferences.getBoolean(PreferenceKeys.MOCK_MODE_ENABLED, false)
        _uiState.update { it.copy(isMockMode = isMockMode) }
        // Load selected user
        loadSelectedUser()
        // Observe connected devices
        observeConnectedDevices()
    }

    private fun loadSelectedUser() {
        val userId = currentUserId ?: return
        viewModelScope.launch(Dispatchers.IO) {
            try {
                val user = userDao.getUserById(userId)?.toUser()
                _uiState.update { it.copy(selectedUser = user) }
            } catch (e: Exception) {
                // Ignore errors loading user
            }
        }
    }

    private fun observeConnectedDevices() {
        viewModelScope.launch {
            deviceDao.getConnectedDevices().collect { connectedDevices ->
                _uiState.update { it.copy(hasConnectedDevice = connectedDevices.isNotEmpty()) }
            }
        }
    }

    private fun getSessionsDirectory(): String {
        return sharedPreferences.getString(PreferenceKeys.SESSIONS_DIRECTORY, null)
            ?: getDefaultSessionsDirectory()
    }

    private fun getDefaultSessionsDirectory(): String {
        // Use app's external files directory which doesn't require permissions
        val externalFilesDir = context.getExternalFilesDir(null)
        return if (externalFilesDir != null) {
            File(externalFilesDir, "sessions").absolutePath
        } else {
            // Fallback to internal storage
            File(context.filesDir, "sessions").absolutePath
        }
    }

    private val sensorDataListener = FullDataListener(
        onData = { topLeft, topRight, bottomLeft, bottomRight ->
            viewModelScope.launch(Dispatchers.Main) {
                updateSensorData(topLeft, topRight, bottomLeft, bottomRight)
            }
        },
        onLogMessage = { message -> addLogMessage(message) },
        onErrorMessage = { message -> addLogMessage("ERROR: $message") },
    )

    /**
     * Start a recording session.
     * The connection manager handles whether to use mock or real board based on settings.
     */
    fun startSession() {
        if (_uiState.value.isRecording) return

        // Reset frequency tracking
        lastReadingTimestampMs = 0L
        recentIntervals.clear()

        // Reset metrics throttling state
        lastMetricsComputeMs = 0L
        cachedVCopX = 0f
        cachedVCopY = 0f
        cachedVCopXTrail = emptyList()
        cachedVCopYTrail = emptyList()
        cachedDpsiMetrics = DpsiMetrics()
        cachedMlsiTrail = emptyList()
        cachedApsiTrail = emptyList()
        cachedVsiTrail = emptyList()
        cachedDpsiTrail = emptyList()
        cachedAmplitudeSpectrum = AmplitudeSpectrum()
        cachedConfidenceEllipse = emptyList()

        val sessionId = SessionFileWriter.generateSessionId()
        val state = _uiState.value

        // Initialize file writer
        viewModelScope.launch(Dispatchers.IO) {
            val writer = SessionFileWriter(
                context = context,
                outputDirectory = getSessionsDirectory(),
                sessionId = sessionId,
                deviceName = state.deviceName,
                deviceMacAddress = state.deviceMacAddress,
            )

            val result = writer.initialize()
            if (result.isSuccess) {
                sessionFileWriter = writer
                _uiState.update { it.copy(
                    sessionId = sessionId,
                    isWritingToFile = true,
                ) }
                addLogMessage("Session file writer initialized: $sessionId")
            } else {
                addLogMessage("Failed to initialize file writer: ${result.exceptionOrNull()?.message}")
            }
        }

        val started = connectionManager.start(sensorDataListener)
        if (started) {
            _uiState.update { it.copy(
                isRecording = true,
                isPlaying = true,
                copTrail = emptyList(),
                sessionId = sessionId,
                sessionStartTimeMs = System.currentTimeMillis(),
            ) }
        } else {
            addLogMessage("ERROR: Failed to start board connection")
        }
    }

    /**
     * Stop the current recording session.
     */
    fun stopSession() {
        connectionManager.stop()

        // Finalize file writing
        viewModelScope.launch(Dispatchers.IO) {
            sessionFileWriter?.let { writer ->
                // Load user data for the configuration file
                val userId = currentUserId
                val user = if (userId != null) {
                    try {
                        userDao.getUserById(userId)?.toUser()
                    } catch (e: Exception) {
                        null
                    }
                } else {
                    null
                }

                val state = _uiState.value
                val sessionUser = user?.let {
                    SessionUser(
                        id = it.id,
                        name = it.name,
                        age = it.age,
                        gender = it.gender.name,
                        height = it.height,
                        weight = it.weight,
                        dominantHand = it.dominantHand.name,
                        color = it.color,
                        updatedAt = it.updatedAt,
                    )
                } ?: SessionUser(
                    id = "unknown",
                    name = "Unknown User",
                )

                val configuration = SessionConfiguration(
                    user = sessionUser,
                    deviceNames = mapOf(state.deviceMacAddress to state.deviceName),
                )

                val result = writer.writeSessionConfiguration(configuration)
                result.onSuccess { filePath ->
                    _uiState.update { it.copy(lastSavedFilePath = filePath) }
                    addLogMessage("Session saved to: $filePath")
                }
                result.onFailure { error ->
                    addLogMessage("Failed to save session: ${error.message}")
                }

                writer.close()
                sessionFileWriter = null
            }

            _uiState.update { it.copy(isWritingToFile = false) }
        }

        _uiState.update { it.copy(
            isRecording = false,
            isPlaying = false
        ) }
    }

    /**
     * Apply tare (zero) to the current readings.
     */
    fun applyTare() {
        connectionManager.tare()
    }

    /**
     * Update sensor data and calculate derived values.
     * CoP and trail are updated in real-time.
     * FFT, velocity, and DPSI metrics are throttled to 50ms intervals.
     */
    private fun updateSensorData(topLeft: Float, topRight: Float, bottomLeft: Float, bottomRight: Float) {
        val reading = SensorReading(topLeft, topRight, bottomLeft, bottomRight)
        val cop = calculateCop(reading)
        val currentTimeMs = System.currentTimeMillis()

        // Calculate reading frequency (always, for accurate measurement)
        val frequencyHz = if (lastReadingTimestampMs > 0) {
            val interval = currentTimeMs - lastReadingTimestampMs
            if (interval > 0) {
                recentIntervals.add(interval)
                if (recentIntervals.size > FREQUENCY_SAMPLE_COUNT) {
                    recentIntervals.removeAt(0)
                }
                val avgInterval = recentIntervals.average()
                if (avgInterval > 0) (1000.0 / avgInterval).toFloat() else 0f
            } else 0f
        } else 0f
        lastReadingTimestampMs = currentTimeMs

        // Always write reading to file (no throttling for data capture)
        sessionFileWriter?.let { writer ->
            viewModelScope.launch(Dispatchers.IO) {
                writer.writeReading(reading)
            }
        }

        // Check if we should compute derived metrics (every 50ms)
        val shouldComputeMetrics = currentTimeMs - lastMetricsComputeMs >= METRICS_COMPUTE_INTERVAL_MS

        // Update UI state - CoP and trail are always real-time
        _uiState.update { state ->
            // Add current position to trail (real-time)
            val newTrail = (state.copTrail + cop).takeLast(MAX_TRAIL_LENGTH)

            // Compute derived metrics only at throttled intervals
            if (shouldComputeMetrics) {
                lastMetricsComputeMs = currentTimeMs

                // Calculate velocity metrics
                val (vCopX, vCopY, vCopXTrail, vCopYTrail) = calculateVelocityMetrics(newTrail)
                cachedVCopX = vCopX
                cachedVCopY = vCopY
                cachedVCopXTrail = vCopXTrail
                cachedVCopYTrail = vCopYTrail

                // Calculate DPSI metrics
                val dpsiMetrics = calculateDpsiMetrics(newTrail)
                cachedDpsiMetrics = dpsiMetrics
                cachedMlsiTrail = (state.mlsiTrail + dpsiMetrics.mlsi).takeLast(MAX_TRAIL_LENGTH)
                cachedApsiTrail = (state.apsiTrail + dpsiMetrics.apsi).takeLast(MAX_TRAIL_LENGTH)
                cachedVsiTrail = (state.vsiTrail + dpsiMetrics.vsi).takeLast(MAX_TRAIL_LENGTH)
                cachedDpsiTrail = (state.dpsiTrail + dpsiMetrics.dpsi).takeLast(MAX_TRAIL_LENGTH)

                // Calculate FFT amplitude spectrum
                cachedAmplitudeSpectrum = computeFftAmplitudeSpectrum(newTrail)

                // Generate confidence ellipse (95% confidence)
                cachedConfidenceEllipse = generateConfidenceEllipsePoints(newTrail)
            }

            state.copy(
                // Real-time updates
                currentReading = reading,
                currentCop = cop,
                copTrail = newTrail,
                readingFrequencyHz = frequencyHz,
                // Throttled metrics (use cached values)
                vCopX = cachedVCopX,
                vCopY = cachedVCopY,
                vCopXTrail = cachedVCopXTrail,
                vCopYTrail = cachedVCopYTrail,
                dpsiMetrics = cachedDpsiMetrics,
                mlsiTrail = cachedMlsiTrail,
                apsiTrail = cachedApsiTrail,
                vsiTrail = cachedVsiTrail,
                dpsiTrail = cachedDpsiTrail,
                amplitudeSpectrum = cachedAmplitudeSpectrum,
                confidenceEllipsePoints = cachedConfidenceEllipse,
                // Direction indicators (real-time)
                leftValue = if (cop.x < -0.1f) -1 else 0,
                rightValue = if (cop.x > 0.1f) 1 else 0,
                frontValue = if (cop.y > 0.1f) 1 else if (cop.y < -0.1f) -1 else 0
            )
        }
    }

    /**
     * Calculate velocity metrics from CoP trail.
     * Returns mean absolute velocities (vCopX, vCopY) and velocity trails.
     * Matches the Tauri/Rust implementation.
     */
    private fun calculateVelocityMetrics(trail: List<CopPosition>): VelocityMetrics {
        if (trail.size < 2) {
            return VelocityMetrics(0f, 0f, emptyList(), emptyList())
        }

        val velocitiesX = mutableListOf<Float>()
        val velocitiesY = mutableListOf<Float>()

        for (i in 1 until trail.size) {
            val dt = (trail[i].timestampMs - trail[i - 1].timestampMs) / 1000f // Convert to seconds

            if (dt > 0f) {
                val dx = trail[i].x - trail[i - 1].x
                val dy = trail[i].y - trail[i - 1].y

                // Instantaneous velocity (absolute value)
                velocitiesX.add(kotlin.math.abs(dx / dt))
                velocitiesY.add(kotlin.math.abs(dy / dt))
            }
        }

        if (velocitiesX.isEmpty()) {
            return VelocityMetrics(0f, 0f, emptyList(), emptyList())
        }

        // Mean absolute velocities
        val vCopX = velocitiesX.sum() / velocitiesX.size
        val vCopY = velocitiesY.sum() / velocitiesY.size

        return VelocityMetrics(vCopX, vCopY, velocitiesX, velocitiesY)
    }

    private data class VelocityMetrics(
        val vCopX: Float,
        val vCopY: Float,
        val vCopXTrail: List<Float>,
        val vCopYTrail: List<Float>
    )

    /**
     * Calculate Center of Pressure from sensor readings.
     * Returns normalized position in [-1, 1] range.
     * Matches the Tauri/Rust implementation for consistency.
     */
    private fun calculateCop(reading: SensorReading): CopPosition {
        val totalForce = reading.totalForce

        if (totalForce <= 0.1f) {
            return CopPosition(0f, 0f, 0f)
        }

        // Calculate CoP using weighted average of sensor positions
        // Sensor layout (from user's perspective standing on the board):
        //   TopLeft (TL)     TopRight (TR)      <- Front of board
        //   BottomLeft (BL)  BottomRight (BR)   <- Back of board
        //
        // X-axis: -1 = full left, +1 = full right
        // Y-axis: -1 = full back, +1 = full front

        val rightForce = reading.topRight + reading.bottomRight
        val leftForce = reading.topLeft + reading.bottomLeft
        val topForce = reading.topLeft + reading.topRight
        val bottomForce = reading.bottomLeft + reading.bottomRight

        // CoP X: normalized to [-1, 1] range
        val copX = (rightForce - leftForce) / totalForce

        // CoP Y: normalized to [-1, 1] range
        val copY = (topForce - bottomForce) / totalForce

        return CopPosition(copX, copY, totalForce)
    }

    /**
     * Calculate DPSI (Dynamic Postural Stability Index) metrics from CoP trail.
     * Matches the Tauri/Rust implementation.
     *
     * MLSI: Medial-Lateral Stability Index = sqrt(sum(x²) / n)
     * APSI: Anterior-Posterior Stability Index = sqrt(sum(y²) / n)
     * VSI: Vertical Stability Index = sqrt(sum((baseline - z)²) / n)
     * DPSI: Combined = sqrt((sum(x²) + sum(y²) + sum(zdiff²)) / n)
     */
    private fun calculateDpsiMetrics(trail: List<CopPosition>, baselineWeight: Float? = null): DpsiMetrics {
        if (trail.isEmpty()) {
            return DpsiMetrics()
        }

        val n = trail.size.toFloat()

        // Calculate baseline weight (average of all force values if not provided)
        val baseline = baselineWeight ?: (trail.sumOf { it.z.toDouble() } / n).toFloat()

        var sumX2 = 0f
        var sumY2 = 0f
        var sumZdiff2 = 0f

        for (point in trail) {
            sumX2 += point.x * point.x
            sumY2 += point.y * point.y
            val dz = baseline - point.z
            sumZdiff2 += dz * dz
        }

        val mlsi = kotlin.math.sqrt(sumX2 / n)
        val apsi = kotlin.math.sqrt(sumY2 / n)
        val vsi = kotlin.math.sqrt(sumZdiff2 / n)
        val dpsi = kotlin.math.sqrt((sumX2 + sumY2 + sumZdiff2) / n)

        return DpsiMetrics(mlsi, apsi, vsi, dpsi)
    }

    /**
     * Compute FFT Amplitude Spectrum from CoP trail.
     * Uses DFT (Discrete Fourier Transform) with Hann window.
     * Matches the Tauri/Rust implementation.
     *
     * @param trail CoP position trail with timestamps
     * @param maxHz Maximum frequency to include in output (default 2.0 Hz)
     * @return AmplitudeSpectrum with frequencies and amplitudes for X, Y, and combined
     */
    private fun computeFftAmplitudeSpectrum(
        trail: List<CopPosition>,
        maxHz: Float = 2.0f
    ): AmplitudeSpectrum {
        if (trail.size < 8) {
            return AmplitudeSpectrum()
        }

        val n = trail.size

        // Calculate sampling frequency from timestamps
        val dt = (trail[1].timestampMs - trail[0].timestampMs) / 1000f // seconds
        if (dt <= 0f) {
            return AmplitudeSpectrum()
        }
        val fs = 1f / dt // Sampling frequency in Hz

        // Demean the signals
        val meanX = trail.map { it.x }.average().toFloat()
        val meanY = trail.map { it.y }.average().toFloat()

        val x = trail.map { it.x - meanX }.toMutableList()
        val y = trail.map { it.y - meanY }.toMutableList()

        // Apply Hann window
        var coherentGain = 0f
        for (i in 0 until n) {
            val w = (0.5f - 0.5f * kotlin.math.cos(2f * kotlin.math.PI.toFloat() * i / (n - 1)))
            coherentGain += w
            x[i] *= w
            y[i] *= w
        }
        coherentGain /= n

        // Compute DFT and amplitude spectrum
        val nHalf = n / 2 + 1
        val freqs = mutableListOf<Float>()
        val ampX = mutableListOf<Float>()
        val ampY = mutableListOf<Float>()
        val ampXY = mutableListOf<Float>()

        for (k in 0 until nHalf) {
            val freq = k * fs / n

            // Only include up to maxHz
            if (freq > maxHz) break

            // Compute DFT for this frequency bin
            var realX = 0f
            var imagX = 0f
            var realY = 0f
            var imagY = 0f

            for (i in 0 until n) {
                val angle = -2f * kotlin.math.PI.toFloat() * k * i / n
                val cos = kotlin.math.cos(angle)
                val sin = kotlin.math.sin(angle)

                realX += x[i] * cos
                imagX += x[i] * sin
                realY += y[i] * cos
                imagY += y[i] * sin
            }

            // Compute magnitude
            val magX = kotlin.math.sqrt(realX * realX + imagX * imagX)
            val magY = kotlin.math.sqrt(realY * realY + imagY * imagY)

            // One-sided amplitude scaling
            val isNyquist = n % 2 == 0 && k == n / 2
            val scale = if (k == 0 || isNyquist) {
                1f / n
            } else {
                2f / n
            } / coherentGain

            val ax = magX * scale
            val ay = magY * scale
            val axy = kotlin.math.sqrt(ax * ax + ay * ay)

            freqs.add(freq)
            ampX.add(ax)
            ampY.add(ay)
            ampXY.add(axy)
        }

        return AmplitudeSpectrum(freqs, ampX, ampY, ampXY)
    }

    /**
     * Chi-square quantile for 2 degrees of freedom.
     * χ²₂(p) = -2 ln(1 - p)
     * Matches the Tauri/Rust implementation.
     */
    private fun chiSquareQuantile2df(p: Float): Float? {
        if (p <= 0f || p >= 1f) {
            return null
        }
        return -2f * kotlin.math.ln(1f - p)
    }

    /**
     * Generate confidence ellipse points from CoP trail.
     * Uses eigendecomposition of 2x2 covariance matrix.
     * Matches the Tauri/Rust implementation.
     *
     * @param points CoP position trail
     * @param confidence Confidence level (0 < confidence < 1), default 0.95 for 95%
     * @param numPoints Number of points to generate on the ellipse
     * @return List of (x, y) points forming the ellipse, or empty list if not enough data
     */
    private fun generateConfidenceEllipsePoints(
        points: List<CopPosition>,
        confidence: Float = 0.95f,
        numPoints: Int = 64
    ): List<Pair<Float, Float>> {
        if (points.size < 3 || numPoints < 3 || confidence <= 0f || confidence >= 1f) {
            return emptyList()
        }

        val n = points.size.toFloat()

        // Calculate means
        val meanX = points.sumOf { it.x.toDouble() }.toFloat() / n
        val meanY = points.sumOf { it.y.toDouble() }.toFloat() / n

        // Calculate sample covariance matrix
        var covXX = 0f
        var covYY = 0f
        var covXY = 0f

        for (point in points) {
            val dx = point.x - meanX
            val dy = point.y - meanY
            covXX += dx * dx
            covYY += dy * dy
            covXY += dx * dy
        }

        val denom = maxOf(n - 1f, 1f) // Guard against division by zero
        covXX /= denom
        covYY /= denom
        covXY /= denom

        // Eigen decomposition of 2x2 covariance matrix (closed-form)
        val trace = covXX + covYY
        val det = covXX * covYY - covXY * covXY
        val disc = maxOf(trace * trace - 4f * det, 0f)
        val sqrtDisc = kotlin.math.sqrt(disc)

        val lambda1 = 0.5f * (trace + sqrtDisc)
        val lambda2 = 0.5f * (trace - sqrtDisc)

        // Orientation (angle of first eigenvector)
        val theta = 0.5f * kotlin.math.atan2(2f * covXY, covXX - covYY)
        val cosTheta = kotlin.math.cos(theta)
        val sinTheta = kotlin.math.sin(theta)

        // Chi-square quantile for 2 DOF at given confidence
        val chi2 = chiSquareQuantile2df(confidence) ?: return emptyList()

        // Semi-axes (radii) along principal components
        val r1 = kotlin.math.sqrt(maxOf(chi2 * lambda1, 0f))
        val r2 = kotlin.math.sqrt(maxOf(chi2 * lambda2, 0f))

        // Sample the ellipse
        val ellipsePoints = mutableListOf<Pair<Float, Float>>()
        for (k in 0 until numPoints) {
            val t = 2f * kotlin.math.PI.toFloat() * k / numPoints
            val ct = kotlin.math.cos(t)
            val st = kotlin.math.sin(t)

            // Parametric ellipse equation with rotation
            // x = cx + r1*ct*cosθ - r2*st*sinθ
            // y = cy + r1*ct*sinθ + r2*st*cosθ
            val x = meanX + r1 * ct * cosTheta - r2 * st * sinTheta
            val y = meanY + r1 * ct * sinTheta + r2 * st * cosTheta
            ellipsePoints.add(Pair(x, y))
        }

        return ellipsePoints
    }

    private fun addLogMessage(message: String) {
        viewModelScope.launch(Dispatchers.Main) {
            _uiState.update { state ->
                val newMessages = (state.logMessages + message).takeLast(10)
                state.copy(logMessages = newMessages)
            }
        }
    }

    fun updateSliderPosition(position: Float) {
        _uiState.update { it.copy(sliderPosition = position) }
    }

    fun togglePlay() {
        val state = _uiState.value
        if (state.isRecording) {
            stopSession()
        } else if (state.canStartSession) {
            startSession()
        }
    }

    fun toggleConfidenceEllipse() {
        _uiState.update { it.copy(showConfidenceEllipse = !it.showConfidenceEllipse) }
    }

    fun toggleConvexHull() {
        _uiState.update { it.copy(showConvexHull = !it.showConvexHull) }
    }

    fun setConfidenceEllipse(show: Boolean) {
        val now = System.currentTimeMillis()
        if (now - lastEllipseToggleMs < TOGGLE_DEBOUNCE_MS) return
        lastEllipseToggleMs = now
        _uiState.update { it.copy(showConfidenceEllipse = show) }
    }

    fun setConvexHull(show: Boolean) {
        val now = System.currentTimeMillis()
        if (now - lastConvexHullToggleMs < TOGGLE_DEBOUNCE_MS) return
        lastConvexHullToggleMs = now
        _uiState.update { it.copy(showConvexHull = show) }
    }

    fun setMlSi(show: Boolean) {
        _uiState.update { it.copy(showMlSi = show) }
    }

    fun setApSi(show: Boolean) {
        _uiState.update { it.copy(showApSi = show) }
    }

    fun setVsi(show: Boolean) {
        _uiState.update { it.copy(showVsi = show) }
    }

    fun setDpsi(show: Boolean) {
        _uiState.update { it.copy(showDpsi = show) }
    }

    fun setFftX(show: Boolean) {
        _uiState.update { it.copy(showFftX = show) }
    }

    fun setFftY(show: Boolean) {
        _uiState.update { it.copy(showFftY = show) }
    }

    fun setFftCombined(show: Boolean) {
        _uiState.update { it.copy(showFftCombined = show) }
    }

    fun nextLoop() {
        _uiState.update { state ->
            if (state.currentLoop < state.totalLoops) {
                state.copy(currentLoop = state.currentLoop + 1)
            } else {
                state
            }
        }
    }

    fun previousLoop() {
        _uiState.update { state ->
            if (state.currentLoop > 1) {
                state.copy(currentLoop = state.currentLoop - 1)
            } else {
                state
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        stopSession()
    }
}
