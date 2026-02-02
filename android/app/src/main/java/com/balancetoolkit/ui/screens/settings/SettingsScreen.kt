package com.balancetoolkit.ui.screens.settings

import android.content.Intent
import android.net.Uri
import android.os.Environment
import android.provider.DocumentsContract
import android.provider.Settings
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ExitToApp
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import com.balancetoolkit.R
import com.balancetoolkit.data.HeightUnit
import com.balancetoolkit.data.WeightUnit
import com.balancetoolkit.ui.components.AppHeader
import com.balancetoolkit.ui.components.CiteBottomSheet
import com.balancetoolkit.ui.components.HostMacAddressDialog
import com.balancetoolkit.ui.components.SessionsDirectoryDialog
import com.balancetoolkit.ui.theme.BackgroundGray
import com.balancetoolkit.ui.theme.CardBackground
import com.balancetoolkit.ui.theme.TextGray
import com.balancetoolkit.ui.theme.TheBalanceToolkitTheme
import com.balancetoolkit.viewmodel.SettingsUiState
import com.balancetoolkit.viewmodel.SettingsViewModel
import java.io.File

private val cardShape = RoundedCornerShape(12.dp)

@Composable
fun SettingsScreen(
    viewModel: SettingsViewModel,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val uiState by viewModel.uiState.collectAsState()
    val lifecycleOwner = LocalLifecycleOwner.current

    // Refresh storage permission when returning from settings
    LaunchedEffect(lifecycleOwner) {
        lifecycleOwner.lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
            viewModel.refreshStoragePermission()
        }
    }

    // Directory picker launcher
    val directoryPickerLauncher =
        rememberLauncherForActivityResult(
            contract = ActivityResultContracts.OpenDocumentTree(),
        ) { uri: Uri? ->
            uri?.let {
                // Convert content URI to a path we can use
                // Take persistable permission for the URI
                context.contentResolver.takePersistableUriPermission(
                    it,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION,
                )
                // Save the URI string - we'll need to handle this specially when writing files
                viewModel.saveSessionsDirectory(it.toString())
            }
        }

    if (uiState.showMacAddressDialog) {
        HostMacAddressDialog(
            initialMacAddress = uiState.hostMacAddress ?: "",
            onDismiss = viewModel::dismissMacAddressDialog,
            onSave = viewModel::saveHostMacAddress,
        )
    }

    if (uiState.showSessionsDirectoryDialog) {
        SessionsDirectoryDialog(
            currentDirectory = uiState.sessionsDirectory,
            onDismiss = viewModel::dismissSessionsDirectoryDialog,
            onPickDirectory = {
                directoryPickerLauncher.launch(null)
            },
            onOpenInFileExplorer = {
                val directory = uiState.sessionsDirectory
                try {
                    if (directory.startsWith("content://")) {
                        // It's a content URI from SAF - build a document URI and open it
                        val treeUri = Uri.parse(directory)
                        val docId = DocumentsContract.getTreeDocumentId(treeUri)
                        val docUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, docId)

                        val intent =
                            Intent(Intent.ACTION_VIEW).apply {
                                data = docUri
                                flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or
                                    Intent.FLAG_ACTIVITY_NEW_TASK
                            }
                        context.startActivity(intent)
                    } else {
                        // It's a file path - ensure directory exists and open in file manager
                        val file = File(directory)
                        if (!file.exists()) {
                            file.mkdirs()
                        }
                        // Build a document URI for the external storage documents provider
                        val relativePath =
                            when {
                                directory.startsWith("/storage/emulated/0/") -> {
                                    directory.removePrefix("/storage/emulated/0/")
                                }

                                directory.startsWith(context.getExternalFilesDir(null)?.absolutePath ?: "") -> {
                                    "Android/data/${context.packageName}/files" +
                                        directory.removePrefix(context.getExternalFilesDir(null)?.absolutePath ?: "")
                                }

                                else -> {
                                    null
                                }
                            }
                        if (relativePath != null) {
                            val encodedPath = relativePath.replace("/", "%2F")
                            val uri = Uri.parse("content://com.android.externalstorage.documents/document/primary:$encodedPath")
                            val intent =
                                Intent(Intent.ACTION_VIEW).apply {
                                    data = uri
                                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                                }
                            context.startActivity(intent)
                        } else {
                            // Fallback: show toast with the path
                            Toast
                                .makeText(
                                    context,
                                    context.getString(R.string.sessions_directory_path, directory),
                                    Toast.LENGTH_LONG,
                                ).show()
                        }
                    }
                } catch (e: Exception) {
                    Toast
                        .makeText(
                            context,
                            context.getString(R.string.no_file_manager),
                            Toast.LENGTH_SHORT,
                        ).show()
                }
            },
            onResetToDefault = viewModel::resetSessionsDirectoryToDefault,
        )
    }

    if (uiState.showCiteBottomSheet) {
        CiteBottomSheet(onDismiss = viewModel::dismissCiteBottomSheet)
    }

    SettingsScreenContent(
        uiState = uiState,
        onEditMacAddress = viewModel::showMacAddressDialog,
        onMockModeChanged = viewModel::setMockModeEnabled,
        onEditSessionsDirectory = viewModel::showSessionsDirectoryDialog,
        onRequestStoragePermission = {
            val intent =
                Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION).apply {
                    data = Uri.parse("package:${context.packageName}")
                }
            context.startActivity(intent)
        },
        onHeightUnitChanged = viewModel::setHeightUnit,
        onWeightUnitChanged = viewModel::setWeightUnit,
        onCiteClick = viewModel::showCiteBottomSheet,
        onSourceCodeClick = {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://www.google.com"))
            context.startActivity(intent)
        },
        modifier = modifier,
    )
}

