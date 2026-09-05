package com.balancetoolkit.data.model

import com.balancetoolkit.data.MockDeviceIds
import java.util.UUID

data class Device(
    val id: String = UUID.randomUUID().toString(),
    val name: String,
    val macAddress: String? = null,
    val lastSeen: String? = null,
    val isConnected: Boolean = false,
    val isSelected: Boolean = false,
) {
    val displayInfo: String
        get() = macAddress?.let { "MAC: $it" } ?: "Last seen: ${lastSeen ?: "N/A"}"

    val isMock: Boolean
        get() = id == MockDeviceIds.MOCK_BOARD_1 || id == MockDeviceIds.MOCK_BOARD_2 || id == MockDeviceIds.MOCK_BOARD_3
}
