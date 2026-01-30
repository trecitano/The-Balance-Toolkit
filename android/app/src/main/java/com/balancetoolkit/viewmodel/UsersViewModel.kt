package com.balancetoolkit.viewmodel

import android.content.SharedPreferences
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.balancetoolkit.bluetooth.BalanceBoardConnectionManager
import com.balancetoolkit.bluetooth.SimpleWeightListener
import com.balancetoolkit.data.PreferenceKeys
import com.balancetoolkit.data.Result
import com.balancetoolkit.data.local.dao.UserDao
import com.balancetoolkit.data.local.entity.toEntity
import com.balancetoolkit.data.local.entity.toUser
import com.balancetoolkit.data.model.DEFAULT_USER_ID
import com.balancetoolkit.data.model.DominantHand
import com.balancetoolkit.data.model.Gender
import com.balancetoolkit.data.model.User
import com.balancetoolkit.data.model.getAvatarColors
import com.balancetoolkit.ui.theme.UserColors
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

enum class WeightMeasureTarget {
    EDIT_USER,
    ADD_USER,
}

data class UsersUiState(
    val allUsers: List<User> = emptyList(),
    val selectedUser: User? = null,
    val selectedUserIndex: Int = 0,
    val searchQuery: String = "",
    val isLoading: Boolean = false,
    val showAddUserDialog: Boolean = false,
    val isEditing: Boolean = false,
    val error: String? = null,
    val showWeightMeasure: Boolean = false,
    val liveWeight: Float? = null,
    val weightMeasureTarget: WeightMeasureTarget = WeightMeasureTarget.EDIT_USER,
) {
    val users: List<User>
        get() = if (searchQuery.isBlank()) {
            allUsers
        } else {
            allUsers.filter { it.name.contains(searchQuery, ignoreCase = true) }
        }
}

data class AddUserFormState(
    val name: String = "",
    val age: String = "25",
    val gender: Gender = Gender.MALE,
    val height: String = "170",
    val weight: String = "70",
    val dominantHand: DominantHand = DominantHand.RIGHT,
    val color: String = "#3B82F6",
) {
    val isValid: Boolean
        get() = name.isNotBlank()

    val nameError: String?
        get() = if (name.isBlank()) "Name is required" else null
}

data class EditUserFormState(
    val name: String = "",
    val age: String = "25",
    val gender: Gender = Gender.MALE,
    val height: String = "170",
    val weight: String = "70",
    val dominantHand: DominantHand = DominantHand.RIGHT,
    val color: Long = 0xFF3B82F6,
) {
    val isValid: Boolean
        get() = name.isNotBlank()

    val colorHex: String
        get() = "#%06X".format(color.toInt() and 0xFFFFFF)
}

