package com.balancetoolkit.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey
import com.balancetoolkit.data.model.Device
import java.util.UUID

@Entity(tableName = "devices")
data class DeviceEntity(
    @PrimaryKey
    val id: String = UUID.randomUUID().toString(),
    val name: String,
    val macAddress: String? = null,
    val lastSeen: String? = null,
    val isConnected: Boolean = false,
    val isSelected: Boolean = false,
)

fun DeviceEntity.toDevice(): Device =
    Device(
        id = id,
        name = name,
        macAddress = macAddress,
        lastSeen = lastSeen,
        isConnected = isConnected,
        isSelected = isSelected,
    )

fun Device.toEntity(): DeviceEntity =
    DeviceEntity(
        id = id,
        name = name,
        macAddress = macAddress,
        lastSeen = lastSeen,
        isConnected = isConnected,
        isSelected = isSelected,
    )
