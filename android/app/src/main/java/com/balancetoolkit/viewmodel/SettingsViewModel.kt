package com.balancetoolkit.viewmodel

import android.content.Context
import android.content.SharedPreferences
import android.os.Environment
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.balancetoolkit.data.HeightUnit
import com.balancetoolkit.data.PreferenceKeys
import com.balancetoolkit.data.WeightUnit
import com.balancetoolkit.data.local.dao.DeviceDao
import com.balancetoolkit.data.local.dao.syncMockBoards
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.io.File
import javax.inject.Inject

data class SettingsUiState(
    val hostMacAddress: String? = null,
    val showMacAddressDialog: Boolean = false,
    val mockModeEnabled: Boolean = false,
    val sessionsDirectory: String = "",
    val showSessionsDirectoryDialog: Boolean = false,
    val showCiteBottomSheet: Boolean = false,
    val hasStoragePermission: Boolean = false,
    val heightUnit: HeightUnit = HeightUnit.CENTIMETERS,
    val weightUnit: WeightUnit = WeightUnit.KILOGRAMS,
    val appExternalFilesPath: String = "",
) {
    val isHostMacConfigured: Boolean
        get() = !hostMacAddress.isNullOrBlank()

    val needsStoragePermission: Boolean
        get() =
            !hasStoragePermission &&
                !sessionsDirectory.startsWith("content://") &&
                !sessionsDirectory.startsWith(appExternalFilesPath)
}

@HiltViewModel
class SettingsViewModel
    @Inject
    constructor(
        private val sharedPreferences: SharedPreferences,
        private val deviceDao: DeviceDao,
        @param:ApplicationContext private val context: Context,
    ) : ViewModel() {
        private val _uiState = MutableStateFlow(SettingsUiState())
        val uiState: StateFlow<SettingsUiState> = _uiState.asStateFlow()

        init {
            loadSettings()
        }

        private fun loadSettings() {
            val savedMac = sharedPreferences.getString(PreferenceKeys.HOST_MAC_ADDRESS, null)
            val mockModeEnabled = sharedPreferences.getBoolean(PreferenceKeys.MOCK_MODE_ENABLED, false)
            val sessionsDirectory =
                sharedPreferences.getString(PreferenceKeys.SESSIONS_DIRECTORY, null)
                    ?: getDefaultSessionsDirectory()
            val hasStoragePermission = Environment.isExternalStorageManager()
            val heightUnit = HeightUnit.fromString(sharedPreferences.getString(PreferenceKeys.HEIGHT_UNIT, null))
            val weightUnit = WeightUnit.fromString(sharedPreferences.getString(PreferenceKeys.WEIGHT_UNIT, null))
            val appExternalFilesPath = context.getExternalFilesDir(null)?.absolutePath ?: ""
            _uiState.update {
                it.copy(
                    hostMacAddress = savedMac,
                    mockModeEnabled = mockModeEnabled,
                    sessionsDirectory = sessionsDirectory,
                    hasStoragePermission = hasStoragePermission,
                    heightUnit = heightUnit,
                    weightUnit = weightUnit,
                    appExternalFilesPath = appExternalFilesPath,
                )
            }
        }

        fun refreshStoragePermission() {
            val hasStoragePermission = Environment.isExternalStorageManager()
            _uiState.update { it.copy(hasStoragePermission = hasStoragePermission) }
        }

        private fun getDefaultSessionsDirectory(): String {
            // Use app's external files directory - no permissions needed
            val externalFilesDir = context.getExternalFilesDir(null)
            return if (externalFilesDir != null) {
                File(externalFilesDir, "sessions").absolutePath
            } else {
                // Fallback to internal storage
                File(context.filesDir, "sessions").absolutePath
            }
        }

        fun saveHostMacAddress(macAddress: String) {
            sharedPreferences.edit().putString(PreferenceKeys.HOST_MAC_ADDRESS, macAddress).apply()
            _uiState.update { it.copy(hostMacAddress = macAddress, showMacAddressDialog = false) }
        }

        fun showMacAddressDialog() {
            _uiState.update { it.copy(showMacAddressDialog = true) }
        }

        fun dismissMacAddressDialog() {
            _uiState.update { it.copy(showMacAddressDialog = false) }
        }

        fun setMockModeEnabled(enabled: Boolean) {
            sharedPreferences.edit().putBoolean(PreferenceKeys.MOCK_MODE_ENABLED, enabled).apply()
            _uiState.update { it.copy(mockModeEnabled = enabled) }
            viewModelScope.launch {
                deviceDao.syncMockBoards(enabled)
            }
        }

        fun saveSessionsDirectory(directory: String) {
            sharedPreferences.edit().putString(PreferenceKeys.SESSIONS_DIRECTORY, directory).apply()
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

        fun showCiteBottomSheet() {
            _uiState.update { it.copy(showCiteBottomSheet = true) }
        }

        fun dismissCiteBottomSheet() {
            _uiState.update { it.copy(showCiteBottomSheet = false) }
        }

        fun setHeightUnit(unit: HeightUnit) {
            sharedPreferences.edit().putString(PreferenceKeys.HEIGHT_UNIT, unit.name).apply()
            _uiState.update { it.copy(heightUnit = unit) }
        }

        fun setWeightUnit(unit: WeightUnit) {
            sharedPreferences.edit().putString(PreferenceKeys.WEIGHT_UNIT, unit.name).apply()
            _uiState.update { it.copy(weightUnit = unit) }
        }
    }