@HiltViewModel
class UsersViewModel @Inject constructor(
    private val userDao: UserDao,
    private val sharedPreferences: SharedPreferences,
    private val connectionManager: BalanceBoardConnectionManager,
) : ViewModel() {
    private val _uiState = MutableStateFlow(UsersUiState(isLoading = true))
    val uiState: StateFlow<UsersUiState> = _uiState.asStateFlow()

    private val _addUserFormState = MutableStateFlow(AddUserFormState())
    val addUserFormState: StateFlow<AddUserFormState> = _addUserFormState.asStateFlow()

    private val _editUserFormState = MutableStateFlow(EditUserFormState())
    val editUserFormState: StateFlow<EditUserFormState> = _editUserFormState.asStateFlow()

    // Weight measurement listener
    private val weightMeasureListener = SimpleWeightListener { totalWeight ->
        viewModelScope.launch(Dispatchers.Main) {
            _uiState.update { it.copy(liveWeight = totalWeight) }
        }
    }

    init {
        viewModelScope.launch {
            ensureDefaultUserExists()
            loadUsers()
        }
    }

    private suspend fun ensureDefaultUserExists() {
        val existingDefaultUser = userDao.getUserById(DEFAULT_USER_ID)
        if (existingDefaultUser == null) {
            val defaultUser = User(
                id = DEFAULT_USER_ID,
                name = "Default User",
                updatedAt = java.time.LocalDate.now().toString(),
            )
            userDao.insertUser(defaultUser.toEntity())
            // Set default user as selected if no user was previously selected
            if (sharedPreferences.getString(PreferenceKeys.SELECTED_USER_ID, null) == null) {
                sharedPreferences.edit().putString(PreferenceKeys.SELECTED_USER_ID, DEFAULT_USER_ID).apply()
            }
        }
    }

    private fun loadUsers() {
        viewModelScope.launch {
            val savedUserId = sharedPreferences.getString(PreferenceKeys.SELECTED_USER_ID, null)
                ?: DEFAULT_USER_ID  // Default to default user if nothing saved

            userDao
                .getAllUsers()
                .map { entities -> entities.map { it.toUser() } }
                .catch { e ->
                    _uiState.update {
                        it.copy(isLoading = false, error = e.message ?: "Failed to load users")
                    }
                }.collect { users ->
                    _uiState.update { state ->
                        // Try to find the saved user, otherwise use the default user
                        val savedIndex = users.indexOfFirst { it.id == savedUserId }.takeIf { it >= 0 }
                            ?: users.indexOfFirst { it.id == DEFAULT_USER_ID }.takeIf { it >= 0 }
                            ?: 0
                        val selectedIndex = savedIndex.coerceIn(0, (users.size - 1).coerceAtLeast(0))
                        state.copy(
                            allUsers = users,
                            selectedUser = users.getOrNull(selectedIndex),
                            selectedUserIndex = selectedIndex,
                            isLoading = false,
                            error = null,
                        )
                    }
                }
        }
    }

    fun onSearchQueryChange(query: String) {
        _uiState.update { it.copy(searchQuery = query) }
    }

    fun onUserSelected(index: Int) {
        val currentState = _uiState.value
        val filteredUsers = currentState.users
        val user = filteredUsers.getOrNull(index)
        // Save selected user to SharedPreferences for use on Home screen
        if (user != null) {
            sharedPreferences.edit().putString(PreferenceKeys.SELECTED_USER_ID, user.id).apply()
        }
        _uiState.update { state ->
            state.copy(
                selectedUserIndex = index,
                selectedUser = user,
            )
        }
    }

    fun showAddUserDialog() {
        _addUserFormState.value = AddUserFormState(color = UserColors.randomHex())
        _uiState.update { it.copy(showAddUserDialog = true) }
    }

    fun hideAddUserDialog() {
        _uiState.update { it.copy(showAddUserDialog = false) }
    }

    fun updateFormName(name: String) {
        _addUserFormState.update { it.copy(name = name) }
    }

    fun updateFormAge(age: String) {
        _addUserFormState.update { it.copy(age = age) }
    }

    fun updateFormGender(gender: Gender) {
        _addUserFormState.update { it.copy(gender = gender) }
    }

    fun updateFormHeight(height: String) {
        _addUserFormState.update { it.copy(height = height) }
    }

    fun updateFormWeight(weight: String) {
        _addUserFormState.update { it.copy(weight = weight) }
    }

    fun updateFormDominantHand(hand: DominantHand) {
        _addUserFormState.update { it.copy(dominantHand = hand) }
    }

    fun updateFormColor(color: String) {
        _addUserFormState.update { it.copy(color = color) }
    }

    fun addUser() {
        val formState = _addUserFormState.value
        if (!formState.isValid) return

        viewModelScope.launch {
            val result =
                runCatching {
                    val (bgColor, iconColor) = getAvatarColors(formState.color)
                    val newUser =
                        User(
                            name = formState.name,
                            age = formState.age.toIntOrNull() ?: 25,
                            gender = formState.gender,
                            height = formState.height.toIntOrNull() ?: 170,
                            weight = formState.weight.toIntOrNull() ?: 70,
                            dominantHand = formState.dominantHand,
                            color = formState.color,
                            updatedAt =
                                java.time.LocalDate
                                    .now()
                                    .toString(),
                            avatarBackgroundColor = bgColor,
                            avatarIconColor = iconColor,
                        )
                    userDao.insertUser(newUser.toEntity())
                    Result.Success(newUser)
                }.getOrElse { e ->
                    Result.Error(e.message ?: "Failed to add user", e)
                }

            when (result) {
                is Result.Success -> {
                    _uiState.update { it.copy(showAddUserDialog = false, error = null) }
                }
                is Result.Error -> {
                    _uiState.update { it.copy(error = result.message) }
                }
            }
        }
    }

    fun deleteUser(userId: String) {
        // Prevent deletion of the default user
        if (userId == DEFAULT_USER_ID) {
            _uiState.update { it.copy(error = "Cannot delete the default user") }
            return
        }

        viewModelScope.launch {
            val result =
                runCatching {
                    userDao.deleteUserById(userId)
                    Result.Success(Unit)
                }.getOrElse { e ->
                    Result.Error(e.message ?: "Failed to delete user", e)
                }

            when (result) {
                is Result.Success -> {
                    _uiState.update { it.copy(error = null) }
                }
                is Result.Error -> {
                    _uiState.update { it.copy(error = result.message) }
                }
            }
        }
    }

    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }

    // Edit mode methods
    fun startEditing() {
        val user = _uiState.value.selectedUser ?: return
        val colorLong = try {
            android.graphics.Color.parseColor(user.color).toLong() or 0xFF000000
        } catch (e: IllegalArgumentException) {
            0xFF3B82F6L
        }
        _editUserFormState.value = EditUserFormState(
            name = user.name,
            age = user.age.toString(),
            gender = user.gender,
            height = user.height.toString(),
            weight = user.weight.toString(),
            dominantHand = user.dominantHand,
            color = colorLong,
        )
        _uiState.update { it.copy(isEditing = true) }
    }

    fun cancelEditing() {
        _uiState.update { it.copy(isEditing = false) }
    }

    fun saveUserChanges() {
        val user = _uiState.value.selectedUser ?: return
        val formState = _editUserFormState.value
        if (!formState.isValid) return

        viewModelScope.launch {
            val result =
                runCatching {
                    val (bgColor, iconColor) = getAvatarColors(formState.colorHex)
                    val updatedUser = user.copy(
                        name = if (user.isDefaultUser) user.name else formState.name,
                        age = formState.age.toIntOrNull() ?: user.age,
                        gender = formState.gender,
                        height = formState.height.toIntOrNull() ?: user.height,
                        weight = formState.weight.toIntOrNull() ?: user.weight,
                        dominantHand = formState.dominantHand,
                        color = formState.colorHex,
                        updatedAt = java.time.LocalDate.now().toString(),
                        avatarBackgroundColor = bgColor,
                        avatarIconColor = iconColor,
                    )
                    userDao.updateUser(updatedUser.toEntity())
                    Result.Success(updatedUser)
                }.getOrElse { e ->
                    Result.Error(e.message ?: "Failed to update user", e)
                }

            when (result) {
                is Result.Success -> {
                    _uiState.update { it.copy(isEditing = false, error = null) }
                }
                is Result.Error -> {
                    _uiState.update { it.copy(error = result.message) }
                }
            }
        }
    }

    fun updateEditName(name: String) {
        _editUserFormState.update { it.copy(name = name) }
    }

    fun updateEditAge(age: String) {
        _editUserFormState.update { it.copy(age = age) }
    }

    fun updateEditGender(gender: Gender) {
        _editUserFormState.update { it.copy(gender = gender) }
    }

    fun updateEditHeight(height: String) {
        _editUserFormState.update { it.copy(height = height) }
    }

    fun updateEditWeight(weight: String) {
        _editUserFormState.update { it.copy(weight = weight) }
    }

    fun updateEditDominantHand(hand: DominantHand) {
        _editUserFormState.update { it.copy(dominantHand = hand) }
    }

    fun updateEditColor(colorLong: Long) {
        _editUserFormState.update { it.copy(color = colorLong) }
    }

    // Weight measure methods
    fun showWeightMeasureForEdit(hasConnectedDevice: Boolean) {
        _uiState.update { it.copy(showWeightMeasure = true, weightMeasureTarget = WeightMeasureTarget.EDIT_USER) }
        if (hasConnectedDevice) {
            startWeightMeasurement()
        }
    }

    fun showWeightMeasureForAdd(hasConnectedDevice: Boolean) {
        _uiState.update { it.copy(showWeightMeasure = true, weightMeasureTarget = WeightMeasureTarget.ADD_USER) }
        if (hasConnectedDevice) {
            startWeightMeasurement()
        }
    }

    fun hideWeightMeasure() {
        stopWeightMeasurement()
        _uiState.update { it.copy(showWeightMeasure = false, liveWeight = null) }
    }

    private fun startWeightMeasurement() {
        connectionManager.start(weightMeasureListener)
    }

    private fun stopWeightMeasurement() {
        connectionManager.stop()
    }

    fun acceptWeight() {
        val weight = _uiState.value.liveWeight ?: return
        val formattedWeight = "%.2f".format(weight)
        when (_uiState.value.weightMeasureTarget) {
            WeightMeasureTarget.EDIT_USER -> {
                _editUserFormState.update { it.copy(weight = formattedWeight) }
            }
            WeightMeasureTarget.ADD_USER -> {
                _addUserFormState.update { it.copy(weight = formattedWeight) }
            }
        }
        hideWeightMeasure()
    }

    fun tareWeight() {
        connectionManager.tare()
    }

    override fun onCleared() {
        super.onCleared()
        stopWeightMeasurement()
    }
}
