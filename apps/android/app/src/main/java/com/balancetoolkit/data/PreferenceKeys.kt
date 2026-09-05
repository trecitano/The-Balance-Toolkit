package com.balancetoolkit.data

/**
 * Centralized SharedPreferences keys used across the application.
 */
object PreferenceKeys {
    const val PREFS_NAME = "balance_toolkit_prefs"

    const val HOST_MAC_ADDRESS = "host_mac_address"
    const val MOCK_MODE_ENABLED = "mock_mode_enabled"
    const val SELECTED_USER_ID = "selected_user_id"
    const val SESSIONS_DIRECTORY = "sessions_directory"
    const val HEIGHT_UNIT = "height_unit"
    const val WEIGHT_UNIT = "weight_unit"
    const val SESSION_WINDOW_SIZE_MS = "session_window_size_ms"
    const val SESSION_WINDOW_SLIDE_MS = "session_window_slide_ms"
    const val SESSION_SAMPLING_RATE = "session_sampling_rate"
    const val SESSION_INTERPOLATION = "session_interpolation"

    const val DEFAULT_SESSION_WINDOW_SIZE_MS = 5000L
    const val DEFAULT_SESSION_WINDOW_SLIDE_MS = 100L
    const val DEFAULT_SESSION_SAMPLING_RATE = 100L
}

enum class HeightUnit(
    val label: String,
) {
    CENTIMETERS("cm"),
    FEET("ft"),
    ;

    fun fromMetric(cm: Int): String =
        when (this) {
            CENTIMETERS -> cm.toString()
            FEET -> "%.1f".format(cm / 30.48)
        }

    fun toMetricCm(
        value: String,
        fallback: Int = 170,
    ): Int =
        when (this) {
            CENTIMETERS -> value.toDoubleOrNull()?.toInt() ?: fallback
            FEET -> ((value.toDoubleOrNull() ?: (fallback / 30.48)) * 30.48).toInt()
        }

    companion object {
        fun fromString(value: String?): HeightUnit = entries.find { it.name == value } ?: CENTIMETERS
    }
}

enum class WeightUnit(
    val label: String,
) {
    KILOGRAMS("kg"),
    POUNDS("lbs"),
    ;

    fun fromMetric(kg: Int): String =
        when (this) {
            KILOGRAMS -> kg.toString()
            POUNDS -> "%.0f".format(kg * 2.20462)
        }

    fun convertFromMetric(kg: Float): Float =
        when (this) {
            KILOGRAMS -> kg
            POUNDS -> kg * 2.20462f
        }

    fun toMetricKg(
        value: String,
        fallback: Int = 70,
    ): Int =
        when (this) {
            KILOGRAMS -> value.toDoubleOrNull()?.toInt() ?: fallback
            POUNDS -> ((value.toDoubleOrNull() ?: (fallback * 2.20462)) / 2.20462).toInt()
        }

    companion object {
        fun fromString(value: String?): WeightUnit = entries.find { it.name == value } ?: KILOGRAMS
    }
}

/**
 * Mock device IDs for testing mode.
 */
enum class InterpolationMethod(
    val label: String,
) {
    LINEAR("Linear"),
    CUBIC("Cubic"),
    ;

    companion object {
        fun fromString(value: String?): InterpolationMethod = entries.find { it.name == value } ?: CUBIC
    }
}

object MockDeviceIds {
    const val MOCK_BOARD_1 = "mock-board-1"
    const val MOCK_BOARD_2 = "mock-board-2"
    const val MOCK_BOARD_3 = "mock-board-3"
}
