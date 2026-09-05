package com.balancetoolkit.ui.screens.users

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
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
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
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
import com.balancetoolkit.data.HeightUnit
import com.balancetoolkit.data.WeightUnit
import com.balancetoolkit.data.model.DominantHand
import com.balancetoolkit.data.model.Gender
import com.balancetoolkit.data.model.User
import com.balancetoolkit.data.model.getAvatarColors
import com.balancetoolkit.ui.components.ColorPickerRowColor
import com.balancetoolkit.ui.components.EnumDropdown
import com.balancetoolkit.ui.components.LabeledTextField
import com.balancetoolkit.ui.components.ReadOnlyFieldWithBorder
import com.balancetoolkit.ui.components.WeightFieldWithButton
import com.balancetoolkit.ui.theme.BorderGray
import com.balancetoolkit.ui.theme.CardBackground
import com.balancetoolkit.ui.theme.ErrorRed
import com.balancetoolkit.ui.theme.PrimaryBlue
import com.balancetoolkit.ui.theme.TextGray

private val cardShape = RoundedCornerShape(12.dp)
private val actionButtonShape = RoundedCornerShape(10.dp)
private val readOnlyColorShape = RoundedCornerShape(8.dp)

private fun Color.toHexString(): String {
    val r = (red * 255).toInt()
    val g = (green * 255).toInt()
    val b = (blue * 255).toInt()
    return String.format("#%02X%02X%02X", r, g, b)
}

private fun User.parseDisplayColor(): Color =
    try {
        Color(android.graphics.Color.parseColor(color))
    } catch (e: IllegalArgumentException) {
        PrimaryBlue
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
    heightUnit: HeightUnit,
    weightUnit: WeightUnit,
    modifier: Modifier = Modifier,
    canDelete: Boolean = true,
    canEditName: Boolean = true,
) {
    val selectedColor = if (isEditing) editColor else user.parseDisplayColor()

    Card(
        modifier =
            modifier
                .fillMaxWidth()
                .semantics { contentDescription = "User details for ${user.name}" },
        shape = cardShape,
        colors = CardDefaults.cardColors(containerColor = CardBackground),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            UserDetailsHeader(
                user = user,
                isEditing = isEditing,
                editColor = editColor,
            )

            Spacer(modifier = Modifier.height(20.dp))

            if (isEditing) {
                UserDetailsActionBar(
                    onSaveClick = onSaveClick,
                    onCancelClick = onCancelClick,
                )
            } else {
                BottomActions(
                    canDelete = canDelete,
                    onEditClick = onEditClick,
                    onDeleteClick = onDelete,
                )
            }

            Spacer(modifier = Modifier.height(20.dp))

            UserDetailsSection(title = stringResource(R.string.user_profile_section)) {
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
            }

            Spacer(modifier = Modifier.height(20.dp))

            UserDetailsSection(title = stringResource(R.string.user_body_metrics_section)) {
                ResponsiveTwoColumnFields(
                    first = { fieldModifier ->
                        if (isEditing) {
                            LabeledTextField(
                                value = editAge,
                                onValueChange = onAgeChange,
                                label = stringResource(R.string.age),
                                modifier = fieldModifier,
                                keyboardType = KeyboardType.Number,
                            )
                        } else {
                            ReadOnlyFieldWithBorder(
                                value = user.age.toString(),
                                label = stringResource(R.string.age),
                                suffix = stringResource(R.string.years),
                                modifier = fieldModifier,
                            )
                        }
                    },
                    second = { fieldModifier ->
                        if (isEditing) {
                            LabeledTextField(
                                value = editHeight,
                                onValueChange = onHeightChange,
                                label = "${stringResource(R.string.height)} (${heightUnit.label})",
                                keyboardType = KeyboardType.Number,
                                modifier = fieldModifier,
                            )
                        } else {
                            ReadOnlyFieldWithBorder(
                                value = heightUnit.fromMetric(user.height),
                                label = stringResource(R.string.height),
                                suffix = heightUnit.label,
                                modifier = fieldModifier,
                            )
                        }
                    },
                )

                if (isEditing) {
                    WeightFieldWithButton(
                        value = editWeight,
                        onValueChange = onWeightChange,
                        onWeightButtonClick = onWeightButtonClick,
                        label = "${stringResource(R.string.weight)} (${weightUnit.label})",
                    )
                } else {
                    ReadOnlyFieldWithBorder(
                        value = weightUnit.fromMetric(user.weight),
                        label = stringResource(R.string.weight),
                        suffix = weightUnit.label,
                    )
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            UserDetailsSection(title = stringResource(R.string.user_preferences_section)) {
                ResponsiveTwoColumnFields(
                    first = { fieldModifier ->
                        if (isEditing) {
                            EnumDropdown(
                                selected = editGender,
                                onSelect = onGenderChange,
                                entries = Gender.entries,
                                label = stringResource(R.string.gender),
                                modifier = fieldModifier,
                            )
                        } else {
                            ReadOnlyFieldWithBorder(
                                value = user.gender.toString(),
                                label = stringResource(R.string.gender),
                                modifier = fieldModifier,
                            )
                        }
                    },
                    second = { fieldModifier ->
                        if (isEditing) {
                            EnumDropdown(
                                selected = editDominantHand,
                                onSelect = onDominantHandChange,
                                entries = DominantHand.entries,
                                label = stringResource(R.string.dominant_hand),
                                modifier = fieldModifier,
                            )
                        } else {
                            ReadOnlyFieldWithBorder(
                                value = user.dominantHand.toString(),
                                label = stringResource(R.string.dominant_hand),
                                modifier = fieldModifier,
                            )
                        }
                    },
                )
            }

            Spacer(modifier = Modifier.height(20.dp))

            Text(
                text = stringResource(R.string.color),
                style = MaterialTheme.typography.bodyMedium,
                color = TextGray,
            )
            Spacer(modifier = Modifier.height(4.dp))
            if (isEditing) {
                ColorPickerRowColor(
                    selectedColor = selectedColor,
                    onColorChange = onColorChange,
                )
            } else {
                ReadOnlyColorField(color = selectedColor)
            }
        }
    }
}

@Composable
private fun UserDetailsHeader(
    user: User,
    isEditing: Boolean,
    editColor: Color,
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
            Text(
                text = user.name,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
            )
            Text(
                text = stringResource(R.string.updated_on, user.updatedAt),
                style = MaterialTheme.typography.bodySmall,
                color = TextGray,
            )
        }
    }
}

