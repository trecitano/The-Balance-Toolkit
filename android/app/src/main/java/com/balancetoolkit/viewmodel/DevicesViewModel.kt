package com.balancetoolkit.viewmodel

import android.Manifest
import android.content.SharedPreferences
import androidx.annotation.RequiresPermission
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.balancetoolkit.bluetooth.BluetoothScanManager
import com.balancetoolkit.bluetooth.ScanEvent
import com.balancetoolkit.data.PreferenceKeys
import com.balancetoolkit.data.Result
import com.balancetoolkit.data.local.dao.DeviceDao
import com.balancetoolkit.data.local.dao.syncMockBoards
import com.balancetoolkit.data.local.entity.toDevice
import com.balancetoolkit.data.local.entity.toEntity
import com.balancetoolkit.data.model.Device
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class DevicesUiState(
    val devices: List<Device> = emptyList(),
    val connectedDevices: List<Device> = emptyList(),
    val selectedDevice: Device? = null,
    val boardStatus: BoardSelectionStatus = BoardSelectionStatus.NoBoardConnected,
    val isScanning: Boolean = false,
    val isLoading: Boolean = false,
    val error: String? = null,
    val hostMacAddress: String? = null,
    val showMacAddressDialog: Boolean = false,
    val scanAfterMacSave: Boolean = false,
    val deviceToDelete: Device? = null,
    val deviceToEdit: Device? = null,
    val isMockMode: Boolean = false,
    val scanLogs: List<String> = emptyList(),
) {
    val connectedCount: Int
        get() = devices.count { it.isConnected }

    val hasSelectedDevice: Boolean
        get() = boardStatus == BoardSelectionStatus.BoardSelected

    val isHostMacConfigured: Boolean
        get() = !hostMacAddress.isNullOrBlank()

    val showDeleteConfirmDialog: Boolean
        get() = deviceToDelete != null

    val showEditNameDialog: Boolean
        get() = deviceToEdit != null
}

