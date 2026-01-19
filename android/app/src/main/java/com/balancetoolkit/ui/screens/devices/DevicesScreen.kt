package com.balancetoolkit.ui.screens.devices

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.balancetoolkit.R
import com.balancetoolkit.data.model.Device
import com.balancetoolkit.ui.components.AppHeader
import com.balancetoolkit.ui.components.DeviceCard
import com.balancetoolkit.ui.components.HostMacAddressDialog
import com.balancetoolkit.ui.theme.BackgroundGray
import com.balancetoolkit.ui.theme.ErrorRed
import com.balancetoolkit.ui.theme.PrimaryBlue
import com.balancetoolkit.ui.theme.TheBalanceToolkitTheme
import com.balancetoolkit.util.TrackPerformance
import com.balancetoolkit.viewmodel.DevicesUiState
import com.balancetoolkit.viewmodel.DevicesViewModel

private val scanButtonColor = Color(0xFF424242)
private val buttonShape = RoundedCornerShape(8.dp)

private val bluetoothPermissions = arrayOf(
    Manifest.permission.BLUETOOTH_SCAN,
    Manifest.permission.BLUETOOTH_CONNECT,
)

@Composable
fun DevicesScreen(
    viewModel: DevicesViewModel,
    onNavigateToHome: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

    // Check if permissions are currently granted
    fun hasBluetoothPermissions(): Boolean {
        return bluetoothPermissions.all { permission ->
            ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED
        }
    }

    // Track permission states
    var showSettingsDialog by remember { mutableStateOf(false) }
    var hasLaunchedInitialRequest by remember { mutableStateOf(false) }
    var waitingForSettingsReturn by remember { mutableStateOf(false) }

    // Permission launcher
    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val allGranted = permissions.values.all { it }
        if (!allGranted) {
            // Permissions denied - show settings dialog
            showSettingsDialog = true
        }
        // If granted, do nothing - screen will show normally
    }

    // Initial permission check on first composition
    LaunchedEffect(Unit) {
        if (!hasBluetoothPermissions()) {
            hasLaunchedInitialRequest = true
            permissionLauncher.launch(bluetoothPermissions)
        }
    }

    // Re-check permissions when returning from settings
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME && waitingForSettingsReturn) {
                waitingForSettingsReturn = false
                if (!hasBluetoothPermissions()) {
                    // Still no permissions after returning from settings
                    showSettingsDialog = true
                }
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
        }
    }

    // Settings dialog
    if (showSettingsDialog) {
        BluetoothPermissionSettingsDialog(
            onOpenSettings = {
                showSettingsDialog = false
                waitingForSettingsReturn = true
                val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                    data = Uri.fromParts("package", context.packageName, null)
                }
                context.startActivity(intent)
            },
            onDismiss = {
                showSettingsDialog = false
                onNavigateToHome()
            }
        )
    }

    // Handle scan click with permission check
    val onScanWithPermissionCheck = {
        if (uiState.isScanning) {
            // Already scanning, stop it
            viewModel.onScanClick()
        } else if (hasBluetoothPermissions()) {
            viewModel.onScanClick()
        } else {
            showSettingsDialog = true
        }
    }

    if (uiState.showMacAddressDialog) {
        HostMacAddressDialog(
            initialMacAddress = uiState.hostMacAddress ?: "",
            onDismiss = viewModel::dismissMacAddressDialog,
            onSave = viewModel::saveHostMacAddress,
        )
    }

    if (uiState.showDeleteConfirmDialog) {
        DeleteDeviceConfirmDialog(
            deviceName = uiState.deviceToDelete?.name ?: "",
            onConfirm = viewModel::confirmDeleteDevice,
            onDismiss = viewModel::dismissDeleteDialog,
        )
    }

    if (uiState.showEditNameDialog) {
        EditDeviceNameDialog(
            currentName = uiState.deviceToEdit?.name ?: "",
            onSave = viewModel::saveDeviceName,
            onDismiss = viewModel::dismissEditDialog,
        )
    }

    DevicesScreenContent(
        uiState = uiState,
        onScan = onScanWithPermissionCheck,
        onEditMacAddress = viewModel::showMacAddressDialog,
        onToggleConnection = viewModel::toggleConnection,
        onEditDevice = viewModel::requestEditDevice,
        onDeleteDevice = viewModel::requestDeleteDevice,
        modifier = modifier,
    )
}