@Composable
private fun SettingsScreenContent(
    uiState: SettingsUiState,
    onEditMacAddress: () -> Unit,
    onMockModeChanged: (Boolean) -> Unit,
    onEditSessionsDirectory: () -> Unit,
    onRequestStoragePermission: () -> Unit,
    onHeightUnitChanged: (HeightUnit) -> Unit,
    onWeightUnitChanged: (WeightUnit) -> Unit,
    onCiteClick: () -> Unit,
    onSourceCodeClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
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
                    .fillMaxSize()
                    .verticalScroll(scrollState)
                    .padding(16.dp),
        ) {
            Text(
                text = stringResource(R.string.settings),
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
            )

            Spacer(modifier = Modifier.height(24.dp))

            // Host MAC Address Setting
            SettingsItem(
                title = stringResource(R.string.host_mac_address),
                value = uiState.hostMacAddress ?: stringResource(R.string.not_configured),
                onClick = onEditMacAddress,
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Sessions Directory Setting
            SettingsItem(
                title = stringResource(R.string.sessions_directory),
                value = uiState.sessionsDirectory.ifEmpty { stringResource(R.string.not_configured) },
                onClick = onEditSessionsDirectory,
            )

            // Storage Permission Warning
            if (uiState.needsStoragePermission) {
                Spacer(modifier = Modifier.height(8.dp))
                SettingsWarningItem(
                    title = stringResource(R.string.storage_permission_required),
                    description = stringResource(R.string.storage_permission_description),
                    onClick = onRequestStoragePermission,
                )
            }

            Spacer(modifier = Modifier.height(32.dp))

            // Units Section
            Text(
                text = stringResource(R.string.units),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = TextGray,
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Height Unit Setting
            SettingsSegmentedItem(
                title = stringResource(R.string.height_unit),
                options = HeightUnit.entries.map { it.label },
                selectedIndex = HeightUnit.entries.indexOf(uiState.heightUnit),
                onSelectionChanged = { index -> onHeightUnitChanged(HeightUnit.entries[index]) },
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Weight Unit Setting
            SettingsSegmentedItem(
                title = stringResource(R.string.weight_unit),
                options = WeightUnit.entries.map { it.label },
                selectedIndex = WeightUnit.entries.indexOf(uiState.weightUnit),
                onSelectionChanged = { index -> onWeightUnitChanged(WeightUnit.entries[index]) },
            )

            Spacer(modifier = Modifier.height(32.dp))

            // Developer Section
            Text(
                text = stringResource(R.string.developer),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = TextGray,
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Mock Mode Setting
            SettingsToggleItem(
                title = stringResource(R.string.mock_mode),
                description = stringResource(R.string.mock_mode_description),
                checked = uiState.mockModeEnabled,
                onCheckedChange = onMockModeChanged,
            )

            Spacer(modifier = Modifier.height(32.dp))

            // About Section
            Text(
                text = stringResource(R.string.about),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = TextGray,
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Cite Item
            SettingsActionItem(
                title = stringResource(R.string.cite),
                description = stringResource(R.string.cite_description),
                icon = Icons.Filled.Info,
                onClick = onCiteClick,
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Source Code Item
            SettingsActionItem(
                title = stringResource(R.string.source_code),
                description = stringResource(R.string.source_code_description),
                icon = Icons.AutoMirrored.Filled.ExitToApp,
                onClick = onSourceCodeClick,
            )
        }
    }
}

@Composable
private fun SettingsItem(
    title: String,
    value: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Card(
        modifier =
            modifier
                .fillMaxWidth()
                .clickable(onClick = onClick),
        shape = cardShape,
        colors = CardDefaults.cardColors(containerColor = CardBackground),
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Medium,
                )
                Text(
                    text = value,
                    style = MaterialTheme.typography.bodyMedium,
                    color = TextGray,
                )
            }
            Icon(
                imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
                contentDescription = null,
                tint = TextGray,
            )
        }
    }
}

@Composable
private fun SettingsToggleItem(
    title: String,
    description: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = cardShape,
        colors = CardDefaults.cardColors(containerColor = CardBackground),
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Medium,
                )
                Text(
                    text = description,
                    style = MaterialTheme.typography.bodyMedium,
                    color = TextGray,
                )
            }
            Switch(
                checked = checked,
                onCheckedChange = onCheckedChange,
            )
        }
    }
}

