package com.balancetoolkit.viewmodel

import androidx.lifecycle.ViewModel
import com.balancetoolkit.data.model.SessionStats
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class HomeUiState(
    val lastSessionStats: SessionStats? = null,
    val connectedBoardsCount: Int = 0,
    val connectedBoardIndices: List<Int> = emptyList(),
    val isLoading: Boolean = false,
)

class HomeViewModel : ViewModel() {
    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    init {
        loadHomeData()
    }

    private fun loadHomeData() {
        // Sample data - in real app this would come from a repository
        val sampleStats =
            SessionStats(
                duration = 122,
                boardNumber = "7.1.1J",
                userName = "Mario",
                userAge = 44,
                userWeight = 70,
                userGender = "Male",
                filePath = "C:\\users\\Andrea\\fOO\\Documents\\the-balance-toolkit\\sessions\\tbt-2023-09-11T12-37-32.settings.json",
            )

        _uiState.value =
            HomeUiState(
                lastSessionStats = sampleStats,
                connectedBoardsCount = 3,
                connectedBoardIndices = listOf(0, 1, 2),
            )
    }
}
