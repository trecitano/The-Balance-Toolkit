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
}

enum class HeightUnit(
    val label: String,
) {
    CENTIMETERS("cm"),
    FEET("ft"),
    ;

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

    companion object {
        fun fromString(value: String?): WeightUnit = entries.find { it.name == value } ?: KILOGRAMS
    }
}

/**
 * Mock device IDs for testing mode.
 */
object MockDeviceIds {
    const val MOCK_BOARD_1 = "mock-board-1"
    const val MOCK_BOARD_2 = "mock-board-2"
    const val MOCK_BOARD_3 = "mock-board-3"
}
