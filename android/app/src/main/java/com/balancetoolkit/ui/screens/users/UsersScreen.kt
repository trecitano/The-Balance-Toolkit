package com.balancetoolkit.ui.screens.users

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
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
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.zIndex
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.balancetoolkit.R
import com.balancetoolkit.data.model.DominantHand
import com.balancetoolkit.data.model.Gender
import com.balancetoolkit.data.model.User
import com.balancetoolkit.ui.components.AppHeader
import com.balancetoolkit.ui.components.UserCard
import com.balancetoolkit.ui.components.WeightMeasureBottomSheet
import com.balancetoolkit.ui.theme.BackgroundGray
import com.balancetoolkit.ui.theme.BorderGrayDark
import com.balancetoolkit.ui.theme.CardBackground
import com.balancetoolkit.ui.theme.PrimaryBlue
import com.balancetoolkit.ui.theme.TheBalanceToolkitTheme
import com.balancetoolkit.util.TrackPerformance
import com.balancetoolkit.viewmodel.DevicesViewModel
import com.balancetoolkit.viewmodel.EditUserFormState
import com.balancetoolkit.viewmodel.UsersUiState
import com.balancetoolkit.viewmodel.UsersViewModel

@Composable
fun UsersScreen(
    viewModel: UsersViewModel,
    devicesViewModel: DevicesViewModel,
    modifier: Modifier = Modifier,
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val formState by viewModel.addUserFormState.collectAsStateWithLifecycle()
    val editFormState by viewModel.editUserFormState.collectAsStateWithLifecycle()
    val devicesUiState by devicesViewModel.uiState.collectAsStateWithLifecycle()

    val boardStatus = devicesUiState.boardStatus

    UsersScreenContent(
        uiState = uiState,
        editFormState = editFormState,
        onSearchQueryChange = viewModel::onSearchQueryChange,
        onSearchResultSelected = viewModel::onSearchResultSelected,
        onAddUserClick = viewModel::showAddUserDialog,
        onUserSelected = viewModel::onUserSelected,
        onDeleteUser = { uiState.selectedUser?.let { viewModel.deleteUser(it.id) } },
        onEditClick = viewModel::startEditing,
        onSaveClick = viewModel::saveUserChanges,
        onCancelClick = viewModel::cancelEditing,
        onEditNameChange = viewModel::updateEditName,
        onEditAgeChange = viewModel::updateEditAge,
        onEditGenderChange = viewModel::updateEditGender,
        onEditHeightChange = viewModel::updateEditHeight,
        onEditWeightChange = viewModel::updateEditWeight,
        onEditDominantHandChange = viewModel::updateEditDominantHand,
        onEditColorChange = viewModel::updateEditColor,
        onWeightButtonClick = { viewModel.showWeightMeasureForEdit(boardStatus) },
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
            onWeightButtonClick = { viewModel.showWeightMeasureForAdd(boardStatus) },
            onDismiss = viewModel::hideAddUserDialog,
            onAddUser = viewModel::addUser,
        )
    }

    if (uiState.showWeightMeasure) {
        WeightMeasureBottomSheet(
            boardStatus = boardStatus,
            liveWeight = uiState.liveWeight,
            weightUnit = "kg",
            onAccept = viewModel::acceptWeight,
            onTare = viewModel::tareWeight,
            onDismiss = viewModel::hideWeightMeasure,
        )
    }
}

