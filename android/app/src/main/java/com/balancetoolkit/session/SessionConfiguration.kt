package com.balancetoolkit.session

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Session configuration file format matching the Tauri app's format.
 * This is written to a .settings.json file for each session.
 */
@Serializable
data class SessionConfiguration(
    val user: SessionUser,
    @SerialName("windowSizeMs")
    val windowSizeMs: Long = 5000,
    @SerialName("windowSlideMs")
    val windowSlideMs: Long = 100,
    @SerialName("samplingRate")
    val samplingRate: Long = 100,
    val interpolation: String = "Cubic",
    @SerialName("deviceNames")
    val deviceNames: Map<String, String> = emptyMap(),
    @SerialName("deviceFileMappings")
    val deviceFileMappings: Map<String, FileNameMapping> = emptyMap(),
    val activity: SessionActivity? = null,
    @SerialName("sessionStats")
    val sessionStats: SessionStats = SessionStats(),
)

/**
 * User information stored in the session configuration.
 */
@Serializable
data class SessionUser(
    val id: String,
    val name: String,
    val age: Int = 0,
    val gender: String = "OTHER",
    val height: Int = 0,
    @SerialName("heightMetric")
    val heightMetric: String = "cm",
    val weight: Int = 0,
    @SerialName("weightMetric")
    val weightMetric: String = "kg",
    @SerialName("dominantHand")
    val dominantHand: String = "RIGHT",
    val color: String = "#3B82F6",
    @SerialName("createdAt")
    val createdAt: String = "",
    @SerialName("updatedAt")
    val updatedAt: String = "",
    @SerialName("isDefault")
    val isDefault: Boolean = false,
)

/**
 * Session statistics recorded during the session.
 */
@Serializable
data class SessionStats(
    @SerialName("boardSamplingRate")
    val boardSamplingRate: Double = 0.0,
    @SerialName("durationMs")
    val durationMs: Long = 0,
)

/**
 * File name mapping for device data files.
 */
@Serializable
data class FileNameMapping(
    @SerialName("rawFileName")
    val rawFileName: String = "",
)

/**
 * Activity information for the session (optional).
 */
@Serializable
data class SessionActivity(
    val id: String = "",
    val title: String = "",
    @SerialName("staticImage")
    val staticImage: String? = null,
    @SerialName("boardsRequired")
    val boardsRequired: Int = 1,
    val loops: Int = 1,
)
