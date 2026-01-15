package com.balancetoolkit.ui.screens.users

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
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.balancetoolkit.R
import com.balancetoolkit.data.model.DominantHand
import com.balancetoolkit.data.model.Gender
import com.balancetoolkit.data.model.User
import com.balancetoolkit.ui.theme.CardBackground
import com.balancetoolkit.ui.theme.ErrorRed
import com.balancetoolkit.ui.theme.PrimaryBlue
import com.balancetoolkit.ui.theme.TextGray

private val cardShape = RoundedCornerShape(12.dp)
private val fieldShape = RoundedCornerShape(8.dp)
private val buttonShape = RoundedCornerShape(24.dp)

@Composable
fun UserDetailsCard(
    user: User,
    isEditing: Boolean,
    onEditClick: () -> Unit,
    onSaveClick: () -> Unit,
    onCancelClick: () -> Unit,
    onDelete: () -> Unit,
    onNameChange: (String) -> Unit,
    onAgeChange: (String) -> Unit,
    onGenderChange: (Gender) -> Unit,
    onHeightChange: (String) -> Unit,
    onWeightChange: (String) -> Unit,
    onDominantHandChange: (DominantHand) -> Unit,
    onColorChange: (Color) -> Unit,
    editName: String,
    editAge: String,
    editGender: Gender,
    editHeight: String,
    editWeight: String,
    editDominantHand: DominantHand,
    editColor: Color,
    modifier: Modifier = Modifier,
    canDelete: Boolean = true,
    canEditName: Boolean = true,
) {
    Card(
        modifier =
            modifier
                .fillMaxWidth()
                .semantics { contentDescription = "User details for ${user.name}" },
        shape = cardShape,
        colors = CardDefaults.cardColors(containerColor = CardBackground),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // User Header with Edit and Delete buttons
            UserDetailsHeader(
                user = user,
                isEditing = isEditing,
                canDelete = canDelete,
                onEditClick = onEditClick,
                onSaveClick = onSaveClick,
                onCancelClick = onCancelClick,
                onDeleteClick = onDelete,
            )

            Spacer(modifier = Modifier.height(20.dp))

            // Form fields
            if (isEditing && canEditName) {
                EditableField(
                    value = editName,
                    onValueChange = onNameChange,
                    label = stringResource(R.string.name),
                )
            } else {
                ReadOnlyField(
                    value = user.name,
                    label = stringResource(R.string.name),
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            Row(modifier = Modifier.fillMaxWidth()) {
                if (isEditing) {
                    EditableField(
                        value = editAge,
                        onValueChange = onAgeChange,
                        label = stringResource(R.string.age),
                        modifier = Modifier.weight(1f),
                        keyboardType = KeyboardType.Number,
                    )
                } else {
                    ReadOnlyField(
                        value = user.age.toString(),
                        label = stringResource(R.string.age),
                        modifier = Modifier.weight(1f),
                    )
                }
                Spacer(modifier = Modifier.width(16.dp))
                if (isEditing) {
                    GenderDropdown(
                        selectedGender = editGender,
                        onGenderChange = onGenderChange,
                        modifier = Modifier.weight(1f),
                    )
                } else {
                    ReadOnlyField(
                        value = user.gender.toString(),
                        label = stringResource(R.string.gender),
                        modifier = Modifier.weight(1f),
                        hasDropdown = true,
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            if (isEditing) {
                EditableField(
                    value = editHeight,
                    onValueChange = onHeightChange,
                    label = stringResource(R.string.height),
                    suffix = "cm",
                    keyboardType = KeyboardType.Number,
                )
            } else {
                ReadOnlyField(
                    value = user.height.toString(),
                    label = stringResource(R.string.height),
                    suffix = "cm",
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            if (isEditing) {
                EditableField(
                    value = editWeight,
                    onValueChange = onWeightChange,
                    label = stringResource(R.string.weight),
                    suffix = "kg",
                    keyboardType = KeyboardType.Number,
                )
            } else {
                ReadOnlyField(
                    value = user.weight.toString(),
                    label = stringResource(R.string.weight),
                    suffix = "kg",
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            if (isEditing) {
                DominantHandDropdown(
                    selectedHand = editDominantHand,
                    onHandChange = onDominantHandChange,
                )
            } else {
                ReadOnlyField(
                    value = user.dominantHand.toString(),
                    label = stringResource(R.string.dominant_hand),
                    hasDropdown = true,
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Color Field
            Text(
                text = stringResource(R.string.color),
                style = MaterialTheme.typography.bodyMedium,
                color = TextGray,
            )
            Spacer(modifier = Modifier.height(4.dp))
            if (isEditing) {
                ColorPickerField(
                    selectedColor = editColor,
                    onColorChange = onColorChange,
                )
            } else {
                OutlinedTextField(
                    value = user.color,
                    onValueChange = { },
                    modifier = Modifier.fillMaxWidth(),
                    shape = fieldShape,
                    readOnly = true,
                    leadingIcon = {
                        Box(
                            modifier =
                                Modifier
                                    .padding(start = 12.dp)
                                    .size(32.dp)
                                    .background(
                                        try {
                                            Color(android.graphics.Color.parseColor(user.color))
                                        } catch (e: IllegalArgumentException) {
                                            PrimaryBlue
                                        },
                                        RoundedCornerShape(4.dp),
                                    ),
                        )
                    },
                )
            }

        }
    }
}

@Composable
private fun UserDetailsHeader(
    user: User,
    isEditing: Boolean,
    canDelete: Boolean,
    onEditClick: () -> Unit,
    onSaveClick: () -> Unit,
    onCancelClick: () -> Unit,
    onDeleteClick: () -> Unit,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Box(
            modifier =
                Modifier
                    .size(60.dp)
                    .background(user.avatarBackgroundColor, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = Icons.Default.Person,
                contentDescription = null,
                modifier = Modifier.size(36.dp),
                tint = user.avatarIconColor,
            )
        }

        Spacer(modifier = Modifier.width(16.dp))

        Column(modifier = Modifier.weight(1f)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = user.name,
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                )
                if (isEditing) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        TextButton(onClick = onCancelClick) {
                            Text(
                                text = stringResource(R.string.cancel),
                                color = TextGray,
                            )
                        }
                        TextButton(onClick = onSaveClick) {
                            Text(
                                text = stringResource(R.string.save),
                                color = PrimaryBlue,
                            )
                        }
                    }
                } else {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        TextButton(onClick = onEditClick) {
                            Text(
                                text = stringResource(R.string.edit),
                                color = PrimaryBlue,
                            )
                        }
                        if (canDelete) {
                            IconButton(onClick = onDeleteClick) {
                                Icon(
                                    imageVector = Icons.Default.Delete,
                                    contentDescription = stringResource(R.string.delete),
                                    tint = ErrorRed,
                                )
                            }
                        }
                    }
                }
            }
            Text(
                text = stringResource(R.string.updated_on, user.updatedAt),
                style = MaterialTheme.typography.bodySmall,
                color = TextGray,
            )
        }
    }
}

@Composable
private fun ReadOnlyField(
    value: String,
    label: String,
    modifier: Modifier = Modifier,
    suffix: String? = null,
    hasDropdown: Boolean = false,
) {
    Column(modifier = modifier) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            color = TextGray,
        )
        Spacer(modifier = Modifier.height(4.dp))
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .border(1.dp, Color(0xFFBDBDBD), fieldShape)
                    .padding(horizontal = 16.dp, vertical = 14.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = value,
                    style = MaterialTheme.typography.bodyLarge,
                )
                when {
                    suffix != null -> Text(text = suffix, color = TextGray)
                    hasDropdown ->
                        Icon(
                            imageVector = Icons.Default.ArrowDropDown,
                            contentDescription = null,
                            tint = TextGray,
                        )
                }
            }
        }
    }
}