@Composable
private fun SettingsActionItem(
    title: String,
    description: String,
    icon: ImageVector,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Card(
        modifier =
            modifier
                .fillMaxWidth()
                .clickable(onClick = onClick),
        shape = cardShape,
        colors = CardDefaults.cardColors(containerColor = CardBackground),
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Medium,
                )
                Text(
                    text = description,
                    style = MaterialTheme.typography.bodyMedium,
                    color = TextGray,
                )
            }
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = TextGray,
            )
        }
    }
}

@Composable
private fun SettingsWarningItem(
    title: String,
    description: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Card(
        modifier =
            modifier
                .fillMaxWidth()
                .clickable(onClick = onClick),
        shape = cardShape,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer),
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = Icons.Filled.Warning,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.error,
            )
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Medium,
                    color = MaterialTheme.colorScheme.onErrorContainer,
                )
                Text(
                    text = description,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onErrorContainer.copy(alpha = 0.8f),
                )
            }
            Icon(
                imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onErrorContainer,
            )
        }
    }
}

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
private fun SettingsSegmentedItem(
    title: String,
    options: List<String>,
    selectedIndex: Int,
    onSelectionChanged: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = cardShape,
        colors = CardDefaults.cardColors(containerColor = CardBackground),
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Medium,
            )
            Spacer(modifier = Modifier.height(12.dp))
            SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
                options.forEachIndexed { index, label ->
                    SegmentedButton(
                        shape = SegmentedButtonDefaults.itemShape(index = index, count = options.size),
                        onClick = { onSelectionChanged(index) },
                        selected = index == selectedIndex,
                    ) {
                        Text(label)
                    }
                }
            }
        }
    }
}

@Preview(showBackground = true)
@Composable
private fun SettingsScreenPreview() {
    TheBalanceToolkitTheme {
        SettingsScreenContent(
            uiState =
                SettingsUiState(
                    hostMacAddress = "AA:BB:CC:DD:EE:FF",
                    sessionsDirectory = "/storage/emulated/0/Documents/the-balance-toolkit/sessions",
                    hasStoragePermission = true,
                ),
            onEditMacAddress = {},
            onMockModeChanged = {},
            onEditSessionsDirectory = {},
            onRequestStoragePermission = {},
            onHeightUnitChanged = {},
            onWeightUnitChanged = {},
            onCiteClick = {},
            onSourceCodeClick = {},
        )
    }
}

@Preview(showBackground = true)
@Composable
private fun SettingsScreenNoMacPreview() {
    TheBalanceToolkitTheme {
        SettingsScreenContent(
            uiState =
                SettingsUiState(
                    hostMacAddress = null,
                ),
            onEditMacAddress = {},
            onMockModeChanged = {},
            onEditSessionsDirectory = {},
            onRequestStoragePermission = {},
            onHeightUnitChanged = {},
            onWeightUnitChanged = {},
            onCiteClick = {},
            onSourceCodeClick = {},
        )
    }
}
