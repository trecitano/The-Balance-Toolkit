package com.balancetoolkit.viewmodel

import android.content.Context
import android.content.SharedPreferences
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.balancetoolkit.bluetooth.MockBalanceBoardConnection
import com.balancetoolkit.data.local.dao.DeviceDao
import com.balancetoolkit.data.local.dao.UserDao
import com.balancetoolkit.data.local.entity.toUser
import com.balancetoolkit.data.model.StabilityMetrics
import com.balancetoolkit.session.SessionConfiguration
import com.balancetoolkit.session.SessionFileWriter
import com.balancetoolkit.session.SessionUser
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.io.File

/**
 * Represents a Center of Pressure (CoP) position on the balance board.
 * Coordinates are in millimeters relative to center of board.
 * X: positive = right, negative = left
 * Y: positive = front (top), negative = back (bottom)
 */
data class CopPosition(
    val x: Float = 0f,
    val y: Float = 0f
)

/**
 * Represents the raw sensor readings from the balance board.
 */
data class SensorReading(
    val topLeft: Float = 0f,
    val topRight: Float = 0f,
    val bottomLeft: Float = 0f,
    val bottomRight: Float = 0f
) {
    val totalForce: Float
        get() = topLeft + topRight + bottomLeft + bottomRight
}

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
    val stabilityMetrics: StabilityMetrics = StabilityMetrics(force = 0f),
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
    // Log messages
    val logMessages: List<String> = emptyList(),
    // Session file writing
    val sessionId: String = "",
    val isWritingToFile: Boolean = false,
    val lastSavedFilePath: String? = null,
    // Device connection status
    val hasConnectedDevice: Boolean = false,
) {
    val canStartSession: Boolean
        get() = isMockMode || hasConnectedDevice
}

