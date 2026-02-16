package com.balancetoolkit.ui.screens.users

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.balancetoolkit.R
import com.balancetoolkit.data.model.DominantHand
import com.balancetoolkit.data.model.Gender
import com.balancetoolkit.ui.components.ColorPickerRow
import com.balancetoolkit.ui.components.EnumDropdown
import com.balancetoolkit.ui.components.LabeledTextField
import com.balancetoolkit.ui.components.WeightFieldWithButton
import com.balancetoolkit.ui.theme.BorderGray
import com.balancetoolkit.ui.theme.CardBackground
import com.balancetoolkit.ui.theme.PrimaryBlue
import com.balancetoolkit.ui.theme.TextGray
import com.balancetoolkit.viewmodel.AddUserFormState

private val dialogShape = RoundedCornerShape(16.dp)
private val actionButtonShape = RoundedCornerShape(10.dp)
private val dialogMaxWidth = 560.dp
private val dialogMaxHeight = 680.dp
private val compactBreakpoint = 420.dp

@Composable
fun AddUserDialog(
    formState: AddUserFormState,
    onNameChange: (String) -> Unit,
    onAgeChange: (String) -> Unit,
    onGenderChange: (Gender) -> Unit,
    onHeightChange: (String) -> Unit,
    onWeightChange: (String) -> Unit,
    onDominantHandChange: (DominantHand) -> Unit,
    onColorChange: (String) -> Unit,
    onWeightButtonClick: () -> Unit,
    onDismiss: () -> Unit,
    onAddUser: () -> Unit,
    heightLabel: String = stringResource(R.string.height_cm),
    weightLabel: String = stringResource(R.string.weight_kg),
) {
    val scrollState = rememberScrollState()

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        Surface(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(16.dp)
                    .widthIn(max = dialogMaxWidth)
                    .semantics { contentDescription = "Add new user dialog" },
            shape = dialogShape,
            color = CardBackground,
        ) {
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(max = dialogMaxHeight),
            ) {
                AddUserDialogHeader(onDismiss = onDismiss)
                HorizontalDivider(color = BorderGray)

                Column(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .weight(1f, fill = false)
                            .verticalScroll(scrollState)
                            .padding(horizontal = 20.dp, vertical = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(20.dp),
                ) {
                    AddUserDialogForm(
                        formState = formState,
                        onNameChange = onNameChange,
                        onAgeChange = onAgeChange,
                        onGenderChange = onGenderChange,
                        onHeightChange = onHeightChange,
                        onWeightChange = onWeightChange,
                        onDominantHandChange = onDominantHandChange,
                        onColorChange = onColorChange,
                        onWeightButtonClick = onWeightButtonClick,
                        heightLabel = heightLabel,
                        weightLabel = weightLabel,
                    )
                }

                HorizontalDivider(color = BorderGray)
                AddUserDialogActionBar(
                    isAddEnabled = formState.isValid,
                    onAddUser = onAddUser,
                    onDismiss = onDismiss,
                )
            }
        }
    }
}

@Composable
private fun AddUserDialogHeader(
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = stringResource(R.string.add_new_user),
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
        )

        IconButton(onClick = onDismiss) {
            Icon(
                imageVector = Icons.Default.Close,
                contentDescription = stringResource(R.string.close),
            )
        }
    }
}

@Composable
private fun AddUserDialogForm(
    formState: AddUserFormState,
    onNameChange: (String) -> Unit,
    onAgeChange: (String) -> Unit,
    onGenderChange: (Gender) -> Unit,
    onHeightChange: (String) -> Unit,
    onWeightChange: (String) -> Unit,
    onDominantHandChange: (DominantHand) -> Unit,
    onColorChange: (String) -> Unit,
    onWeightButtonClick: () -> Unit,
    heightLabel: String,
    weightLabel: String,
) {
    AddUserDialogSection(title = stringResource(R.string.user_profile_section)) {
        LabeledTextField(
            value = formState.name,
            onValueChange = onNameChange,
            label = stringResource(R.string.name_required),
            placeholder = stringResource(R.string.enter_name),
            isError = formState.name.isBlank() && formState.nameError != null,
            errorMessage = formState.nameError,
        )
    }

    AddUserDialogSection(title = stringResource(R.string.user_body_metrics_section)) {
        ResponsiveFieldRow(
            first = { fieldModifier ->
                LabeledTextField(
                    value = formState.age,
                    onValueChange = onAgeChange,
                    label = stringResource(R.string.age),
                    keyboardType = KeyboardType.Number,
                    modifier = fieldModifier,
                )
            },
            second = { fieldModifier ->
                LabeledTextField(
                    value = formState.height,
                    onValueChange = onHeightChange,
                    label = heightLabel,
                    keyboardType = KeyboardType.Number,
                    modifier = fieldModifier,
                )
            },
        )

        WeightFieldWithButton(
            value = formState.weight,
            onValueChange = onWeightChange,
            onWeightButtonClick = onWeightButtonClick,
            label = weightLabel,
        )
    }

    AddUserDialogSection(title = stringResource(R.string.user_preferences_section)) {
        ResponsiveFieldRow(
            first = { fieldModifier ->
                EnumDropdown(
                    selected = formState.gender,
                    onSelect = onGenderChange,
                    entries = Gender.entries,
                    label = stringResource(R.string.gender),
                    modifier = fieldModifier,
                )
            },
            second = { fieldModifier ->
                EnumDropdown(
                    selected = formState.dominantHand,
                    onSelect = onDominantHandChange,
                    entries = DominantHand.entries,
                    label = stringResource(R.string.dominant_hand),
                    modifier = fieldModifier,
                )
            },
        )

        Text(
            text = stringResource(R.string.color),
            style = MaterialTheme.typography.bodyMedium,
            color = TextGray,
        )
        Spacer(modifier = Modifier.height(4.dp))
        ColorPickerRow(
            selectedColor = formState.color,
            onColorChange = onColorChange,
        )
    }
}

@Composable
private fun AddUserDialogSection(
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
private fun ResponsiveFieldRow(
    first: @Composable (Modifier) -> Unit,
    second: @Composable (Modifier) -> Unit,
    modifier: Modifier = Modifier,
) {
    BoxWithConstraints(modifier = modifier.fillMaxWidth()) {
        val isCompact = maxWidth < compactBreakpoint

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
private fun AddUserDialogActionBar(
    isAddEnabled: Boolean,
    onAddUser: () -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        OutlinedButton(
            onClick = onDismiss,
            modifier = Modifier.weight(1f),
            shape = actionButtonShape,
            border = BorderStroke(1.dp, BorderGray),
        ) {
            Text(text = stringResource(R.string.cancel))
        }

        Button(
            onClick = onAddUser,
            modifier = Modifier.weight(1f),
            enabled = isAddEnabled,
            colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue),
            shape = actionButtonShape,
        ) {
            Text(text = stringResource(R.string.add_user))
        }
    }
}
