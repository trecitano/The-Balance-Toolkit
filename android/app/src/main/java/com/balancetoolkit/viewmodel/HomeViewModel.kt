package com.balancetoolkit.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.balancetoolkit.data.UserSelectionRepository
import com.balancetoolkit.data.local.dao.DeviceDao
import com.balancetoolkit.data.local.dao.UserDao
import com.balancetoolkit.data.local.entity.toDevice
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
    val boardStatus: BoardSelectionStatus = BoardSelectionStatus.NoBoardConnected,
    val selectedBoardName: String? = null,
    val isLoading: Boolean = true,
)

@HiltViewModel
class HomeViewModel
    @Inject
    constructor(
        private val userDao: UserDao,
        private val deviceDao: DeviceDao,
        private val userSelectionRepository: UserSelectionRepository,
    ) : ViewModel() {
        private val _uiState = MutableStateFlow(HomeUiState())
        val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

        init {
            loadHomeData()
        }

        private fun loadHomeData() {
            viewModelScope.launch {
                combine(
                    userDao.getAllUsers().map { entities -> entities.map { it.toUser() } },
                    deviceDao.getAllDevices().map { entities -> entities.map { it.toDevice() } },
                    userSelectionRepository.selectedUserId,
                ) { users, devices, selectedUserId ->
                    // Find selected user, fall back to default user if not found
                    val selectedUser =
                        if (selectedUserId != null) {
                            users.find { it.id == selectedUserId }
                        } else {
                            null
                        } ?: users.find { it.id == DEFAULT_USER_ID } ?: users.firstOrNull()

                    // If we found a user but it wasn't in preferences, save it
                    if (selectedUser != null && selectedUserId != selectedUser.id) {
                        userSelectionRepository.setSelectedUserId(selectedUser.id)
                    }

                    val boardSelectionInfo = devices.toBoardSelectionInfo()

                    HomeUiState(
                        selectedUser = selectedUser,
                        boardStatus = boardSelectionInfo.status,
                        selectedBoardName = boardSelectionInfo.selectedConnectedDevice?.name,
                        isLoading = false,
                    )
                }.catch {
                    _uiState.update {
                        it.copy(isLoading = false)
                    }
                }.collect { state ->
                    _uiState.value = state
                }
            }
        }

        fun selectUser(userId: String?) {
            userSelectionRepository.setSelectedUserId(userId)
        }

        fun clearSelectedUser() {
            selectUser(null)
        }
    }
