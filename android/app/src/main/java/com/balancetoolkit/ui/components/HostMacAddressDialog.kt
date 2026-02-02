package com.balancetoolkit.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.balancetoolkit.R
import com.balancetoolkit.ui.theme.CardBackground
import com.balancetoolkit.ui.theme.PrimaryBlue
import com.balancetoolkit.ui.theme.TextGray
import com.balancetoolkit.ui.theme.TheBalanceToolkitTheme

private val buttonShape = RoundedCornerShape(24.dp)
private val dialogShape = RoundedCornerShape(16.dp)
private val cancelButtonColor =
    androidx.compose.ui.graphics
        .Color(0xFF9E9E9E)

// Accepts formats: "AABBCCDDEEFF", "AA:BB:CC:DD:EE:FF", "AA-BB-CC-DD-EE-FF"
private fun extractHexDigits(input: String): String =
    input
        .filter { it.isDigit() || it in 'A'..'F' || it in 'a'..'f' }
        .uppercase()

private fun formatWithColons(hex: String): String = hex.chunked(2).joinToString(":")

@Composable
fun HostMacAddressDialog(
    initialMacAddress: String = "",
    onDismiss: () -> Unit,
    onSave: (String) -> Unit,
) {
    // Store exactly what user types - no transformation
    var text by remember { mutableStateOf(initialMacAddress) }
    var hasError by remember { mutableStateOf(false) }

    val focusManager = LocalFocusManager.current

    fun isValid(): Boolean = extractHexDigits(text).length == 12

    fun validateAndSave() {
        if (isValid()) {
            onSave(formatWithColons(extractHexDigits(text)))
        } else {
            hasError = true
        }
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        Surface(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(16.dp)
                    .semantics { contentDescription = "Host MAC address dialog" },
            shape = dialogShape,
            color = CardBackground,
        ) {
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(20.dp),
            ) {
                // Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = stringResource(R.string.host_mac_required),
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold,
                    )
                    IconButton(
                        onClick = onDismiss,
                        modifier = Modifier.semantics { contentDescription = "Close dialog" },
                    ) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = stringResource(R.string.close),
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                Text(
                    text = stringResource(R.string.host_mac_explanation),
                    style = MaterialTheme.typography.bodyMedium,
                    color = TextGray,
                )

                Spacer(modifier = Modifier.height(12.dp))

                Text(
                    text = stringResource(R.string.host_mac_instructions),
                    style = MaterialTheme.typography.bodyMedium,
                    color = TextGray,
                )

                Spacer(modifier = Modifier.height(4.dp))

                Text(
                    text = stringResource(R.string.host_mac_path),
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium,
                )

                Spacer(modifier = Modifier.height(20.dp))

                OutlinedTextField(
                    value = text,
                    onValueChange = {
                        text = it
                        hasError = false
                    },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text(stringResource(R.string.mac_address)) },
                    placeholder = { Text("AA:BB:CC:DD:EE:FF") },
                    isError = hasError,
                    supportingText =
                        if (hasError) {
                            { Text(stringResource(R.string.mac_address_invalid)) }
                        } else {
                            null
                        },
                    singleLine = true,
                    keyboardOptions =
                        KeyboardOptions(
                            capitalization = KeyboardCapitalization.Characters,
                            imeAction = ImeAction.Done,
                        ),
                    keyboardActions =
                        KeyboardActions(
                            onDone = {
                                focusManager.clearFocus()
                                validateAndSave()
                            },
                        ),
                )

                Spacer(modifier = Modifier.height(24.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    Button(
                        onClick = { validateAndSave() },
                        modifier = Modifier.weight(1f),
                        enabled = text.isNotEmpty(),
                        colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue),
                        shape = buttonShape,
                    ) {
                        Text(stringResource(R.string.save))
                    }

                    Button(
                        onClick = onDismiss,
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = cancelButtonColor),
                        shape = buttonShape,
                    ) {
                        Text(stringResource(R.string.cancel))
                    }
                }
            }
        }
    }
}

@Preview(showBackground = true)
@Composable
private fun HostMacAddressDialogPreview() {
    TheBalanceToolkitTheme {
        HostMacAddressDialog(
            onDismiss = {},
            onSave = {},
        )
    }
}