@Composable
private fun EditableField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    suffix: String? = null,
    keyboardType: KeyboardType = KeyboardType.Text,
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
            shape = fieldShape,
            keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
            suffix = suffix?.let { { Text(text = it, color = TextGray) } },
            singleLine = true,
        )
    }
}

@Composable
private fun GenderDropdown(
    selectedGender: Gender,
    onGenderChange: (Gender) -> Unit,
    modifier: Modifier = Modifier,
) {
    var expanded by remember { mutableStateOf(false) }

    Column(modifier = modifier) {
        Text(
            text = stringResource(R.string.gender),
            style = MaterialTheme.typography.bodyMedium,
            color = TextGray,
        )
        Spacer(modifier = Modifier.height(4.dp))
        Box {
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .border(1.dp, Color(0xFFBDBDBD), fieldShape)
                        .clickable { expanded = true }
                        .padding(horizontal = 16.dp, vertical = 14.dp),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = selectedGender.toString(),
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
                Gender.entries.forEach { gender ->
                    DropdownMenuItem(
                        text = { Text(gender.toString()) },
                        onClick = {
                            onGenderChange(gender)
                            expanded = false
                        },
                    )
                }
            }
        }
    }
}

@Composable
private fun DominantHandDropdown(
    selectedHand: DominantHand,
    onHandChange: (DominantHand) -> Unit,
    modifier: Modifier = Modifier,
) {
    var expanded by remember { mutableStateOf(false) }

    Column(modifier = modifier) {
        Text(
            text = stringResource(R.string.dominant_hand),
            style = MaterialTheme.typography.bodyMedium,
            color = TextGray,
        )
        Spacer(modifier = Modifier.height(4.dp))
        Box {
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .border(1.dp, Color(0xFFBDBDBD), fieldShape)
                        .clickable { expanded = true }
                        .padding(horizontal = 16.dp, vertical = 14.dp),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = selectedHand.toString(),
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
                DominantHand.entries.forEach { hand ->
                    DropdownMenuItem(
                        text = { Text(hand.toString()) },
                        onClick = {
                            onHandChange(hand)
                            expanded = false
                        },
                    )
                }
            }
        }
    }
}

private val colorOptions = listOf(
    Color(0xFF3B82F6), // Blue (default)
    Color(0xFFE53935), // Red
    Color(0xFFFBC02D), // Yellow
    Color(0xFF4CAF50), // Green
    Color(0xFF9C27B0), // Purple
    Color(0xFFFF9800), // Orange
    Color(0xFF00BCD4), // Cyan
    Color(0xFFE91E63), // Pink
)

@Composable
private fun ColorPickerField(
    selectedColor: Color,
    onColorChange: (Color) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .border(1.dp, Color(0xFFBDBDBD), fieldShape)
                .padding(horizontal = 16.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        colorOptions.forEach { color ->
            val isSelected = color == selectedColor
            Box(
                modifier =
                    Modifier
                        .size(32.dp)
                        .background(color, CircleShape)
                        .clickable { onColorChange(color) }
                        .then(
                            if (isSelected) {
                                Modifier.border(2.dp, Color.White, CircleShape)
                            } else {
                                Modifier
                            }
                        ),
                contentAlignment = Alignment.Center,
            ) {
                if (isSelected) {
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
