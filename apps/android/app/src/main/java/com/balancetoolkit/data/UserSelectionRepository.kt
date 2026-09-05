package com.balancetoolkit.data

import android.content.SharedPreferences
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class UserSelectionRepository
    @Inject
    constructor(
        private val sharedPreferences: SharedPreferences,
    ) {
        private val _selectedUserId = MutableStateFlow(sharedPreferences.getString(PreferenceKeys.SELECTED_USER_ID, null))
        val selectedUserId: StateFlow<String?> = _selectedUserId.asStateFlow()

        private val listener =
            SharedPreferences.OnSharedPreferenceChangeListener { preferences, key ->
                if (key == PreferenceKeys.SELECTED_USER_ID) {
                    _selectedUserId.value = preferences.getString(PreferenceKeys.SELECTED_USER_ID, null)
                }
            }

        init {
            sharedPreferences.registerOnSharedPreferenceChangeListener(listener)
        }

        fun getSelectedUserId(): String? = selectedUserId.value

        fun setSelectedUserId(userId: String?) {
            sharedPreferences.edit().putString(PreferenceKeys.SELECTED_USER_ID, userId).apply()
            _selectedUserId.value = userId
        }
    }
