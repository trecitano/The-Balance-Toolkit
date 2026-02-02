package com.balancetoolkit.ui.screens.users

import androidx.compose.foundation.background
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
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
import com.balancetoolkit.data.model.getAvatarColors
import com.balancetoolkit.ui.components.ColorPickerRowColor
import com.balancetoolkit.ui.components.EnumDropdown
import com.balancetoolkit.ui.components.LabeledTextField
import com.balancetoolkit.ui.components.ReadOnlyFieldWithBorder
import com.balancetoolkit.ui.components.WeightFieldWithButton
import com.balancetoolkit.ui.theme.CardBackground
import com.balancetoolkit.ui.theme.ErrorRed
import com.balancetoolkit.ui.theme.PrimaryBlue
import com.balancetoolkit.ui.theme.TextGray

private val cardShape = RoundedCornerShape(12.dp)

private fun Color.toHexString(): String {
    val r = (red * 255).toInt()
    val g = (green * 255).toInt()
    val b = (blue * 255).toInt()
    return String.format("#%02X%02X%02X", r, g, b)
}

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
    onWeightButtonClick: () -> Unit,
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
                editColor = editColor,
                onEditClick = onEditClick,
                onSaveClick = onSaveClick,
                onCancelClick = onCancelClick,
                onDeleteClick = onDelete,
            )

            Spacer(modifier = Modifier.height(20.dp))

            // Name Field
            if (isEditing && canEditName) {
                LabeledTextField(
                    value = editName,
                    onValueChange = onNameChange,
                    label = stringResource(R.string.name),
                )
            } else {
                ReadOnlyFieldWithBorder(
                    value = user.name,
                    label = stringResource(R.string.name),
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Age and Gender Row
            Row(modifier = Modifier.fillMaxWidth()) {
                if (isEditing) {
                    LabeledTextField(
                        value = editAge,
                        onValueChange = onAgeChange,
                        label = stringResource(R.string.age),
                        modifier = Modifier.weight(1f),
                        keyboardType = KeyboardType.Number,
                    )
                } else {
                    ReadOnlyFieldWithBorder(
                        value = user.age.toString(),
                        label = stringResource(R.string.age),
                        modifier = Modifier.weight(1f),
                    )
                }
                Spacer(modifier = Modifier.width(16.dp))
                if (isEditing) {
                    EnumDropdown(
                        selected = editGender,
                        onSelect = onGenderChange,
                        entries = Gender.entries,
                        label = stringResource(R.string.gender),
                        modifier = Modifier.weight(1f),
                    )
                } else {
                    ReadOnlyFieldWithBorder(
                        value = user.gender.toString(),
                        label = stringResource(R.string.gender),
                        modifier = Modifier.weight(1f),
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Height and Weight Row
            Row(modifier = Modifier.fillMaxWidth()) {
                if (isEditing) {
                    LabeledTextField(
                        value = editHeight,
                        onValueChange = onHeightChange,
                        label = stringResource(R.string.height_cm),
                        keyboardType = KeyboardType.Number,
                        modifier = Modifier.weight(1f),
                    )
                } else {
                    ReadOnlyFieldWithBorder(
                        value = user.height.toString(),
                        label = stringResource(R.string.height),
                        suffix = "cm",
                        modifier = Modifier.weight(1f),
                    )
                }
                Spacer(modifier = Modifier.width(16.dp))
                if (isEditing) {
                    WeightFieldWithButton(
                        value = editWeight,
                        onValueChange = onWeightChange,
                        onWeightButtonClick = onWeightButtonClick,
                        modifier = Modifier.weight(1f),
                    )
                } else {
                    ReadOnlyFieldWithBorder(
                        value = user.weight.toString(),
                        label = stringResource(R.string.weight),
                        suffix = "kg",
                        modifier = Modifier.weight(1f),
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Dominant Hand Field
            if (isEditing) {
                EnumDropdown(
                    selected = editDominantHand,
                    onSelect = onDominantHandChange,
                    entries = DominantHand.entries,
                    label = stringResource(R.string.dominant_hand),
                )
            } else {
                ReadOnlyFieldWithBorder(
                    value = user.dominantHand.toString(),
                    label = stringResource(R.string.dominant_hand),
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
            ColorPickerRowColor(
                selectedColor =
                    if (isEditing) {
                        editColor
                    } else {
                        try {
                            Color(android.graphics.Color.parseColor(user.color))
                        } catch (e: IllegalArgumentException) {
                            PrimaryBlue
                        }
                    },
                onColorChange = if (isEditing) onColorChange else { _ -> },
            )
        }
    }
}

@Composable
private fun UserDetailsHeader(
    user: User,
    isEditing: Boolean,
    canDelete: Boolean,
    editColor: Color,
    onEditClick: () -> Unit,
    onSaveClick: () -> Unit,
    onCancelClick: () -> Unit,
    onDeleteClick: () -> Unit,
) {
    val (avatarBackground, avatarIcon) =
        if (isEditing) {
            getAvatarColors(editColor.toHexString())
        } else {
            user.avatarBackgroundColor to user.avatarIconColor
        }

    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Box(
            modifier =
                Modifier
                    .size(60.dp)
                    .background(avatarBackground, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = Icons.Default.Person,
                contentDescription = null,
                modifier = Modifier.size(36.dp),
                tint = avatarIcon,
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
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        if (canDelete) {
                            IconButton(onClick = onDeleteClick) {
                                Icon(
                                    imageVector = Icons.Default.Delete,
                                    contentDescription = stringResource(R.string.delete),
                                    tint = ErrorRed,
                                )
                            }
                        }
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
