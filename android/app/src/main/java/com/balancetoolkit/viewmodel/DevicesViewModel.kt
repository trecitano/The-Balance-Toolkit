package com.balancetoolkit.viewmodel

import android.Manifest
import android.content.SharedPreferences
import androidx.annotation.RequiresPermission
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.balancetoolkit.bluetooth.BluetoothScanManager
import com.balancetoolkit.bluetooth.ScanEvent
import com.balancetoolkit.data.MockDeviceIds
import com.balancetoolkit.data.PreferenceKeys
import com.balancetoolkit.data.Result
import com.balancetoolkit.data.local.dao.DeviceDao
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

@HiltViewModel
class DevicesViewModel @Inject constructor(
    private val deviceDao: DeviceDao,
    private val sharedPreferences: SharedPreferences,
    private val bluetoothScanManager: BluetoothScanManager,
) : ViewModel() {
    private val _uiState = MutableStateFlow(DevicesUiState(isLoading = true))
    val uiState: StateFlow<DevicesUiState> = _uiState.asStateFlow()

    private var scanJob: Job? = null

    private val preferenceListener = SharedPreferences.OnSharedPreferenceChangeListener { _, key ->
        if (key == PreferenceKeys.MOCK_MODE_ENABLED) {
            val isMockMode = sharedPreferences.getBoolean(PreferenceKeys.MOCK_MODE_ENABLED, false)
            _uiState.update { it.copy(isMockMode = isMockMode) }
        }
    }

    init {
        loadHostMacAddress()
        loadMockModeAndDevices()
        sharedPreferences.registerOnSharedPreferenceChangeListener(preferenceListener)
        observeScanEvents()
        observeScanningState()
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
                        // Save the newly paired device to the database
                        val device = Device(
                            name = event.device.name ?: "Balance Board",
                            macAddress = event.device.address,
                            isConnected = false,
                        )
                        deviceDao.insertDevice(device.toEntity())
                    }
                    is ScanEvent.Error -> {
                        _uiState.update { it.copy(error = event.message) }
                    }
                    is ScanEvent.PairingFailed -> {
                        _uiState.update { it.copy(error = "Pairing failed: ${event.reason}") }
                    }
                    else -> { /* Log events handled by BluetoothScanManager */ }
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

    private fun loadHostMacAddress() {
        val savedMac = sharedPreferences.getString(PreferenceKeys.HOST_MAC_ADDRESS, null)
        _uiState.update { it.copy(hostMacAddress = savedMac) }
    }

    private fun loadMockModeAndDevices() {
        viewModelScope.launch {
            val isMockMode = sharedPreferences.getBoolean(PreferenceKeys.MOCK_MODE_ENABLED, false)
            _uiState.update { it.copy(isMockMode = isMockMode) }

            if (isMockMode) {
                ensureMockBoardsExist()
            }
            loadDevices()
        }
    }

    private suspend fun ensureMockBoardsExist() {
        val mockBoard1 = deviceDao.getDeviceById(MockDeviceIds.MOCK_BOARD_1)
        if (mockBoard1 == null) {
            val device = Device(
                id = MockDeviceIds.MOCK_BOARD_1,
                name = "Mock Board 1",
                macAddress = "00:00:00:00:00:01",
                isConnected = false,
            )
            deviceDao.insertDevice(device.toEntity())
        }

        val mockBoard2 = deviceDao.getDeviceById(MockDeviceIds.MOCK_BOARD_2)
        if (mockBoard2 == null) {
            val device = Device(
                id = MockDeviceIds.MOCK_BOARD_2,
                name = "Mock Board 2",
                macAddress = "00:00:00:00:00:02",
                isConnected = false,
            )
            deviceDao.insertDevice(device.toEntity())
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

    @RequiresPermission(allOf = [Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT])
    fun scanForDevices() {
        scanJob?.cancel()
        scanJob = viewModelScope.launch {
            if (_uiState.value.isMockMode) {
                // In mock mode, add mock boards
                _uiState.update { it.copy(isScanning = true) }
                delay(500) // Brief delay to show scanning state
                ensureMockBoardsExist()
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
}