class SessionViewModel(
    private val context: Context,
    private val sharedPreferences: SharedPreferences,
    private val userDao: UserDao,
    private val deviceDao: DeviceDao,
) : ViewModel() {
    private val _uiState = MutableStateFlow(SessionUiState())
    val uiState: StateFlow<SessionUiState> = _uiState.asStateFlow()

    private var mockConnection: MockBalanceBoardConnection? = null
    private var sessionFileWriter: SessionFileWriter? = null
    private var currentUserId: String? = null

    companion object {
        // Balance board physical dimensions in mm
        // Distance between sensors (not the full board size)
        private const val SENSOR_DISTANCE_X = 433f // Left-right distance between sensors
        private const val SENSOR_DISTANCE_Y = 228f // Front-back distance between sensors

        // Maximum trail length to keep
        private const val MAX_TRAIL_LENGTH = 50

        private const val PREF_SESSIONS_DIRECTORY = "sessions_directory"
        private const val PREF_SELECTED_USER_ID = "selected_user_id"
        private const val PREF_MOCK_MODE_ENABLED = "mock_mode_enabled"
    }

    init {
        // Load the selected user ID
        currentUserId = sharedPreferences.getString(PREF_SELECTED_USER_ID, null)
        // Load mock mode setting
        val isMockMode = sharedPreferences.getBoolean(PREF_MOCK_MODE_ENABLED, false)
        _uiState.update { it.copy(isMockMode = isMockMode) }
        // Observe connected devices
        observeConnectedDevices()
    }

    private fun observeConnectedDevices() {
        viewModelScope.launch {
            deviceDao.getConnectedDevices().collect { connectedDevices ->
                _uiState.update { it.copy(hasConnectedDevice = connectedDevices.isNotEmpty()) }
            }
        }
    }

    private fun getSessionsDirectory(): String {
        return sharedPreferences.getString(PREF_SESSIONS_DIRECTORY, null)
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

    private val mockListener = object : MockBalanceBoardConnection.Listener {
        override fun onLog(message: String) {
            addLogMessage(message)
        }

        override fun onWeightData(topLeft: Float, topRight: Float, bottomLeft: Float, bottomRight: Float) {
            viewModelScope.launch(Dispatchers.Main) {
                updateSensorData(topLeft, topRight, bottomLeft, bottomRight)
            }
        }

        override fun onError(message: String) {
            addLogMessage("ERROR: $message")
        }
    }

    /**
     * Start a mock recording session.
     */
    fun startMockSession() {
        if (_uiState.value.isRecording) return

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

        mockConnection = MockBalanceBoardConnection(mockListener).also {
            it.start()
        }

        _uiState.update { it.copy(
            isRecording = true,
            isPlaying = true,
            copTrail = emptyList(),
            sessionId = sessionId,
        ) }
    }

    /**
     * Stop the current recording session.
     */
    fun stopSession() {
        mockConnection?.stop()
        mockConnection = null

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
        mockConnection?.tare()
    }

    /**
     * Update sensor data and calculate derived values.
     */
    private fun updateSensorData(topLeft: Float, topRight: Float, bottomLeft: Float, bottomRight: Float) {
        val reading = SensorReading(topLeft, topRight, bottomLeft, bottomRight)
        val cop = calculateCop(reading)

        // Write reading to file
        sessionFileWriter?.let { writer ->
            viewModelScope.launch(Dispatchers.IO) {
                writer.writeReading(reading)
            }
        }

        _uiState.update { state ->
            // Add current position to trail
            val newTrail = (state.copTrail + cop).takeLast(MAX_TRAIL_LENGTH)

            state.copy(
                currentReading = reading,
                currentCop = cop,
                copTrail = newTrail,
                stabilityMetrics = state.stabilityMetrics.copy(force = reading.totalForce),
                // Update direction indicators based on CoP position
                leftValue = if (cop.x < -10) -1 else 0,
                rightValue = if (cop.x > 10) 1 else 0,
                frontValue = if (cop.y > 10) 1 else if (cop.y < -10) -1 else 0
            )
        }
    }

    /**
     * Calculate Center of Pressure from sensor readings.
     * Returns position in mm relative to board center.
     */
    private fun calculateCop(reading: SensorReading): CopPosition {
        val totalForce = reading.totalForce

        if (totalForce <= 0.1f) {
            return CopPosition(0f, 0f)
        }

        // Calculate CoP using weighted average of sensor positions
        // Sensor layout (from user's perspective standing on the board):
        //   TopLeft (TL)     TopRight (TR)      <- Front of board
        //   BottomLeft (BL)  BottomRight (BR)   <- Back of board
        //
        // X-axis: positive = right
        // Y-axis: positive = front (top)

        val rightForce = reading.topRight + reading.bottomRight
        val leftForce = reading.topLeft + reading.bottomLeft
        val topForce = reading.topLeft + reading.topRight
        val bottomForce = reading.bottomLeft + reading.bottomRight

        // CoP X: weighted average between left (-) and right (+)
        val copX = (rightForce - leftForce) / totalForce * (SENSOR_DISTANCE_X / 2f)

        // CoP Y: weighted average between bottom (-) and top (+)
        val copY = (topForce - bottomForce) / totalForce * (SENSOR_DISTANCE_Y / 2f)

        return CopPosition(copX, copY)
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
            startMockSession()
        }
    }

    fun toggleConfidenceEllipse() {
        _uiState.update { it.copy(showConfidenceEllipse = !it.showConfidenceEllipse) }
    }

    fun toggleConvexHull() {
        _uiState.update { it.copy(showConvexHull = !it.showConvexHull) }
    }

    fun setConfidenceEllipse(show: Boolean) {
        _uiState.update { it.copy(showConfidenceEllipse = show) }
    }

    fun setConvexHull(show: Boolean) {
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

    class Factory(
        private val context: Context,
        private val sharedPreferences: SharedPreferences,
        private val userDao: UserDao,
        private val deviceDao: DeviceDao,
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            if (modelClass.isAssignableFrom(SessionViewModel::class.java)) {
                return SessionViewModel(context, sharedPreferences, userDao, deviceDao) as T
            }
            throw IllegalArgumentException("Unknown ViewModel class")
        }
    }
}
