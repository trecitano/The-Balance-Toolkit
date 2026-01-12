package com.balancetoolkit.viewmodel

import androidx.lifecycle.ViewModel
import com.balancetoolkit.data.model.StabilityMetrics
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

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
    val stabilityMetrics: StabilityMetrics = StabilityMetrics(force = 73.67f),
    // Visualization toggles
    val showConfidenceEllipse: Boolean = true,
    val showConvexHull: Boolean = true,
    // FFT chart toggles
    val showMlSi: Boolean = true,
    val showApSi: Boolean = false,
    val showVsi: Boolean = true,
    val showDpsi: Boolean = false,
    // Direction values
    val leftValue: Int = -1,
    val rightValue: Int = 1,
    val frontValue: Int = 1,
)

class SessionViewModel : ViewModel() {
    private val _uiState = MutableStateFlow(SessionUiState())
    val uiState: StateFlow<SessionUiState> = _uiState.asStateFlow()

    fun updateSliderPosition(position: Float) {
        _uiState.update { it.copy(sliderPosition = position) }
    }

    fun togglePlay() {
        _uiState.update { it.copy(isPlaying = !it.isPlaying) }
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
}
