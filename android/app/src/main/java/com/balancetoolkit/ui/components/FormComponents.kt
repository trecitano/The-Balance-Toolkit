package com.balancetoolkit.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.balancetoolkit.R
import com.balancetoolkit.ui.theme.PrimaryBlue
import com.balancetoolkit.ui.theme.TextGray
import com.balancetoolkit.ui.theme.UserColors

private val fieldShape = RoundedCornerShape(8.dp)
private val borderColor = Color(0xFFBDBDBD)

/**
 * Generic dropdown for any enum type.
 *
 * @param T The enum type
 * @param selected The currently selected enum value
 * @param onSelect Callback when a new value is selected
 * @param entries All possible enum values
 * @param label The label text to display above the dropdown
 * @param displayText Function to convert enum value to display string (defaults to toString)
 * @param modifier Modifier for the component
 */
@Composable
fun <T> EnumDropdown(
    selected: T,
    onSelect: (T) -> Unit,
    entries: List<T>,
    label: String,
    modifier: Modifier = Modifier,
    displayText: (T) -> String = { it.toString() },
) {
    var expanded by remember { mutableStateOf(false) }

    Column(modifier = modifier) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            color = TextGray,
        )
        Spacer(modifier = Modifier.height(4.dp))
        Box {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, borderColor, fieldShape)
                    .clickable { expanded = true }
                    .padding(horizontal = 16.dp, vertical = 14.dp),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = displayText(selected),
                        style = MaterialTheme.typography.bodyLarge,
                    )
                    Icon(
                        imageVector = Icons.Default.ArrowDropDown,
                        contentDescription = null,
                        tint = TextGray,
                    )
                }
            }
            DropdownMenu(
                expanded = expanded,
                onDismissRequest = { expanded = false },
            ) {
                entries.forEach { entry ->
                    DropdownMenuItem(
                        text = { Text(displayText(entry)) },
                        onClick = {
                            onSelect(entry)
                            expanded = false
                        },
                    )
                }
            }
        }
    }
}

/**
 * Labeled text input field.
 */
@Composable
fun LabeledTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    placeholder: String = "",
    keyboardType: KeyboardType = KeyboardType.Text,
    readOnly: Boolean = false,
    isError: Boolean = false,
    errorMessage: String? = null,
    leadingIcon: @Composable (() -> Unit)? = null,
    trailingIcon: @Composable (() -> Unit)? = null,
) {
    Column(modifier = modifier) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            color = TextGray,
        )
        Spacer(modifier = Modifier.height(4.dp))
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier.fillMaxWidth(),
            placeholder = if (placeholder.isNotEmpty()) {
                { Text(placeholder) }
            } else {
                null
            },
            shape = fieldShape,
            readOnly = readOnly,
            isError = isError,
            keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
            leadingIcon = leadingIcon,
            trailingIcon = trailingIcon,
            supportingText = if (isError && errorMessage != null) {
                { Text(errorMessage, color = MaterialTheme.colorScheme.error) }
            } else {
                null
            },
        )
    }
}

/**
 * Weight input field with a button to measure weight from the balance board.
 */
@Composable
fun WeightFieldWithButton(
    value: String,
    onValueChange: (String) -> Unit,
    onWeightButtonClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier) {
        Text(
            text = stringResource(R.string.weight_kg),
            style = MaterialTheme.typography.bodyMedium,
            color = TextGray,
        )
        Spacer(modifier = Modifier.height(4.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            OutlinedTextField(
                value = value,
                onValueChange = onValueChange,
                modifier = Modifier.weight(1f),
                shape = fieldShape,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                singleLine = true,
            )
            Button(
                onClick = onWeightButtonClick,
                colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue),
                shape = fieldShape,
            ) {
                Text(text = stringResource(R.string.weight))
            }
        }
    }
}

/**
 * Internal color picker implementation with generic selection logic.
 */
@Composable
private fun ColorPickerRowInternal(
    isSelected: (UserColors.ColorOption) -> Boolean,
    onSelect: (UserColors.ColorOption) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .border(1.dp, borderColor, fieldShape)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        UserColors.options.forEach { option ->
            val selected = isSelected(option)
            Box(
                modifier = Modifier
                    .size(32.dp)
                    .background(option.color, CircleShape)
                    .clickable { onSelect(option) }
                    .then(
                        if (selected) {
                            Modifier.border(2.dp, Color.White, CircleShape)
                        } else {
                            Modifier
                        }
                    ),
                contentAlignment = Alignment.Center,
            ) {
                if (selected) {
                    Icon(
                        imageVector = Icons.Default.Check,
                        contentDescription = "Selected",
                        tint = Color.White,
                        modifier = Modifier.size(16.dp),
                    )
                }
            }
        }
    }
}

/**
 * Color picker row using the standard user color palette.
 * Accepts hex string for selection.
 */
@Composable
fun ColorPickerRow(
    selectedColor: String,
    onColorChange: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    ColorPickerRowInternal(
        isSelected = { it.hex.equals(selectedColor, ignoreCase = true) },
        onSelect = { onColorChange(it.hex) },
        modifier = modifier,
    )
}

/**
 * Read-only display field, matching editable field style.
 */
@Composable
fun ReadOnlyFieldWithBorder(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    suffix: String? = null,
) {
    Column(modifier = modifier) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            color = TextGray,
        )
        Spacer(modifier = Modifier.height(4.dp))
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 14.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = if (suffix != null) "$value $suffix" else value,
                style = MaterialTheme.typography.bodyLarge,
            )
        }
    }
}

/**
 * Color picker using Compose Color objects.
 */
@Composable
fun ColorPickerRowColor(
    selectedColor: Color,
    onColorChange: (Color) -> Unit,
    modifier: Modifier = Modifier,
) {
    ColorPickerRowInternal(
        isSelected = { it.color == selectedColor },
        onSelect = { onColorChange(it.color) },
        modifier = modifier,
    )
}
