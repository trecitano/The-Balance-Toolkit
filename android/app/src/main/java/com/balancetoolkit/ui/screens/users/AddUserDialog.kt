package com.balancetoolkit.ui.screens.users

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
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
import com.balancetoolkit.ui.theme.CardBackground
import com.balancetoolkit.ui.theme.PrimaryBlue
import com.balancetoolkit.ui.theme.TextGray
import com.balancetoolkit.viewmodel.AddUserFormState

private val buttonShape = RoundedCornerShape(24.dp)
private val dialogShape = RoundedCornerShape(16.dp)
private val cancelButtonColor = Color(0xFF9E9E9E)

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
) {
    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
                .semantics { contentDescription = "Add new user dialog" },
            shape = dialogShape,
            color = CardBackground,
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(20.dp),
            ) {
                // Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = stringResource(R.string.add_new_user),
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

                Spacer(modifier = Modifier.height(20.dp))

                // Name Field (required)
                LabeledTextField(
                    value = formState.name,
                    onValueChange = onNameChange,
                    label = stringResource(R.string.name_required),
                    placeholder = stringResource(R.string.enter_name),
                    isError = formState.name.isBlank() && formState.nameError != null,
                    errorMessage = formState.nameError,
                )

                Spacer(modifier = Modifier.height(16.dp))

                // Age and Gender Row
                Row(modifier = Modifier.fillMaxWidth()) {
                    LabeledTextField(
                        value = formState.age,
                        onValueChange = onAgeChange,
                        label = stringResource(R.string.age),
                        keyboardType = KeyboardType.Number,
                        modifier = Modifier.weight(1f),
                    )

                    Spacer(modifier = Modifier.width(16.dp))

                    EnumDropdown(
                        selected = formState.gender,
                        onSelect = onGenderChange,
                        entries = Gender.entries,
                        label = stringResource(R.string.gender),
                        modifier = Modifier.weight(1f),
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Height and Weight Row
                Row(modifier = Modifier.fillMaxWidth()) {
                    LabeledTextField(
                        value = formState.height,
                        onValueChange = onHeightChange,
                        label = stringResource(R.string.height_cm),
                        keyboardType = KeyboardType.Number,
                        modifier = Modifier.weight(1f),
                    )

                    Spacer(modifier = Modifier.width(16.dp))

                    WeightFieldWithButton(
                        value = formState.weight,
                        onValueChange = onWeightChange,
                        onWeightButtonClick = onWeightButtonClick,
                        modifier = Modifier.weight(1f),
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Dominant hand Field
                EnumDropdown(
                    selected = formState.dominantHand,
                    onSelect = onDominantHandChange,
                    entries = DominantHand.entries,
                    label = stringResource(R.string.dominant_hand),
                )

                Spacer(modifier = Modifier.height(16.dp))

                // Color Field
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

                Spacer(modifier = Modifier.height(24.dp))

                // Add User and Cancel Buttons
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    Button(
                        onClick = onAddUser,
                        modifier = Modifier.weight(1f),
                        enabled = formState.isValid,
                        colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue),
                        shape = buttonShape,
                    ) {
                        Text(stringResource(R.string.add_user))
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
