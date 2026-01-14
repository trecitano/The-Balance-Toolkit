package com.balancetoolkit.viewmodel

import android.content.SharedPreferences
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.balancetoolkit.data.Result
import com.balancetoolkit.data.local.dao.UserDao
import com.balancetoolkit.data.local.entity.toEntity
import com.balancetoolkit.data.local.entity.toUser
import com.balancetoolkit.data.model.DEFAULT_USER_ID
import com.balancetoolkit.data.model.DominantHand
import com.balancetoolkit.data.model.Gender
import com.balancetoolkit.data.model.User
import com.balancetoolkit.data.model.getAvatarColors
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

private const val PREF_SELECTED_USER_ID = "selected_user_id"

data class UsersUiState(
    val users: List<User> = emptyList(),
    val selectedUser: User? = null,
    val selectedUserIndex: Int = 0,
    val searchQuery: String = "",
    val isLoading: Boolean = false,
    val showAddUserDialog: Boolean = false,
    val error: String? = null,
)

data class AddUserFormState(
    val name: String = "",
    val age: String = "25",
    val gender: Gender = Gender.MALE,
    val height: String = "170",
    val weight: String = "70",
    val dominantHand: DominantHand = DominantHand.RIGHT,
    val color: String = "#3B82F6",
    val notes: String = "",
) {
    val isValid: Boolean
        get() = name.isNotBlank()

    val nameError: String?
        get() = if (name.isBlank()) "Name is required" else null
}

class UsersViewModel(
    private val userDao: UserDao,
    private val sharedPreferences: SharedPreferences,
) : ViewModel() {
    private val _uiState = MutableStateFlow(UsersUiState(isLoading = true))
    val uiState: StateFlow<UsersUiState> = _uiState.asStateFlow()

    private val _addUserFormState = MutableStateFlow(AddUserFormState())
    val addUserFormState: StateFlow<AddUserFormState> = _addUserFormState.asStateFlow()

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
            if (sharedPreferences.getString(PREF_SELECTED_USER_ID, null) == null) {
                sharedPreferences.edit().putString(PREF_SELECTED_USER_ID, DEFAULT_USER_ID).apply()
            }
        }
    }

    private fun loadUsers() {
        viewModelScope.launch {
            val savedUserId = sharedPreferences.getString(PREF_SELECTED_USER_ID, null)
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
                            users = users,
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
        _uiState.update { state ->
            val user = state.users.getOrNull(index)
            // Save selected user to SharedPreferences for use on Home screen
            if (user != null) {
                sharedPreferences.edit().putString(PREF_SELECTED_USER_ID, user.id).apply()
            }
            state.copy(
                selectedUserIndex = index,
                selectedUser = user,
            )
        }
    }

    fun showAddUserDialog() {
        _addUserFormState.value = AddUserFormState()
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

    fun updateFormNotes(notes: String) {
        _addUserFormState.update { it.copy(notes = notes) }
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
                            notes = formState.notes,
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

    class Factory(
        private val userDao: UserDao,
        private val sharedPreferences: SharedPreferences,
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            if (modelClass.isAssignableFrom(UsersViewModel::class.java)) {
                return UsersViewModel(userDao, sharedPreferences) as T
            }
            throw IllegalArgumentException("Unknown ViewModel class")
        }
    }
}
