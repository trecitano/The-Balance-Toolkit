package com.balancetoolkit.ui.screens.users

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.PageSize
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.balancetoolkit.R
import com.balancetoolkit.data.model.User
import com.balancetoolkit.ui.components.AppHeader
import com.balancetoolkit.ui.components.UserCard
import com.balancetoolkit.ui.theme.BackgroundGray
import com.balancetoolkit.ui.theme.BorderGrayDark
import com.balancetoolkit.ui.theme.CardBackground
import com.balancetoolkit.ui.theme.PrimaryBlue
import com.balancetoolkit.ui.theme.TheBalanceToolkitTheme
import com.balancetoolkit.util.TrackPerformance
import com.balancetoolkit.viewmodel.UsersUiState
import com.balancetoolkit.viewmodel.UsersViewModel

@Composable
fun UsersScreen(
    viewModel: UsersViewModel,
    modifier: Modifier = Modifier,
) {
    val uiState by viewModel.uiState.collectAsState()
    val formState by viewModel.addUserFormState.collectAsState()

    UsersScreenContent(
        uiState = uiState,
        onSearchQueryChange = viewModel::onSearchQueryChange,
        onAddUserClick = viewModel::showAddUserDialog,
        onUserSelected = viewModel::onUserSelected,
        onDeleteUser = { uiState.selectedUser?.let { viewModel.deleteUser(it.id) } },
        modifier = modifier,
    )

    if (uiState.showAddUserDialog) {
        AddUserDialog(
            formState = formState,
            onNameChange = viewModel::updateFormName,
            onAgeChange = viewModel::updateFormAge,
            onGenderChange = viewModel::updateFormGender,
            onHeightChange = viewModel::updateFormHeight,
            onWeightChange = viewModel::updateFormWeight,
            onDominantHandChange = viewModel::updateFormDominantHand,
            onColorChange = viewModel::updateFormColor,
            onNotesChange = viewModel::updateFormNotes,
            onDismiss = viewModel::hideAddUserDialog,
            onAddUser = viewModel::addUser,
        )
    }
}

@Composable
private fun UsersScreenContent(
    uiState: UsersUiState,
    onSearchQueryChange: (String) -> Unit,
    onAddUserClick: () -> Unit,
    onUserSelected: (Int) -> Unit,
    onDeleteUser: () -> Unit,
    modifier: Modifier = Modifier,
) {
    TrackPerformance("UsersScreen")
    val scrollState = rememberScrollState()

    Column(
        modifier =
            modifier
                .fillMaxSize()
                .background(BackgroundGray),
    ) {
        AppHeader()

        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .verticalScroll(scrollState)
                    .padding(16.dp),
        ) {
            // Title and Button Row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = stringResource(R.string.users),
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold,
                )

                Button(
                    onClick = onAddUserClick,
                    colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue),
                    shape = RoundedCornerShape(8.dp),
                    modifier =
                        Modifier.semantics {
                            contentDescription = "Add new user button"
                        },
                ) {
                    Icon(
                        imageVector = Icons.Default.Add,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp),
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(stringResource(R.string.add_new_user))
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Search Bar
            OutlinedTextField(
                value = uiState.searchQuery,
                onValueChange = onSearchQueryChange,
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .semantics { contentDescription = "Search users" },
                placeholder = { Text(stringResource(R.string.search_placeholder)) },
                leadingIcon = {
                    Icon(
                        imageVector = Icons.Default.Search,
                        contentDescription = null,
                    )
                },
                shape = RoundedCornerShape(8.dp),
                colors =
                    OutlinedTextFieldDefaults.colors(
                        unfocusedContainerColor = CardBackground,
                        focusedContainerColor = CardBackground,
                    ),
            )

            Spacer(modifier = Modifier.height(24.dp))

            // User Carousel
            if (uiState.users.isNotEmpty()) {
                UserCarousel(
                    users = uiState.users,
                    selectedIndex = uiState.selectedUserIndex,
                    onUserSelected = onUserSelected,
                )
            }

            Spacer(modifier = Modifier.height(24.dp))

            // User Details Card
            uiState.selectedUser?.let { user ->
                UserDetailsCard(
                    user = user,
                    onEdit = { /* Edit user */ },
                    onDelete = onDeleteUser,
                    canDelete = !user.isDefaultUser,
                )
            }

            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}

@Composable
private fun UserCarousel(
    users: List<User>,
    selectedIndex: Int,
    onUserSelected: (Int) -> Unit,
) {
    val pagerState =
        rememberPagerState(
            initialPage = selectedIndex.coerceIn(0, users.size - 1),
            pageCount = { users.size },
        )

    // Sync pager state changes back to ViewModel
    LaunchedEffect(pagerState) {
        snapshotFlow { pagerState.settledPage }
            .collect { page ->
                if (page != selectedIndex) {
                    onUserSelected(page)
                }
            }
    }

    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        HorizontalPager(
            state = pagerState,
            pageSpacing = 1.dp,
            pageSize = PageSize.Fixed(150.dp),
            key = { users[it].id },
        ) { page ->
            val user = users[page]
            UserCard(
                name = user.name,
                isSelected = page == pagerState.settledPage,
                updateDate = user.updatedAt,
                avatarBackgroundColor = user.avatarBackgroundColor,
                avatarIconColor = user.avatarIconColor,
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Carousel Indicators
        CarouselIndicators(
            pageCount = users.size,
            currentPage = pagerState.currentPage,
        )
    }
}

@Composable
private fun CarouselIndicators(
    pageCount: Int,
    currentPage: Int,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .semantics { contentDescription = "Page $currentPage of $pageCount" },
        horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        repeat(pageCount) { index ->
            val isActive = currentPage == index
            Box(
                modifier =
                    Modifier
                        .size(if (isActive) 20.dp else 8.dp, 8.dp)
                        .background(
                            if (isActive) PrimaryBlue else BorderGrayDark,
                            RoundedCornerShape(4.dp),
                        ),
            )
        }
    }
}

@Preview(showBackground = true)
@Composable
private fun UsersScreenPreview() {
    TheBalanceToolkitTheme {
        val mockUsers = listOf(
            User(
                id = "1",
                name = "John Doe",
                //isDefaultUser = true,
                //updatedAt = System.currentTimeMillis(),
            ),
            User(
                id = "2",
                name = "Jane Smith",
                //isDefaultUser = false,
                //updatedAt = System.currentTimeMillis(),
            ),
            User(
                id = "3",
                name = "Bob Wilson",
                //isDefaultUser = false,
                //updatedAt = System.currentTimeMillis(),
            ),
        )

        UsersScreenContent(
            uiState = UsersUiState(
                users = mockUsers,
                selectedUser = mockUsers.first(),
                selectedUserIndex = 0,
            ),
            onSearchQueryChange = {},
            onAddUserClick = {},
            onUserSelected = {},
            onDeleteUser = {},
        )
    }
}
