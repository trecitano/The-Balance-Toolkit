package com.balancetoolkit.ui.screens.devices

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
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
import com.balancetoolkit.data.model.Device
import com.balancetoolkit.ui.components.AppHeader
import com.balancetoolkit.ui.components.DeviceCard
import com.balancetoolkit.ui.theme.BackgroundGray
import com.balancetoolkit.ui.theme.TheBalanceToolkitTheme
import com.balancetoolkit.util.TrackPerformance
import com.balancetoolkit.viewmodel.DevicesUiState
import com.balancetoolkit.viewmodel.DevicesViewModel

private val scanButtonColor = Color(0xFF424242)
private val buttonShape = RoundedCornerShape(8.dp)

@Composable
fun DevicesScreen(
    viewModel: DevicesViewModel,
    modifier: Modifier = Modifier,
) {
    val uiState by viewModel.uiState.collectAsState()

    DevicesScreenContent(
        uiState = uiState,
        onScan = viewModel::scanForDevices,
        onToggleConnection = viewModel::toggleConnection,
        modifier = modifier,
    )
}

@Composable
private fun DevicesScreenContent(
    uiState: DevicesUiState,
    onScan: () -> Unit,
    onToggleConnection: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    TrackPerformance("DevicesScreen")
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
            // Title and Scan Button Row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = stringResource(R.string.devices),
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold,
                )

                Button(
                    onClick = onScan,
                    enabled = !uiState.isScanning,
                    colors = ButtonDefaults.buttonColors(containerColor = scanButtonColor),
                    shape = buttonShape,
                    modifier =
                        Modifier.semantics {
                            contentDescription = if (uiState.isScanning) "Scanning for devices" else "Scan for devices"
                        },
                ) {
                    if (uiState.isScanning) {
                        CircularProgressIndicator(
                            modifier = Modifier.padding(end = 8.dp),
                            color = Color.White,
                            strokeWidth = 2.dp,
                        )
                    } else {
                        Text("⋮⋮", modifier = Modifier.padding(end = 4.dp))
                    }
                    Text(stringResource(R.string.scan))
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Device Cards
            uiState.devices.forEach { device ->
                DeviceCard(
                    device = device,
                    onToggleConnection = { onToggleConnection(device.id) },
                )
                Spacer(modifier = Modifier.height(12.dp))
            }
        }
    }
}

@Preview(showBackground = true)
@Composable
private fun DevicesScreenPreview() {
    TheBalanceToolkitTheme {
        DevicesScreenContent(
            uiState =
                DevicesUiState(
                    devices =
                        listOf(
                            Device(name = "Nintendo RVL-WBC-01", macAddress = "37:F6:A1:2B:FD:F4", isConnected = true),
                            Device(name = "Nintendo RVL-WBC-01", macAddress = "12:E9:CD:B9:71:54", isConnected = true),
                            Device(name = "Nintendo RVL-WBC-01", lastSeen = "N/A", isConnected = false),
                        ),
                ),
            onScan = {},
            onToggleConnection = {},
        )
    }
}