@HiltViewModel
class DevicesViewModel
    @Inject
    constructor(
        private val deviceDao: DeviceDao,
        private val sharedPreferences: SharedPreferences,
        private val bluetoothScanManager: BluetoothScanManager,
    ) : ViewModel() {
        private val _uiState = MutableStateFlow(DevicesUiState(isLoading = true))
        val uiState: StateFlow<DevicesUiState> = _uiState.asStateFlow()

        private var scanJob: Job? = null

        private val preferenceListener =
            SharedPreferences.OnSharedPreferenceChangeListener { _, key ->
                if (key == PreferenceKeys.MOCK_MODE_ENABLED) {
                    val isMockMode = sharedPreferences.getBoolean(PreferenceKeys.MOCK_MODE_ENABLED, false)
                    _uiState.update { it.copy(isMockMode = isMockMode) }
                    viewModelScope.launch {
                        deviceDao.syncMockBoards(isMockMode)
                    }
                }
            }

        init {
            loadHostMacAddress()
            loadMockModeAndDevices()
            sharedPreferences.registerOnSharedPreferenceChangeListener(preferenceListener)
            observeScanEvents()
            observeScanningState()
            observeSelectedDevice()
        }

        override fun onCleared() {
            super.onCleared()
            sharedPreferences.unregisterOnSharedPreferenceChangeListener(preferenceListener)
            bluetoothScanManager.cleanup()
        }

        private fun observeScanEvents() {
            viewModelScope.launch {
                bluetoothScanManager.events.collect { event ->
                    when (event) {
                        is ScanEvent.PairingSucceeded -> {
                            val macAddress = event.device.address
                            val existing = deviceDao.getDeviceByMacAddress(macAddress)
                            if (existing != null) {
                                deviceDao.updateConnectionStatus(existing.id, true)
                            } else {
                                val device =
                                    Device(
                                        name = event.device.name ?: "Balance Board",
                                        macAddress = macAddress,
                                        isConnected = true,
                                    )
                                deviceDao.insertDevice(device.toEntity())
                            }
                        }

                        is ScanEvent.Error -> {
                            _uiState.update { it.copy(error = event.message) }
                        }

                        is ScanEvent.PairingFailed -> {
                            _uiState.update { it.copy(error = "Pairing failed: ${event.reason}") }
                        }

                        is ScanEvent.Log -> {
                            _uiState.update { it.copy(scanLogs = it.scanLogs + event.message) }
                        }

                        else -> { /* Other events not handled in UI */ }
                    }
                }
            }
        }

        private fun observeScanningState() {
            viewModelScope.launch {
                bluetoothScanManager.isScanning.collect { isScanning ->
                    _uiState.update { it.copy(isScanning = isScanning) }
                }
            }
        }

        private fun observeSelectedDevice() {
            viewModelScope.launch {
                deviceDao.getSelectedDevice().collect { selectedEntity ->
                    _uiState.update {
                        it.copy(
                            selectedDevice =
                                selectedEntity
                                    ?.takeIf { entity -> entity.isConnected }
                                    ?.toDevice(),
                        )
                    }
                }
            }
        }

        private fun loadHostMacAddress() {
            val savedMac = sharedPreferences.getString(PreferenceKeys.HOST_MAC_ADDRESS, null)
            _uiState.update { it.copy(hostMacAddress = savedMac) }
        }

        private fun loadMockModeAndDevices() {
            viewModelScope.launch {
                val isMockMode = sharedPreferences.getBoolean(PreferenceKeys.MOCK_MODE_ENABLED, false)
                _uiState.update { it.copy(isMockMode = isMockMode) }

                if (isMockMode) {
                    deviceDao.syncMockBoards(mockModeEnabled = true)
                }
                loadDevices()
            }
        }

        fun saveHostMacAddress(macAddress: String) {
            val shouldScan = _uiState.value.scanAfterMacSave
            sharedPreferences.edit().putString(PreferenceKeys.HOST_MAC_ADDRESS, macAddress).apply()
            _uiState.update { it.copy(hostMacAddress = macAddress, showMacAddressDialog = false, scanAfterMacSave = false) }
            if (shouldScan) {
                scanForDevices()
            }
        }

        fun showMacAddressDialog(scanAfterSave: Boolean = false) {
            _uiState.update { it.copy(showMacAddressDialog = true, scanAfterMacSave = scanAfterSave) }
        }

        fun dismissMacAddressDialog() {
            _uiState.update { it.copy(showMacAddressDialog = false, scanAfterMacSave = false) }
        }

        fun onScanClick() {
            if (_uiState.value.isScanning) {
                stopScanning()
            } else if (_uiState.value.isHostMacConfigured) {
                scanForDevices()
            } else {
                showMacAddressDialog(scanAfterSave = true)
            }
        }

        @RequiresPermission(Manifest.permission.BLUETOOTH_SCAN)
        private fun stopScanning() {
            scanJob?.cancel()
            scanJob = null
            bluetoothScanManager.stopScanning()
        }

        private fun loadDevices() {
            viewModelScope.launch {
                deviceDao
                    .getAllDevices()
                    .map { entities -> entities.map { it.toDevice() } }
                    .catch { e ->
                        _uiState.update {
                            it.copy(isLoading = false, error = e.message ?: "Failed to load devices")
                        }
                    }.collect { devices ->
                        val staleSelectedDevices = devices.filter { device -> device.isSelected && !device.isConnected }
                        if (staleSelectedDevices.isNotEmpty()) {
                            staleSelectedDevices.forEach { staleDevice ->
                                deviceDao.updateSelectionStatus(staleDevice.id, false)
                            }
                            return@collect
                        }

                        val boardSelectionInfo = devices.toBoardSelectionInfo()
                        _uiState.update {
                            it.copy(
                                devices = devices,
                                connectedDevices = devices.filter { device -> device.isConnected },
                                boardStatus = boardSelectionInfo.status,
                                isLoading = false,
                                error = null,
                            )
                        }
                    }
            }
        }

        @RequiresPermission(allOf = [Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT])
        fun scanForDevices() {
            scanJob?.cancel()
            _uiState.update { it.copy(scanLogs = emptyList()) }
            scanJob =
                viewModelScope.launch {
                    if (_uiState.value.isMockMode) {
                        // In mock mode, add mock boards
                        _uiState.update { it.copy(isScanning = true) }
                        delay(500) // Brief delay to show scanning state
                        deviceDao.syncMockBoards(mockModeEnabled = true)
                        _uiState.update { it.copy(isScanning = false) }
                        scanJob = null
                        return@launch
                    }

                    // Real mode: Use BluetoothScanManager
                    val started = bluetoothScanManager.startScanning()
                    if (!started) {
                        scanJob = null
                    }
                }
        }

        fun selectDevice(deviceId: String) {
            viewModelScope.launch {
                val result =
                    runCatching {
                        val device = _uiState.value.devices.find { it.id == deviceId }
                        if (device == null) {
                            Result.Error("Device not found", null)
                        } else {
                            deviceDao.clearAllSelections()
                            deviceDao.updateSelectionStatus(deviceId, true)
                            Result.Success(Unit)
                        }
                    }.getOrElse { e ->
                        Result.Error(e.message ?: "Failed to select device", e)
                    }

                if (result is Result.Error) {
                    _uiState.update { it.copy(error = result.message) }
                }
            }
        }

        fun deselectDevice(deviceId: String) {
            viewModelScope.launch {
                val result =
                    runCatching {
                        deviceDao.updateSelectionStatus(deviceId, false)
                        Result.Success(Unit)
                    }.getOrElse { e ->
                        Result.Error(e.message ?: "Failed to deselect device", e)
                    }

                if (result is Result.Error) {
                    _uiState.update { it.copy(error = result.message) }
                }
            }
        }

        fun clearError() {
            _uiState.update { it.copy(error = null) }
        }

        fun requestDeleteDevice(device: Device) {
            _uiState.update { it.copy(deviceToDelete = device) }
        }

        fun dismissDeleteDialog() {
            _uiState.update { it.copy(deviceToDelete = null) }
        }

        fun confirmDeleteDevice() {
            val device = _uiState.value.deviceToDelete ?: return
            viewModelScope.launch {
                runCatching {
                    deviceDao.deleteDeviceById(device.id)
                }.onFailure { e ->
                    _uiState.update { it.copy(error = e.message ?: "Failed to delete device") }
                }
                _uiState.update { it.copy(deviceToDelete = null) }
            }
        }

        fun requestEditDevice(device: Device) {
            _uiState.update { it.copy(deviceToEdit = device) }
        }

        fun dismissEditDialog() {
            _uiState.update { it.copy(deviceToEdit = null) }
        }

        fun saveDeviceName(newName: String) {
            val device = _uiState.value.deviceToEdit ?: return
            viewModelScope.launch {
                runCatching {
                    deviceDao.updateDeviceName(device.id, newName.trim())
                }.onFailure { e ->
                    _uiState.update { it.copy(error = e.message ?: "Failed to update device name") }
                }
                _uiState.update { it.copy(deviceToEdit = null) }
            }
        }
    }
