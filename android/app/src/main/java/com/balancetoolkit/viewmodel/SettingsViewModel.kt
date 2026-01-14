package com.balancetoolkit.viewmodel

import android.content.Context
import android.content.SharedPreferences
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import java.io.File

private const val PREF_HOST_MAC_ADDRESS = "host_mac_address"
private const val PREF_MOCK_MODE_ENABLED = "mock_mode_enabled"
private const val PREF_SESSIONS_DIRECTORY = "sessions_directory"

data class SettingsUiState(
    val hostMacAddress: String? = null,
    val showMacAddressDialog: Boolean = false,
    val mockModeEnabled: Boolean = false,
    val sessionsDirectory: String = "",
    val showSessionsDirectoryDialog: Boolean = false,
) {
    val isHostMacConfigured: Boolean
        get() = !hostMacAddress.isNullOrBlank()
}

class SettingsViewModel(
    private val sharedPreferences: SharedPreferences,
    private val context: Context,
) : ViewModel() {
    private val _uiState = MutableStateFlow(SettingsUiState())
    val uiState: StateFlow<SettingsUiState> = _uiState.asStateFlow()

    init {
        loadSettings()
    }

    private fun loadSettings() {
        val savedMac = sharedPreferences.getString(PREF_HOST_MAC_ADDRESS, null)
        val mockModeEnabled = sharedPreferences.getBoolean(PREF_MOCK_MODE_ENABLED, false)
        val sessionsDirectory = sharedPreferences.getString(PREF_SESSIONS_DIRECTORY, null)
            ?: getDefaultSessionsDirectory()
        _uiState.update {
            it.copy(
                hostMacAddress = savedMac,
                mockModeEnabled = mockModeEnabled,
                sessionsDirectory = sessionsDirectory,
            )
        }
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

    fun saveHostMacAddress(macAddress: String) {
        sharedPreferences.edit().putString(PREF_HOST_MAC_ADDRESS, macAddress).apply()
        _uiState.update { it.copy(hostMacAddress = macAddress, showMacAddressDialog = false) }
    }

    fun showMacAddressDialog() {
        _uiState.update { it.copy(showMacAddressDialog = true) }
    }

    fun dismissMacAddressDialog() {
        _uiState.update { it.copy(showMacAddressDialog = false) }
    }

    fun setMockModeEnabled(enabled: Boolean) {
        sharedPreferences.edit().putBoolean(PREF_MOCK_MODE_ENABLED, enabled).apply()
        _uiState.update { it.copy(mockModeEnabled = enabled) }
    }

    fun saveSessionsDirectory(directory: String) {
        sharedPreferences.edit().putString(PREF_SESSIONS_DIRECTORY, directory).apply()
        _uiState.update { it.copy(sessionsDirectory = directory, showSessionsDirectoryDialog = false) }
    }

    fun showSessionsDirectoryDialog() {
        _uiState.update { it.copy(showSessionsDirectoryDialog = true) }
    }

    fun dismissSessionsDirectoryDialog() {
        _uiState.update { it.copy(showSessionsDirectoryDialog = false) }
    }

    fun resetSessionsDirectoryToDefault() {
        val defaultDir = getDefaultSessionsDirectory()
        saveSessionsDirectory(defaultDir)
    }

    class Factory(
        private val sharedPreferences: SharedPreferences,
        private val context: Context,
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            if (modelClass.isAssignableFrom(SettingsViewModel::class.java)) {
                return SettingsViewModel(sharedPreferences, context) as T
            }
            throw IllegalArgumentException("Unknown ViewModel class")
        }
    }
}
