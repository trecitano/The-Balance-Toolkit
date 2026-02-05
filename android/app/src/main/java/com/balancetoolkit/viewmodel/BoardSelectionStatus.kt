package com.balancetoolkit.viewmodel

import com.balancetoolkit.data.model.Device

enum class BoardSelectionStatus {
    NoBoardConnected,
    BoardConnectedNotSelected,
    BoardSelected,
}

data class BoardSelectionInfo(
    val status: BoardSelectionStatus,
    val selectedConnectedDevice: Device? = null,
)

fun List<Device>.toBoardSelectionInfo(): BoardSelectionInfo {
    val connectedDevices = filter { it.isConnected }
    val selectedConnectedDevice = connectedDevices.firstOrNull { it.isSelected }

    val status =
        when {
            selectedConnectedDevice != null -> BoardSelectionStatus.BoardSelected
            connectedDevices.isNotEmpty() -> BoardSelectionStatus.BoardConnectedNotSelected
            else -> BoardSelectionStatus.NoBoardConnected
        }

    return BoardSelectionInfo(status = status, selectedConnectedDevice = selectedConnectedDevice)
}
