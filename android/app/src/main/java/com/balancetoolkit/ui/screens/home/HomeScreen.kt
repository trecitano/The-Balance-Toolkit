package com.balancetoolkit.ui.screens.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.balancetoolkit.R
import com.balancetoolkit.data.model.User
import com.balancetoolkit.ui.components.AppHeader
import com.balancetoolkit.ui.theme.BackgroundGray
import com.balancetoolkit.ui.theme.CardBackground
import com.balancetoolkit.ui.theme.PrimaryBlue
import com.balancetoolkit.ui.theme.TextGray
import com.balancetoolkit.ui.theme.TheBalanceToolkitTheme
import com.balancetoolkit.util.TrackPerformance
import com.balancetoolkit.viewmodel.BoardSelectionStatus
import com.balancetoolkit.viewmodel.HomeUiState
import com.balancetoolkit.viewmodel.HomeViewModel

private val cardShape = RoundedCornerShape(12.dp)
private val buttonShape = RoundedCornerShape(8.dp)
private val connectedColor = Color(0xFF4CAF50)
private val attentionColor = Color(0xFFF57C00)
private val disconnectedColor = Color(0xFF9E9E9E)

@Composable
fun HomeScreen(
    viewModel: HomeViewModel,
    modifier: Modifier = Modifier,
    onNavigateToUsers: () -> Unit = {},
    onNavigateToDevices: () -> Unit = {},
    onNavigateToSession: () -> Unit = {},
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    HomeScreenContent(
        uiState = uiState,
        modifier = modifier,
        onNavigateToUsers = onNavigateToUsers,
        onNavigateToDevices = onNavigateToDevices,
        onNavigateToSession = onNavigateToSession,
    )
}

@Composable
private fun HomeScreenContent(
    uiState: HomeUiState,
    modifier: Modifier = Modifier,
    onNavigateToUsers: () -> Unit = {},
    onNavigateToDevices: () -> Unit = {},
    onNavigateToSession: () -> Unit = {},
) {
    TrackPerformance("HomeScreen")
    val scrollState = rememberScrollState()

    Column(
        modifier =
            modifier
                .fillMaxSize()
                .background(BackgroundGray)
                .verticalScroll(scrollState),
    ) {
        AppHeader()

        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            // Select User Card (first)
            SelectUserCard(
                selectedUser = uiState.selectedUser,
                onNavigateToUsers = onNavigateToUsers,
            )

            // Connection Status Indicator (second)
            ConnectionStatusIndicator(
                boardStatus = uiState.boardStatus,
                selectedBoardName = uiState.selectedBoardName,
                onNavigateToDevices = onNavigateToDevices,
            )

            Spacer(modifier = Modifier.height(8.dp))

            // Start Session Button
            StartSessionButton(
                isEnabled = uiState.selectedUser != null,
                onStartSession = onNavigateToSession,
            )
        }
    }
}

@Composable
private fun ConnectionStatusIndicator(
    boardStatus: BoardSelectionStatus,
    selectedBoardName: String?,
    onNavigateToDevices: () -> Unit,
) {
    val statusText =
        when (boardStatus) {
            BoardSelectionStatus.NoBoardConnected -> stringResource(R.string.no_board_connected)
            BoardSelectionStatus.BoardConnectedNotSelected -> stringResource(R.string.board_connected_select_board)
            BoardSelectionStatus.BoardSelected -> stringResource(R.string.board_selected, selectedBoardName ?: stringResource(R.string.board))
        }
    val statusColor =
        when (boardStatus) {
            BoardSelectionStatus.NoBoardConnected -> disconnectedColor
            BoardSelectionStatus.BoardConnectedNotSelected -> attentionColor
            BoardSelectionStatus.BoardSelected -> connectedColor
        }

    Card(
        onClick = onNavigateToDevices,
        modifier =
            Modifier
                .fillMaxWidth()
                .semantics { contentDescription = statusText },
        shape = cardShape,
        colors = CardDefaults.cardColors(containerColor = CardBackground),
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            // Status dot
            Box(
                modifier =
                    Modifier
                        .size(12.dp)
                        .clip(CircleShape)
                        .background(statusColor),
            )

            Spacer(modifier = Modifier.width(12.dp))

            Text(
                text = statusText,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium,
                modifier = Modifier.weight(1f),
            )

            Text(
                text = stringResource(R.string.go_to_devices),
                style = MaterialTheme.typography.bodySmall,
                color = PrimaryBlue,
            )
        }
    }
}

