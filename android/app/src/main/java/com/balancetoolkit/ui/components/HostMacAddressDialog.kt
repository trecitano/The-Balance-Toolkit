package com.balancetoolkit.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
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

private val fieldShape = RoundedCornerShape(8.dp)
private val buttonShape = RoundedCornerShape(24.dp)
private val dialogShape = RoundedCornerShape(16.dp)
private val cancelButtonColor = Color(0xFF9E9E9E)

private val macAddressRegex = Regex("^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$")

@Composable
fun HostMacAddressDialog(
    initialMacAddress: String = "",
    onDismiss: () -> Unit,
    onSave: (String) -> Unit,
) {
    var macAddress by remember { mutableStateOf(initialMacAddress) }
    var hasError by remember { mutableStateOf(false) }

    fun isValidMacAddress(mac: String): Boolean {
        return macAddressRegex.matches(mac)
    }

    fun validateAndSave() {
        if (isValidMacAddress(macAddress)) {
            onSave(macAddress.uppercase())
        } else {
            hasError = true
        }
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
                .semantics { contentDescription = "Host MAC address dialog" },
            shape = dialogShape,
            color = CardBackground,
        ) {
            Column(
                modifier = Modifier
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
                        modifier = Modifier.semantics {
                            contentDescription = "Close dialog"
                        },
                    ) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = stringResource(R.string.close),
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Explanation
                Text(
                    text = stringResource(R.string.host_mac_explanation),
                    style = MaterialTheme.typography.bodyMedium,
                    color = TextGray,
                )

                Spacer(modifier = Modifier.height(12.dp))

                // Instructions
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

                // MAC Address Field
                Text(
                    text = stringResource(R.string.mac_address),
                    style = MaterialTheme.typography.bodyMedium,
                    color = TextGray,
                )
                Spacer(modifier = Modifier.height(4.dp))
                OutlinedTextField(
                    value = macAddress,
                    onValueChange = {
                        macAddress = it
                        hasError = false
                    },
                    modifier = Modifier.fillMaxWidth(),
                    placeholder = { Text(stringResource(R.string.mac_address_placeholder)) },
                    shape = fieldShape,
                    isError = hasError,
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(
                        capitalization = KeyboardCapitalization.Characters,
                    ),
                    supportingText = if (hasError) {
                        { Text(stringResource(R.string.mac_address_invalid), color = MaterialTheme.colorScheme.error) }
                    } else {
                        null
                    },
                )

                Spacer(modifier = Modifier.height(24.dp))

                // Save and Cancel Buttons
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    Button(
                        onClick = { validateAndSave() },
                        modifier = Modifier.weight(1f),
                        enabled = macAddress.isNotBlank(),
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