@Composable
private fun DevicesScreenContent(
    uiState: DevicesUiState,
    onScan: () -> Unit,
    onEditMacAddress: () -> Unit,
    onToggleConnection: (String) -> Unit,
    onEditDevice: (Device) -> Unit,
    onDeleteDevice: (Device) -> Unit,
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

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Button(
                        onClick = onScan,
                        colors = ButtonDefaults.buttonColors(containerColor = scanButtonColor),
                        shape = buttonShape,
                        modifier =
                            Modifier.semantics {
                                contentDescription = if (uiState.isScanning) "Stop scanning" else "Scan for devices"
                            },
                    ) {
                        if (uiState.isScanning) {
                            CircularProgressIndicator(
                                modifier = Modifier.padding(end = 8.dp).size(16.dp),
                                color = Color.White,
                                strokeWidth = 2.dp,
                            )
                            Text(stringResource(R.string.stop))
                        } else {
                            Text("⋮⋮", modifier = Modifier.padding(end = 4.dp))
                            Text(stringResource(R.string.scan))
                        }
                    }
                }
            }

            // Host MAC Address display
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable(onClick = onEditMacAddress)
                    .padding(vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = stringResource(R.string.host_mac_address) + ": ",
                    style = MaterialTheme.typography.bodySmall,
                    color = Color.Gray,
                )
                Text(
                    text = uiState.hostMacAddress ?: stringResource(R.string.not_configured),
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = FontWeight.Medium,
                    color = if (uiState.hostMacAddress != null) Color.DarkGray else Color.Gray,
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            if (uiState.devices.isNotEmpty()) {
                uiState.devices.forEach { device ->
                    DeviceCard(
                        device = device,
                        onToggleConnection = { onToggleConnection(device.id) },
                        onEdit = { onEditDevice(device) },
                        onDelete = { onDeleteDevice(device) },
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                }
            } else if (!uiState.isLoading) {
                EmptyDevicesState(modifier = Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun EmptyDevicesState(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier.fillMaxWidth(),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(32.dp),
        ) {
            // Balance board illustration using text
            Text(
                text = "\u2696\uFE0F",
                fontSize = 64.sp,
                modifier = Modifier.padding(bottom = 16.dp),
            )

            Text(
                text = stringResource(R.string.no_devices_found),
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.SemiBold,
                color = Color.DarkGray,
                textAlign = TextAlign.Center,
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = stringResource(R.string.no_devices_hint),
                style = MaterialTheme.typography.bodyMedium,
                color = Color.Gray,
                textAlign = TextAlign.Center,
                modifier = Modifier.width(280.dp),
            )
        }
    }
}

@Composable
private fun BluetoothPermissionSettingsDialog(
    onOpenSettings: () -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = stringResource(R.string.bluetooth_permission_required_title),
                fontWeight = FontWeight.Bold,
            )
        },
        text = {
            Text(stringResource(R.string.bluetooth_permission_required_message))
        },
        confirmButton = {
            Button(
                onClick = onOpenSettings,
                colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue),
            ) {
                Text(stringResource(R.string.open_settings))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(R.string.cancel))
            }
        },
    )
}

@Composable
private fun EditDeviceNameDialog(
    currentName: String,
    onSave: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    var name by remember { mutableStateOf(currentName) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = stringResource(R.string.edit_device_name_title),
                fontWeight = FontWeight.Bold,
            )
        },
        text = {
            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                label = { Text(stringResource(R.string.name)) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
        },
        confirmButton = {
            Button(
                onClick = { onSave(name) },
                enabled = name.isNotBlank(),
                colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue),
            ) {
                Text(stringResource(R.string.save))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(R.string.cancel))
            }
        },
    )
}

@Composable
private fun DeleteDeviceConfirmDialog(
    deviceName: String,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = stringResource(R.string.delete_device_title),
                fontWeight = FontWeight.Bold,
            )
        },
        text = {
            Text(stringResource(R.string.delete_device_message, deviceName))
        },
        confirmButton = {
            Button(
                onClick = onConfirm,
                colors = ButtonDefaults.buttonColors(containerColor = ErrorRed),
            ) {
                Text(stringResource(R.string.delete))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(R.string.cancel))
            }
        },
    )
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
                    hostMacAddress = "AA:BB:CC:DD:EE:FF",
                ),
            onScan = {},
            onEditMacAddress = {},
            onToggleConnection = {},
            onEditDevice = {},
            onDeleteDevice = {},
        )
    }
}

@Preview(showBackground = true, name = "Empty State")
@Composable
private fun DevicesScreenEmptyPreview() {
    TheBalanceToolkitTheme {
        DevicesScreenContent(
            uiState = DevicesUiState(devices = emptyList()),
            onScan = {},
            onEditMacAddress = {},
            onToggleConnection = {},
            onEditDevice = {},
            onDeleteDevice = {},
        )
    }
}
