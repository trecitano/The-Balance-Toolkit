package com.balancetoolkit.ui.theme

import androidx.compose.ui.graphics.Color

/**
 * Centralized user color palette used for avatar customization.
 * Provides colors in multiple formats for different use cases.
 */
object UserColors {
    /**
     * Color option with hex string and Compose Color.
     */
    data class ColorOption(
        val hex: String,
        val color: Color,
    )

    /**
     * Available color options for user avatars.
     */
    val options: List<ColorOption> =
        listOf(
            ColorOption("#3B82F6", Color(0xFF3B82F6)), // Blue (default)
            ColorOption("#E53935", Color(0xFFE53935)), // Red
            ColorOption("#FBC02D", Color(0xFFFBC02D)), // Yellow
            ColorOption("#4CAF50", Color(0xFF4CAF50)), // Green
            ColorOption("#9C27B0", Color(0xFF9C27B0)), // Purple
            ColorOption("#FF9800", Color(0xFFFF9800)), // Orange
            ColorOption("#00BCD4", Color(0xFF00BCD4)), // Cyan
            ColorOption("#E91E63", Color(0xFFE91E63)), // Pink
        )

    /**
     * Get hex strings only.
     */
    val hexStrings: List<String>
        get() = options.map { it.hex }

    /**
     * Get Compose Color objects only.
     */
    val colors: List<Color>
        get() = options.map { it.color }

    /**
     * Get a random hex color string.
     */
    fun randomHex(): String = options.random().hex

    /**
     * Find the Color for a given hex string.
     */
    fun colorForHex(hex: String): Color? = options.find { it.hex.equals(hex, ignoreCase = true) }?.color

    /**
     * Find the hex string for a given Color long value.
     */
    fun hexForColorLong(colorLong: Long): String {
        val targetColor = Color(colorLong)
        return options.find { it.color == targetColor }?.hex
            ?: "#%06X".format((colorLong and 0xFFFFFF).toInt())
    }
}
