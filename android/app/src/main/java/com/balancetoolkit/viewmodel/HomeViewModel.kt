package com.balancetoolkit.viewmodel

import android.content.SharedPreferences
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.balancetoolkit.data.PreferenceKeys
import com.balancetoolkit.data.local.dao.DeviceDao
import com.balancetoolkit.data.local.dao.UserDao
import com.balancetoolkit.data.local.entity.toUser
import com.balancetoolkit.data.model.DEFAULT_USER_ID
import com.balancetoolkit.data.model.User
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class HomeUiState(
    val selectedUser: User? = null,
    val isBoardConnected: Boolean = false,
    val isLoading: Boolean = true,
)

@HiltViewModel
class HomeViewModel
    @Inject
    constructor(
        private val userDao: UserDao,
        private val deviceDao: DeviceDao,
        private val sharedPreferences: SharedPreferences,
    ) : ViewModel() {
        private val _uiState = MutableStateFlow(HomeUiState())
        val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

        init {
            loadHomeData()
        }

        private fun loadHomeData() {
            viewModelScope.launch {
                val selectedUserId = sharedPreferences.getString(PreferenceKeys.SELECTED_USER_ID, null)

                combine(
                    userDao.getAllUsers().map { entities -> entities.map { it.toUser() } },
                    deviceDao.getAllDevices().map { entities -> entities.any { it.isConnected } },
                ) { users, hasConnectedDevice ->
                    // Find selected user, fall back to default user if not found
                    val selectedUser =
                        if (selectedUserId != null) {
                            users.find { it.id == selectedUserId }
                        } else {
                            null
                        } ?: users.find { it.id == DEFAULT_USER_ID } ?: users.firstOrNull()

                    // If we found a user but it wasn't in preferences, save it
                    if (selectedUser != null && selectedUserId != selectedUser.id) {
                        sharedPreferences.edit().putString(PreferenceKeys.SELECTED_USER_ID, selectedUser.id).apply()
                    }

                    HomeUiState(
                        selectedUser = selectedUser,
                        isBoardConnected = hasConnectedDevice,
                        isLoading = false,
                    )
                }.catch { e ->
                    _uiState.update {
                        it.copy(isLoading = false)
                    }
                }.collect { state ->
                    _uiState.value = state
                }
            }
        }

        fun selectUser(userId: String?) {
            sharedPreferences.edit().putString(PreferenceKeys.SELECTED_USER_ID, userId).apply()
            // The flow will automatically update the UI state
        }

        fun clearSelectedUser() {
            selectUser(null)
        }
    }