@Composable
private fun UsersScreenContent(
    uiState: UsersUiState,
    editFormState: EditUserFormState,
    onSearchQueryChange: (String) -> Unit,
    onSearchResultSelected: (String) -> Unit,
    onAddUserClick: () -> Unit,
    onUserSelected: (Int) -> Unit,
    onDeleteUser: () -> Unit,
    onEditClick: () -> Unit,
    onSaveClick: () -> Unit,
    onCancelClick: () -> Unit,
    onEditNameChange: (String) -> Unit,
    onEditAgeChange: (String) -> Unit,
    onEditGenderChange: (Gender) -> Unit,
    onEditHeightChange: (String) -> Unit,
    onEditWeightChange: (String) -> Unit,
    onEditDominantHandChange: (DominantHand) -> Unit,
    onEditColorChange: (Long) -> Unit,
    onWeightButtonClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    TrackPerformance("UsersScreen")
    val scrollState = rememberScrollState()
    val focusManager = LocalFocusManager.current
    val density = LocalDensity.current
    val isSearchDropdownExpanded = remember { mutableStateOf(false) }
    val searchFieldSize = remember { mutableStateOf(IntSize.Zero) }

    Column(
        modifier =
            modifier
                .fillMaxSize()
                .background(BackgroundGray)
                .clickable(
                    interactionSource = remember { MutableInteractionSource() },
                    indication = null,
                ) {
                    focusManager.clearFocus()
                    isSearchDropdownExpanded.value = false
                },
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
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .zIndex(1f),
            ) {
                OutlinedTextField(
                    value = uiState.searchQuery,
                    onValueChange = {
                        onSearchQueryChange(it)
                        isSearchDropdownExpanded.value = it.isNotBlank()
                    },
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .onGloballyPositioned { coordinates ->
                                searchFieldSize.value = coordinates.size
                            }
                            .semantics { contentDescription = "Search users" },
                    placeholder = { Text(stringResource(R.string.search_placeholder)) },
                    leadingIcon = {
                        Icon(
                            imageVector = Icons.Default.Search,
                            contentDescription = null,
                        )
                    },
                    trailingIcon = {
                        if (uiState.searchQuery.isNotBlank()) {
                            IconButton(
                                onClick = {
                                    onSearchQueryChange("")
                                    isSearchDropdownExpanded.value = false
                                },
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Close,
                                    contentDescription = stringResource(R.string.close),
                                )
                            }
                        }
                    },
                    shape = RoundedCornerShape(8.dp),
                    colors =
                        OutlinedTextFieldDefaults.colors(
                            unfocusedContainerColor = CardBackground,
                            focusedContainerColor = CardBackground,
                        ),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                    keyboardActions =
                        KeyboardActions(
                            onSearch = {
                                focusManager.clearFocus()
                                isSearchDropdownExpanded.value = false
                            },
                        ),
                )

                if (uiState.searchQuery.isNotBlank() && isSearchDropdownExpanded.value) {
                    val verticalGapPx = with(density) { 4.dp.roundToPx() }

                    Layout(
                        modifier = Modifier.fillMaxWidth(),
                        content = {
                            Surface(
                                modifier =
                                    Modifier
                                        .fillMaxWidth()
                                        .animateContentSize(),
                                shape = RoundedCornerShape(8.dp),
                                color = CardBackground,
                                tonalElevation = 4.dp,
                                shadowElevation = 2.dp,
                            ) {
                                Column {
                                    if (uiState.searchMatches.isEmpty()) {
                                        Text(
                                            text = stringResource(R.string.search_no_matches),
                                            modifier =
                                                Modifier
                                                    .fillMaxWidth()
                                                    .padding(horizontal = 16.dp, vertical = 12.dp),
                                            style = MaterialTheme.typography.bodyMedium,
                                        )
                                    } else {
                                        uiState.searchMatches.forEach { user ->
                                            Text(
                                                text = user.name,
                                                modifier =
                                                    Modifier
                                                        .fillMaxWidth()
                                                        .clickable {
                                                            onSearchResultSelected(user.id)
                                                            isSearchDropdownExpanded.value = false
                                                            focusManager.clearFocus()
                                                        }.padding(horizontal = 16.dp, vertical = 12.dp),
                                                style = MaterialTheme.typography.bodyLarge,
                                            )
                                        }
                                    }
                                }
                            }
                        },
                    ) { measurables, constraints ->
                        val menuPlaceables =
                            measurables.map {
                                it.measure(
                                    constraints.copy(
                                        minWidth = constraints.maxWidth,
                                        minHeight = 0,
                                    ),
                                )
                            }

                        layout(constraints.maxWidth, 0) {
                            val yOffset = searchFieldSize.value.height + verticalGapPx
                            menuPlaceables.forEach { placeable ->
                                placeable.placeRelative(0, yOffset)
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            if (uiState.isLoading) {
                Box(
                    modifier = Modifier.fillMaxWidth().height(320.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator()
                }
            } else {
                // User Carousel
                if (uiState.allUsers.isNotEmpty()) {
                    UserCarousel(
                        users = uiState.allUsers,
                        selectedIndex = uiState.selectedUserIndex,
                        onUserSelected = onUserSelected,
                    )
                }

                Spacer(modifier = Modifier.height(24.dp))

                // User Details Card
                uiState.selectedUser?.let { user ->
                    UserDetailsCard(
                        user = user,
                        isEditing = uiState.isEditing,
                        onEditClick = onEditClick,
                        onSaveClick = onSaveClick,
                        onCancelClick = onCancelClick,
                        onDelete = onDeleteUser,
                        onNameChange = onEditNameChange,
                        onAgeChange = onEditAgeChange,
                        onGenderChange = onEditGenderChange,
                        onHeightChange = onEditHeightChange,
                        onWeightChange = onEditWeightChange,
                        onDominantHandChange = onEditDominantHandChange,
                        onColorChange = { color -> onEditColorChange(color.toArgb().toUInt().toLong()) },
                        onWeightButtonClick = onWeightButtonClick,
                        editName = editFormState.name,
                        editAge = editFormState.age,
                        editGender = editFormState.gender,
                        editHeight = editFormState.height,
                        editWeight = editFormState.weight,
                        editDominantHand = editFormState.dominantHand,
                        editColor = Color(editFormState.color.toInt()),
                        canDelete = !user.isDefaultUser,
                        canEditName = !user.isDefaultUser,
                    )
                }
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

    // Animate to selected user when selectedIndex changes (from click)
    LaunchedEffect(selectedIndex) {
        if (pagerState.currentPage != selectedIndex) {
            pagerState.animateScrollToPage(selectedIndex)
        }
    }

    // Calculate contentPadding to show 3 users at once:
    // - First user: center with one on the right
    // - Last user: center with one on the left
    // - Others: center with one on each side
    val pageWidth = 150.dp
    val pageSpacing = 8.dp

    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
            val sidePadding = ((maxWidth - pageWidth) / 2).coerceAtLeast(0.dp)

            HorizontalPager(
                modifier = Modifier.fillMaxWidth(),
                state = pagerState,
                pageSpacing = pageSpacing,
                pageSize = PageSize.Fixed(pageWidth),
                contentPadding = PaddingValues(horizontal = sidePadding),
                key = { users[it].id },
            ) { page ->
                val user = users[page]
                UserCard(
                    name = user.name,
                    isSelected = page == selectedIndex,
                    updateDate = user.updatedAt,
                    avatarBackgroundColor = user.avatarBackgroundColor,
                    avatarIconColor = user.avatarIconColor,
                    onClick = { onUserSelected(page) },
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Carousel Indicators
        CarouselIndicators(
            pageCount = users.size,
            currentPage = selectedIndex,
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
        val mockUsers =
            listOf(
                User(
                    id = "1",
                    name = "John Doe",
                ),
                User(
                    id = "2",
                    name = "Jane Smith",
                ),
                User(
                    id = "3",
                    name = "Bob Wilson",
                ),
            )

        UsersScreenContent(
            uiState =
                UsersUiState(
                    allUsers = mockUsers,
                    selectedUser = mockUsers.first(),
                    selectedUserIndex = 0,
                ),
            editFormState = EditUserFormState(),
            onSearchQueryChange = {},
            onSearchResultSelected = {},
            onAddUserClick = {},
            onUserSelected = {},
            onDeleteUser = {},
            onEditClick = {},
            onSaveClick = {},
            onCancelClick = {},
            onEditNameChange = {},
            onEditAgeChange = {},
            onEditGenderChange = {},
            onEditHeightChange = {},
            onEditWeightChange = {},
            onEditDominantHandChange = {},
            onEditColorChange = {},
            onWeightButtonClick = {},
        )
    }
}
