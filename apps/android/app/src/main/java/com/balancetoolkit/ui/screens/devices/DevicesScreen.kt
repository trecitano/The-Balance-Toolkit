package com.balancetoolkit.ui.screens.devices

import android.Manifest
import android.app.Activity
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
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
import com.balancetoolkit.viewmodel.PairingStage
import com.balancetoolkit.viewmodel.PairingUiState

private val scanButtonColor = Color(0xFF424242)
private val buttonShape = RoundedCornerShape(8.dp)
private val pairingSuccessColor = Color(0xFF2E7D32)

private val bluetoothPermissions =
    arrayOf(
        Manifest.permission.BLUETOOTH_SCAN,
        Manifest.permission.BLUETOOTH_CONNECT,
    )

@Composable
fun DevicesScreen(
    viewModel: DevicesViewModel,
    onNavigateToHome: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val bluetoothAdapter =
        remember {
            (context.getSystemService(android.content.Context.BLUETOOTH_SERVICE) as? BluetoothManager)?.adapter
        }

    // Check if permissions are currently granted
    fun hasBluetoothPermissions(): Boolean =
        bluetoothPermissions.all { permission ->
            ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED
        }

    // Track permission states
    var showSettingsDialog by remember { mutableStateOf(false) }
    var waitingForSettingsReturn by remember { mutableStateOf(false) }

    // Bluetooth enable launcher - prompts user to turn on Bluetooth
    val bluetoothEnableLauncher =
        rememberLauncherForActivityResult(
            contract = ActivityResultContracts.StartActivityForResult(),
        ) { result ->
            if (result.resultCode == Activity.RESULT_OK) {
                viewModel.onScanClick()
            }
        }

    // Permission launcher
    val permissionLauncher =
        rememberLauncherForActivityResult(
            contract = ActivityResultContracts.RequestMultiplePermissions(),
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
            permissionLauncher.launch(bluetoothPermissions)
        }
    }

    // Re-check permissions when returning from settings
    DisposableEffect(lifecycleOwner) {
        val observer =
            LifecycleEventObserver { _, event ->
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
                val intent =
                    Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                        data = Uri.fromParts("package", context.packageName, null)
                    }
                context.startActivity(intent)
            },
            onDismiss = {
                showSettingsDialog = false
                onNavigateToHome()
            },
        )
    }

    // Handle scan click with permission and Bluetooth state checks
    val onScanWithPermissionCheck = {
        if (uiState.isScanning) {
            // Already scanning, stop it
            viewModel.onScanClick()
        } else if (!hasBluetoothPermissions()) {
            showSettingsDialog = true
        } else if (bluetoothAdapter?.isEnabled == false) {
            bluetoothEnableLauncher.launch(Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE))
        } else {
            viewModel.onScanClick()
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

    if (uiState.pairingUiState.isVisible) {
        PairingStatusBottomSheet(
            pairingUiState = uiState.pairingUiState,
            onCancel = viewModel::cancelPairingFlow,
            onRetry = onScanWithPermissionCheck,
            onDone = viewModel::dismissPairingSheet,
            onDismissRequest = viewModel::onPairingSheetDismissRequested,
        )
    }

    // Handle selection toggle
    val onToggleSelection: (String) -> Unit = { deviceId ->
        val device = uiState.devices.find { it.id == deviceId }
        if (device != null) {
            if (device.isSelected) {
                viewModel.deselectDevice(deviceId)
            } else {
                viewModel.selectDevice(deviceId)
            }
        }
    }

    DevicesScreenContent(
        uiState = uiState,
        onScan = onScanWithPermissionCheck,
        onEditMacAddress = viewModel::showMacAddressDialog,
        onToggleSelection = onToggleSelection,
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
    onToggleSelection: (String) -> Unit,
    onEditDevice: (Device) -> Unit,
    onDeleteDevice: (Device) -> Unit,
    modifier: Modifier = Modifier,
) {
    TrackPerformance("DevicesScreen")
    val scrollState = rememberScrollState()
    val shouldScrollContent = uiState.isLoading || uiState.devices.isNotEmpty()

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
                    .then(if (shouldScrollContent) Modifier.verticalScroll(scrollState) else Modifier)
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
                            Text(stringResource(R.string.scanning))
                        } else {
                            Text("⋮⋮", modifier = Modifier.padding(end = 4.dp))
                            Text(stringResource(R.string.scan))
                        }
                    }
                }
            }

            // Host MAC Address display
            Row(
                modifier =
                    Modifier
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

            if (uiState.isLoading) {
                Box(
                    modifier = Modifier.fillMaxWidth().weight(1f),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator()
                }
            } else if (uiState.devices.isNotEmpty()) {
                uiState.devices.forEach { device ->
                    DeviceCard(
                        device = device,
                        onToggleSelection = { onToggleSelection(device.id) },
                        onEdit = { onEditDevice(device) },
                        onDelete = { onDeleteDevice(device) },
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                }
            } else {
                EmptyDevicesState(modifier = Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun EmptyDevicesState(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(32.dp),
        ) {
            Image(
                painter = painterResource(id = R.drawable.wbb_top_bold),
                contentDescription = null,
                modifier =
                    Modifier
                        .width(120.dp)
                        .height(80.dp)
                        .padding(bottom = 16.dp),
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PairingStatusBottomSheet(
    pairingUiState: PairingUiState,
    onCancel: () -> Unit,
    onRetry: () -> Unit,
    onDone: () -> Unit,
    onDismissRequest: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val deviceName = pairingUiState.deviceName ?: stringResource(R.string.pairing_device_name_fallback)

    val title =
        when (pairingUiState.stage) {
            PairingStage.Idle -> stringResource(R.string.pairing_status_searching_title)
            PairingStage.Searching -> stringResource(R.string.pairing_status_searching_title)
            PairingStage.DeviceFound -> stringResource(R.string.pairing_status_device_found_title)
            PairingStage.Pairing -> stringResource(R.string.pairing_status_pairing_title)
            PairingStage.Synchronizing -> stringResource(R.string.pairing_status_syncing_title)
            PairingStage.Connected -> stringResource(R.string.pairing_status_connected_title)
            PairingStage.Failed -> stringResource(R.string.pairing_status_failed_title)
        }

    val message =
        when (pairingUiState.stage) {
            PairingStage.Idle,
            PairingStage.Searching,
            -> {
                stringResource(R.string.pairing_status_searching_message)
            }

            PairingStage.DeviceFound -> {
                stringResource(R.string.pairing_status_device_found_message, deviceName)
            }

            PairingStage.Pairing -> {
                stringResource(R.string.pairing_status_pairing_message, deviceName)
            }

            PairingStage.Synchronizing -> {
                stringResource(R.string.pairing_status_syncing_message, deviceName)
            }

            PairingStage.Connected -> {
                stringResource(R.string.pairing_status_connected_message, deviceName)
            }

            PairingStage.Failed -> {
                pairingUiState.message
                    ?: stringResource(
                        R.string.pairing_status_failed_message,
                    )
            }
        }

    ModalBottomSheet(
        onDismissRequest = onDismissRequest,
        sheetState = sheetState,
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp)
                    .padding(bottom = 32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
            )

            Spacer(modifier = Modifier.height(20.dp))

            when (pairingUiState.stage) {
                PairingStage.Connected -> {
                    Icon(
                        painter = painterResource(id = R.drawable.wbb_top_bold),
                        contentDescription = null,
                        tint = pairingSuccessColor,
                        modifier = Modifier.size(52.dp),
                    )
                }

                PairingStage.Failed -> {
                    Icon(
                        imageVector = Icons.Filled.Warning,
                        contentDescription = null,
                        tint = ErrorRed,
                        modifier = Modifier.size(48.dp),
                    )
                }

                else -> {
                    CircularProgressIndicator(
                        color = PrimaryBlue,
                        strokeWidth = 3.dp,
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = message,
                style = MaterialTheme.typography.bodyLarge,
                textAlign = TextAlign.Center,
                color = Color.DarkGray,
            )

            Spacer(modifier = Modifier.height(28.dp))

            when {
                pairingUiState.isInProgress -> {
                    Button(
                        onClick = onCancel,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(8.dp),
                    ) {
                        Text(text = stringResource(R.string.cancel))
                    }
                }

                pairingUiState.stage == PairingStage.Failed -> {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        OutlinedButton(
                            onClick = onDone,
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(8.dp),
                        ) {
                            Text(text = stringResource(R.string.done))
                        }

                        Button(
                            onClick = onRetry,
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(8.dp),
                        ) {
                            Text(text = stringResource(R.string.retry))
                        }
                    }
                }

                else -> {
                    Button(
                        onClick = onDone,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(8.dp),
                    ) {
                        Text(text = stringResource(R.string.done))
                    }
                }
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
                            Device(name = "Nintendo RVL-WBC-01", macAddress = "37:F6:A1:2B:FD:F4", isConnected = true, isSelected = true),
                            Device(name = "Nintendo RVL-WBC-01", macAddress = "12:E9:CD:B9:71:54", isConnected = true),
                            Device(name = "Nintendo RVL-WBC-01", lastSeen = "N/A", isConnected = false),
                        ),
                    hostMacAddress = "AA:BB:CC:DD:EE:FF",
                ),
            onScan = {},
            onEditMacAddress = {},
            onToggleSelection = {},
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
            onToggleSelection = {},
            onEditDevice = {},
            onDeleteDevice = {},
        )
    }
}