@Composable
private fun UserDetailsSection(
    title: String,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column {
        Text(
            text = title,
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.SemiBold,
        )
        Spacer(modifier = Modifier.height(8.dp))
        Column(
            verticalArrangement = Arrangement.spacedBy(12.dp),
            content = content,
        )
    }
}

@Composable
private fun ResponsiveTwoColumnFields(
    first: @Composable (Modifier) -> Unit,
    second: @Composable (Modifier) -> Unit,
    modifier: Modifier = Modifier,
) {
    BoxWithConstraints(modifier = modifier.fillMaxWidth()) {
        val isCompact = maxWidth < 420.dp

        if (isCompact) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                first(Modifier.fillMaxWidth())
                second(Modifier.fillMaxWidth())
            }
        } else {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                first(Modifier.weight(1f))
                second(Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun ReadOnlyColorField(
    color: Color,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .height(44.dp)
                .background(color = color, shape = readOnlyColorShape)
                .border(1.dp, BorderGray, readOnlyColorShape),
    )
}

@Composable
private fun UserDetailsActionBar(
    onSaveClick: () -> Unit,
    onCancelClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        OutlinedButton(
            onClick = onCancelClick,
            modifier = Modifier.weight(1f),
            shape = actionButtonShape,
            border = BorderStroke(1.dp, BorderGray),
        ) {
            Text(text = stringResource(R.string.cancel))
        }

        Button(
            onClick = onSaveClick,
            modifier = Modifier.weight(1f),
            shape = actionButtonShape,
            colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue),
        ) {
            Text(text = stringResource(R.string.save))
        }
    }
}

@Composable
private fun BottomActions(
    canDelete: Boolean,
    onEditClick: () -> Unit,
    onDeleteClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        OutlinedButton(
            onClick = onEditClick,
            modifier = if (canDelete) Modifier.weight(1f) else Modifier.fillMaxWidth(),
            shape = actionButtonShape,
            border = BorderStroke(1.dp, BorderGray),
        ) {
            Text(text = stringResource(R.string.edit))
        }

        if (canDelete) {
            Button(
                onClick = onDeleteClick,
                modifier = Modifier.weight(1f),
                shape = actionButtonShape,
                colors = ButtonDefaults.buttonColors(containerColor = ErrorRed),
            ) {
                Text(text = stringResource(R.string.delete_user_action))
            }
        }
    }
}
