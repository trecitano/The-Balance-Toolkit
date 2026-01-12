package com.balancetoolkit.data.model

import java.util.UUID

data class Session(
    val id: String = UUID.randomUUID().toString(),
    val userId: String,
    val deviceId: String,
    val deviceName: String = "",
    val deviceMacAddress: String = "",
    val duration: Int = 0,
    val filePath: String = "",
    val createdAt: String = "",
    val loopCount: Int = 10,
    val currentLoop: Int = 1,
    val currentTime: String = "00:00:00:00",
)

data class SessionStats(
    val duration: Int,
    val boardNumber: String,
    val userName: String,
    val userAge: Int,
    val userWeight: Int,
    val userGender: String,
    val filePath: String,
)

data class COPData(
    val x: Float,
    val y: Float,
    val timestamp: Long,
)

data class StabilityMetrics(
    val force: Float = 0f,
    val mlSi: Float = 0f,
    val apSi: Float = 0f,
    val vsi: Float = 0f,
    val dpsi: Float = 0f,
)
