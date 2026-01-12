package com.balancetoolkit.ui.screens.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.balancetoolkit.R
import com.balancetoolkit.data.model.SessionStats
import com.balancetoolkit.ui.components.AppHeader
import com.balancetoolkit.ui.components.BoardVisualization
import com.balancetoolkit.ui.theme.BackgroundGray
import com.balancetoolkit.ui.theme.CardBackground
import com.balancetoolkit.ui.theme.PrimaryBlue
import com.balancetoolkit.ui.theme.TextGray
import com.balancetoolkit.ui.theme.TheBalanceToolkitTheme
import com.balancetoolkit.util.TrackPerformance
import com.balancetoolkit.viewmodel.HomeUiState
import com.balancetoolkit.viewmodel.HomeViewModel

private val cardShape = RoundedCornerShape(12.dp)
private val buttonShape = RoundedCornerShape(8.dp)
private val darkButtonColor = Color(0xFF424242)

@Composable
fun HomeScreen(
    viewModel: HomeViewModel,
    modifier: Modifier = Modifier,
    onNavigateToDevices: () -> Unit = {},
    onNavigateToReplay: () -> Unit = {},
) {
    val uiState by viewModel.uiState.collectAsState()

    HomeScreenContent(
        uiState = uiState,
        modifier = modifier,
        onNavigateToDevices = onNavigateToDevices,
        onNavigateToReplay = onNavigateToReplay,
    )
}

@Composable
private fun HomeScreenContent(
    uiState: HomeUiState,
    modifier: Modifier = Modifier,
    onNavigateToDevices: () -> Unit = {},
    onNavigateToReplay: () -> Unit = {},
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
        AppHeader(showWelcome = true, showLinks = true)

        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            uiState.lastSessionStats?.let { stats ->
                LastSessionCard(
                    stats = stats,
                    onNavigateToReplay = onNavigateToReplay,
                )
            }

            ConnectionCard(
                connectedCount = uiState.connectedBoardsCount,
                connectedBoards = uiState.connectedBoardIndices,
                onNavigateToDevices = onNavigateToDevices,
            )
        }
    }
}

@Composable
private fun LastSessionCard(
    stats: SessionStats,
    onNavigateToReplay: () -> Unit,
) {
    Card(
        modifier =
            Modifier
                .fillMaxWidth()
                .semantics { contentDescription = "Last session information" },
        shape = cardShape,
        colors = CardDefaults.cardColors(containerColor = CardBackground),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = stringResource(R.string.last_session),
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
            )

            Spacer(modifier = Modifier.height(16.dp))

            Row(modifier = Modifier.fillMaxWidth()) {
                // Stats Column
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = stringResource(R.string.stats),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = stringResource(R.string.duration_seconds, stats.duration),
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextGray,
                    )
                    Text(
                        text = stringResource(R.string.board_number, stats.boardNumber),
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextGray,
                    )
                }

                // User Column
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = stringResource(R.string.user),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = stringResource(R.string.name_value, stats.userName),
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextGray,
                    )
                    Text(
                        text = stringResource(R.string.age_value, stats.userAge),
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextGray,
                    )
                    Text(
                        text = stringResource(R.string.weight_value, stats.userWeight),
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextGray,
                    )
                    Text(
                        text = stringResource(R.string.gender_value, stats.userGender),
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextGray,
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = stringResource(R.string.file),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = stats.filePath,
                style = MaterialTheme.typography.bodySmall,
                color = TextGray,
            )

            Spacer(modifier = Modifier.height(16.dp))

            Button(
                onClick = onNavigateToReplay,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = darkButtonColor),
                shape = buttonShape,
            ) {
                Icon(
                    imageVector = Icons.Default.PlayArrow,
                    contentDescription = null,
                    modifier = Modifier.size(20.dp),
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(stringResource(R.string.go_to_replay))
                Spacer(modifier = Modifier.width(4.dp))
                Text("→")
            }
        }
    }
}

@Composable
private fun ConnectionCard(
    connectedCount: Int,
    connectedBoards: List<Int>,
    onNavigateToDevices: () -> Unit,
) {
    Card(
        modifier =
            Modifier
                .fillMaxWidth()
                .semantics { contentDescription = "$connectedCount boards connected" },
        shape = cardShape,
        colors = CardDefaults.cardColors(containerColor = CardBackground),
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Column(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = stringResource(R.string.connection),
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                )

                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    text = stringResource(R.string.connected_boards_count, connectedCount),
                    style = MaterialTheme.typography.bodyMedium,
                )
                Text(
                    text = stringResource(R.string.go_to_devices_hint),
                    style = MaterialTheme.typography.bodySmall,
                    color = TextGray,
                )
            }

            Spacer(modifier = Modifier.height(24.dp))

            BoardVisualization(connectedBoards = connectedBoards)

            Spacer(modifier = Modifier.height(24.dp))

            Button(
                onClick = onNavigateToDevices,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue),
                shape = buttonShape,
            ) {
                Icon(
                    imageVector = Icons.Default.Phone,
                    contentDescription = null,
                    modifier = Modifier.size(20.dp),
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(stringResource(R.string.go_to_devices))
                Spacer(modifier = Modifier.width(4.dp))
                Text("→")
            }
        }
    }
}

@Preview(showBackground = true)
@Composable
private fun HomeScreenPreview() {
    TheBalanceToolkitTheme {
        HomeScreenContent(
            uiState =
                HomeUiState(
                    lastSessionStats =
                        SessionStats(
                            duration = 122,
                            boardNumber = "7.1.1J",
                            userName = "Mario",
                            userAge = 44,
                            userWeight = 70,
                            userGender = "Male",
                            filePath = "C:\\sessions\\test.json",
                        ),
                    connectedBoardsCount = 3,
                    connectedBoardIndices = listOf(0, 1, 2),
                ),
        )
    }
}
