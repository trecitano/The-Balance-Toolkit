package com.balancetoolkit.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.balancetoolkit.data.Result
import com.balancetoolkit.data.local.dao.DeviceDao
import com.balancetoolkit.data.local.entity.toDevice
import com.balancetoolkit.data.local.entity.toEntity
import com.balancetoolkit.data.model.Device
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class DevicesUiState(
    val devices: List<Device> = emptyList(),
    val connectedDevices: List<Device> = emptyList(),
    val isScanning: Boolean = false,
    val isLoading: Boolean = false,
    val error: String? = null,
) {
    val connectedCount: Int
        get() = devices.count { it.isConnected }
}

class DevicesViewModel(
    private val deviceDao: DeviceDao,
) : ViewModel() {
    private val _uiState = MutableStateFlow(DevicesUiState(isLoading = true))
    val uiState: StateFlow<DevicesUiState> = _uiState.asStateFlow()

    init {
        loadDevices()
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
        viewModelScope.launch {
            _uiState.update { it.copy(isScanning = true) }
            // Simulate scanning delay - in real implementation, this would discover Bluetooth devices
            delay(2000)

            // For demo purposes, add sample devices if none exist
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

            _uiState.update { it.copy(isScanning = false) }
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

    class Factory(
        private val deviceDao: DeviceDao,
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            if (modelClass.isAssignableFrom(DevicesViewModel::class.java)) {
                return DevicesViewModel(deviceDao) as T
            }
            throw IllegalArgumentException("Unknown ViewModel class")
        }
    }
}
