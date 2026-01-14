package com.balancetoolkit.ui.screens.users

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.balancetoolkit.R
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
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    modifier: Modifier = Modifier,
    canDelete: Boolean = true,
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
            // User Header
            UserDetailsHeader(user = user)

            Spacer(modifier = Modifier.height(20.dp))

            // Form fields
            ReadOnlyField(
                value = user.name,
                label = stringResource(R.string.name),
            )

            Spacer(modifier = Modifier.height(16.dp))

            Row(modifier = Modifier.fillMaxWidth()) {
                ReadOnlyField(
                    value = user.age.toString(),
                    label = stringResource(R.string.age),
                    modifier = Modifier.weight(1f),
                )
                Spacer(modifier = Modifier.width(16.dp))
                ReadOnlyField(
                    value = user.gender.toString(),
                    label = stringResource(R.string.gender),
                    modifier = Modifier.weight(1f),
                    hasDropdown = true,
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            ReadOnlyField(
                value = user.height.toString(),
                label = stringResource(R.string.height),
                suffix = "cm",
            )

            Spacer(modifier = Modifier.height(16.dp))

            ReadOnlyField(
                value = user.weight.toString(),
                label = stringResource(R.string.weight),
                suffix = "kg",
            )

            Spacer(modifier = Modifier.height(16.dp))

            ReadOnlyField(
                value = user.dominantHand.toString(),
                label = stringResource(R.string.dominant_hand),
                hasDropdown = true,
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Color Field
            Text(
                text = stringResource(R.string.color),
                style = MaterialTheme.typography.bodyMedium,
                color = TextGray,
            )
            Spacer(modifier = Modifier.height(4.dp))
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

            Spacer(modifier = Modifier.height(16.dp))

            // Notes Field
            Text(
                text = stringResource(R.string.notes),
                style = MaterialTheme.typography.bodyMedium,
                color = TextGray,
            )
            Spacer(modifier = Modifier.height(4.dp))
            OutlinedTextField(
                value = user.notes,
                onValueChange = { },
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .height(100.dp),
                shape = fieldShape,
                readOnly = true,
                placeholder = { Text("") },
            )

            Spacer(modifier = Modifier.height(24.dp))

            // Edit and Delete Buttons
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = if (canDelete) Arrangement.spacedBy(16.dp) else Arrangement.Center,
            ) {
                Button(
                    onClick = onEdit,
                    modifier = if (canDelete) Modifier.weight(1f) else Modifier,
                    colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue),
                    shape = buttonShape,
                ) {
                    Text(stringResource(R.string.edit))
                }

                if (canDelete) {
                    Button(
                        onClick = onDelete,
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = ErrorRed),
                        shape = buttonShape,
                    ) {
                        Text(stringResource(R.string.delete))
                    }
                }
            }
        }
    }
}

@Composable
private fun UserDetailsHeader(user: User) {
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

        Column {
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
