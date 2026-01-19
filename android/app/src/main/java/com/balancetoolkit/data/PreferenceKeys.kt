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
}

/**
 * Mock device IDs for testing mode.
 */
object MockDeviceIds {
    const val MOCK_BOARD_1 = "mock-board-1"
    const val MOCK_BOARD_2 = "mock-board-2"
}
