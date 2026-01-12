package com.balancetoolkit.data.model

import java.util.UUID

data class Device(
    val id: String = UUID.randomUUID().toString(),
    val name: String,
    val macAddress: String? = null,
    val lastSeen: String? = null,
    val isConnected: Boolean = false,
) {
    val displayInfo: String
        get() = macAddress?.let { "MAC: $it" } ?: "Last seen: ${lastSeen ?: "N/A"}"
}
