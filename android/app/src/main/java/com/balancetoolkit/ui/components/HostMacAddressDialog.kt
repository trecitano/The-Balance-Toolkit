package com.balancetoolkit.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.balancetoolkit.R
import com.balancetoolkit.ui.theme.CardBackground
import com.balancetoolkit.ui.theme.PrimaryBlue
import com.balancetoolkit.ui.theme.TextGray
import com.balancetoolkit.ui.theme.TheBalanceToolkitTheme

private val segmentShape = RoundedCornerShape(8.dp)
private val buttonShape = RoundedCornerShape(24.dp)
private val dialogShape = RoundedCornerShape(16.dp)
private val cancelButtonColor = Color(0xFF9E9E9E)

private const val MAC_SEGMENTS = 6

private fun parseMacAddress(mac: String): List<String> {
    val hexOnly = mac.filter { it.isDigit() || it in 'A'..'F' || it in 'a'..'f' }.uppercase()
    val segments = hexOnly.chunked(2).take(MAC_SEGMENTS)
    return List(MAC_SEGMENTS) { index -> segments.getOrElse(index) { "" } }
}

private fun combineMacAddress(segments: List<String>): String {
    return segments.joinToString(":")
}

private fun isValidMacAddress(segments: List<String>): Boolean {
    return segments.all { it.length == 2 }
}

private fun filterHexInput(input: String): String {
    return input.filter { it.isDigit() || it in 'A'..'F' || it in 'a'..'f' }
        .take(2)
        .uppercase()
}

@Composable
fun HostMacAddressDialog(
    initialMacAddress: String = "",
    onDismiss: () -> Unit,
    onSave: (String) -> Unit,
) {
    val segments = remember {
        mutableStateListOf(*parseMacAddress(initialMacAddress).toTypedArray())
    }
    var hasError by remember { mutableStateOf(false) }

    val focusRequesters = remember { List(MAC_SEGMENTS) { FocusRequester() } }
    val focusManager = LocalFocusManager.current

    fun validateAndSave() {
        if (isValidMacAddress(segments)) {
            onSave(combineMacAddress(segments).uppercase())
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

                // MAC Address Label
                Text(
                    text = stringResource(R.string.mac_address),
                    style = MaterialTheme.typography.bodyMedium,
                    color = TextGray,
                )
                Spacer(modifier = Modifier.height(4.dp))

                // Segmented MAC Address Input
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    segments.forEachIndexed { index, segment ->
                        if (index > 0) {
                            Text(
                                text = ":",
                                style = MaterialTheme.typography.titleLarge,
                                fontWeight = FontWeight.Bold,
                            )
                        }
                        val isFieldError = hasError && segment.length != 2
                        val borderColor = when {
                            isFieldError -> MaterialTheme.colorScheme.error
                            else -> MaterialTheme.colorScheme.outline
                        }
                        BasicTextField(
                            value = segment,
                            onValueChange = { newValue ->
                                val filtered = filterHexInput(newValue)
                                segments[index] = filtered
                                hasError = false

                                // Auto-advance to next field when 2 characters entered
                                if (filtered.length == 2 && index < MAC_SEGMENTS - 1) {
                                    focusRequesters[index + 1].requestFocus()
                                }
                            },
                            modifier = Modifier
                                .weight(1f)
                                .focusRequester(focusRequesters[index])
                                .onKeyEvent { keyEvent ->
                                    // Go back to previous field on backspace when empty and delete last char
                                    if (keyEvent.key == Key.Backspace && segment.isEmpty() && index > 0) {
                                        val prevSegment = segments[index - 1]
                                        if (prevSegment.isNotEmpty()) {
                                            segments[index - 1] = prevSegment.dropLast(1)
                                        }
                                        focusRequesters[index - 1].requestFocus()
                                        true
                                    } else {
                                        false
                                    }
                                }
                                .border(1.dp, borderColor, segmentShape)
                                .padding(horizontal = 4.dp, vertical = 10.dp),
                            textStyle = MaterialTheme.typography.bodyMedium.copy(
                                textAlign = TextAlign.Center,
                                color = MaterialTheme.colorScheme.onSurface,
                            ),
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(
                                capitalization = KeyboardCapitalization.Characters,
                                imeAction = if (index < MAC_SEGMENTS - 1) ImeAction.Next else ImeAction.Done,
                            ),
                            keyboardActions = KeyboardActions(
                                onNext = {
                                    if (index < MAC_SEGMENTS - 1) {
                                        focusRequesters[index + 1].requestFocus()
                                    }
                                },
                                onDone = {
                                    focusManager.clearFocus()
                                    validateAndSave()
                                },
                            ),
                            decorationBox = { innerTextField ->
                                Box(
                                    contentAlignment = Alignment.Center,
                                ) {
                                    innerTextField()
                                }
                            },
                        )
                    }
                }

                if (hasError) {
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = stringResource(R.string.mac_address_invalid),
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodySmall,
                    )
                }

                Spacer(modifier = Modifier.height(24.dp))

                // Save and Cancel Buttons
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    Button(
                        onClick = { validateAndSave() },
                        modifier = Modifier.weight(1f),
                        enabled = segments.any { it.isNotBlank() },
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
