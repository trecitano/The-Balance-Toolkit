package com.balancetoolkit.viewmodel

import android.content.SharedPreferences
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.balancetoolkit.data.Result
import com.balancetoolkit.data.local.dao.DeviceDao
import com.balancetoolkit.data.local.entity.toDevice
import com.balancetoolkit.data.local.entity.toEntity
import com.balancetoolkit.data.model.Device
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

private const val PREF_HOST_MAC_ADDRESS = "host_mac_address"
private const val PREF_MOCK_MODE_ENABLED = "mock_mode_enabled"
private const val MOCK_BOARD_1_ID = "mock-board-1"
private const val MOCK_BOARD_2_ID = "mock-board-2"

data class DevicesUiState(
    val devices: List<Device> = emptyList(),
    val connectedDevices: List<Device> = emptyList(),
    val isScanning: Boolean = false,
    val isLoading: Boolean = false,
    val error: String? = null,
    val hostMacAddress: String? = null,
    val showMacAddressDialog: Boolean = false,
    val scanAfterMacSave: Boolean = false,
    val deviceToDelete: Device? = null,
    val deviceToEdit: Device? = null,
    val isMockMode: Boolean = false,
) {
    val connectedCount: Int
        get() = devices.count { it.isConnected }

    val isHostMacConfigured: Boolean
        get() = !hostMacAddress.isNullOrBlank()

    val showDeleteConfirmDialog: Boolean
        get() = deviceToDelete != null

    val showEditNameDialog: Boolean
        get() = deviceToEdit != null
}

class DevicesViewModel(
    private val deviceDao: DeviceDao,
    private val sharedPreferences: SharedPreferences,
) : ViewModel() {
    private val _uiState = MutableStateFlow(DevicesUiState(isLoading = true))
    val uiState: StateFlow<DevicesUiState> = _uiState.asStateFlow()

    private var scanJob: Job? = null

    init {
        loadHostMacAddress()
        loadMockModeAndDevices()
    }

    private fun loadHostMacAddress() {
        val savedMac = sharedPreferences.getString(PREF_HOST_MAC_ADDRESS, null)
        _uiState.update { it.copy(hostMacAddress = savedMac) }
    }

    private fun loadMockModeAndDevices() {
        viewModelScope.launch {
            val isMockMode = sharedPreferences.getBoolean(PREF_MOCK_MODE_ENABLED, false)
            _uiState.update { it.copy(isMockMode = isMockMode) }

            if (isMockMode) {
                ensureMockBoardsExist()
            }
            loadDevices()
        }
    }

    private suspend fun ensureMockBoardsExist() {
        val mockBoard1 = deviceDao.getDeviceById(MOCK_BOARD_1_ID)
        if (mockBoard1 == null) {
            val device = Device(
                id = MOCK_BOARD_1_ID,
                name = "Mock Board 1",
                macAddress = "00:00:00:00:00:01",
                isConnected = false,
            )
            deviceDao.insertDevice(device.toEntity())
        }

        val mockBoard2 = deviceDao.getDeviceById(MOCK_BOARD_2_ID)
        if (mockBoard2 == null) {
            val device = Device(
                id = MOCK_BOARD_2_ID,
                name = "Mock Board 2",
                macAddress = "00:00:00:00:00:02",
                isConnected = false,
            )
            deviceDao.insertDevice(device.toEntity())
        }
    }

    fun saveHostMacAddress(macAddress: String) {
        val shouldScan = _uiState.value.scanAfterMacSave
        sharedPreferences.edit().putString(PREF_HOST_MAC_ADDRESS, macAddress).apply()
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

    private fun stopScanning() {
        scanJob?.cancel()
        scanJob = null
        _uiState.update { it.copy(isScanning = false) }
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
                    _uiState.update {
                        it.copy(
                            devices = devices,
                            connectedDevices = devices.filter { device -> device.isConnected },
                            isLoading = false,
                            error = null,
                        )
                    }
                }
        }
    }

    fun scanForDevices() {
        scanJob?.cancel()
        scanJob = viewModelScope.launch {
            val initialDeviceCount = _uiState.value.devices.size
            _uiState.update { it.copy(isScanning = true) }

            // Continue scanning until a new device is found or cancelled
            while (isActive) {
                // Simulate scanning - in real implementation, this would discover Bluetooth devices
                delay(1000)

                // For demo purposes, add sample devices if none exist after a few seconds
                if (_uiState.value.devices.isEmpty()) {
                    val sampleDevices =
                        listOf(
                            Device(
                                name = "Nintendo RVL-WBC-01",
                                macAddress = "37:F6:A1:2B:FD:F4",
                                isConnected = false,
                            ),
                            Device(
                                name = "Nintendo RVL-WBC-01",
                                macAddress = "12:E9:CD:B9:71:54",
                                isConnected = false,
                            ),
                        )
                    sampleDevices.forEach { device ->
                        deviceDao.insertDevice(device.toEntity())
                    }
                }

                // Stop scanning if a new device was found
                if (_uiState.value.devices.size > initialDeviceCount) {
                    break
                }
            }

            _uiState.update { it.copy(isScanning = false) }
            scanJob = null
        }
    }

    fun connectDevice(deviceId: String) {
        viewModelScope.launch {
            val result =
                runCatching {
                    deviceDao.updateConnectionStatus(deviceId, true)
                    Result.Success(Unit)
                }.getOrElse { e ->
                    Result.Error(e.message ?: "Failed to connect device", e)
                }

            if (result is Result.Error) {
                _uiState.update { it.copy(error = result.message) }
            }
        }
    }

    fun disconnectDevice(deviceId: String) {
        viewModelScope.launch {
            val result =
                runCatching {
                    deviceDao.updateConnectionStatus(deviceId, false)
                    Result.Success(Unit)
                }.getOrElse { e ->
                    Result.Error(e.message ?: "Failed to disconnect device", e)
                }

            if (result is Result.Error) {
                _uiState.update { it.copy(error = result.message) }
            }
        }
    }

    fun toggleConnection(deviceId: String) {
        val device = _uiState.value.devices.find { it.id == deviceId } ?: return
        if (device.isConnected) {
            disconnectDevice(deviceId)
        } else {
            connectDevice(deviceId)
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

    class Factory(
        private val deviceDao: DeviceDao,
        private val sharedPreferences: SharedPreferences,
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            if (modelClass.isAssignableFrom(DevicesViewModel::class.java)) {
                return DevicesViewModel(deviceDao, sharedPreferences) as T
            }
            throw IllegalArgumentException("Unknown ViewModel class")
        }
    }
}