@Composable
private fun SelectUserCard(
    selectedUser: User?,
    onNavigateToUsers: () -> Unit,
) {
    Card(
        onClick = onNavigateToUsers,
        modifier =
            Modifier
                .fillMaxWidth()
                .semantics {
                    contentDescription = selectedUser?.let { "Selected user: ${it.name}" }
                        ?: "No user selected"
                },
        shape = cardShape,
        colors = CardDefaults.cardColors(containerColor = CardBackground),
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
        ) {
            Text(
                text = stringResource(R.string.selected_user),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
            )

            Spacer(modifier = Modifier.height(16.dp))

            if (selectedUser != null) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    // User avatar
                    Box(
                        modifier =
                            Modifier
                                .size(48.dp)
                                .clip(CircleShape)
                                .background(selectedUser.avatarBackgroundColor),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            imageVector = Icons.Default.Person,
                            contentDescription = null,
                            tint = selectedUser.avatarIconColor,
                            modifier = Modifier.size(28.dp),
                        )
                    }

                    Spacer(modifier = Modifier.width(16.dp))

                    Text(
                        text = selectedUser.name,
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = FontWeight.Medium,
                        modifier = Modifier.weight(1f),
                    )

                    TextButton(onClick = onNavigateToUsers) {
                        Text(
                            text = stringResource(R.string.change),
                            color = PrimaryBlue,
                        )
                    }
                }
            } else {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    // Empty avatar placeholder
                    Box(
                        modifier =
                            Modifier
                                .size(48.dp)
                                .clip(CircleShape)
                                .background(Color(0xFFE0E0E0)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            imageVector = Icons.Default.Person,
                            contentDescription = null,
                            tint = Color(0xFF9E9E9E),
                            modifier = Modifier.size(28.dp),
                        )
                    }

                    Spacer(modifier = Modifier.width(16.dp))

                    Text(
                        text = stringResource(R.string.no_user_selected),
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextGray,
                        modifier = Modifier.weight(1f),
                    )

                    TextButton(onClick = onNavigateToUsers) {
                        Text(
                            text = stringResource(R.string.select),
                            color = PrimaryBlue,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun StartSessionButton(
    isEnabled: Boolean,
    onStartSession: () -> Unit,
) {
    Button(
        onClick = onStartSession,
        modifier =
            Modifier
                .fillMaxWidth()
                .height(56.dp),
        enabled = isEnabled,
        colors =
            ButtonDefaults.buttonColors(
                containerColor = PrimaryBlue,
                disabledContainerColor = Color(0xFFBDBDBD),
            ),
        shape = buttonShape,
    ) {
        Icon(
            imageVector = Icons.Default.PlayArrow,
            contentDescription = null,
            modifier = Modifier.size(24.dp),
        )
        Spacer(modifier = Modifier.width(8.dp))
        Text(
            text = stringResource(R.string.go_to_session),
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
        )
    }

    if (!isEnabled) {
        Text(
            text = stringResource(R.string.select_user_to_start),
            style = MaterialTheme.typography.bodySmall,
            color = TextGray,
            textAlign = TextAlign.Center,
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp),
        )
    }
}

@Preview(showBackground = true)
@Composable
private fun HomeScreenPreviewNoUser() {
    TheBalanceToolkitTheme {
        HomeScreenContent(
            uiState =
                HomeUiState(
                    selectedUser = null,
                    boardStatus = BoardSelectionStatus.NoBoardConnected,
                    isLoading = false,
                ),
        )
    }
}

@Preview(showBackground = true)
@Composable
private fun HomeScreenPreviewWithUser() {
    TheBalanceToolkitTheme {
        HomeScreenContent(
            uiState =
                HomeUiState(
                    selectedUser =
                        User(
                            name = "John Doe",
                            age = 35,
                            weight = 75,
                        ),
                    boardStatus = BoardSelectionStatus.BoardSelected,
                    selectedBoardName = "Wii Board A",
                    isLoading = false,
                ),
        )
    }
}
