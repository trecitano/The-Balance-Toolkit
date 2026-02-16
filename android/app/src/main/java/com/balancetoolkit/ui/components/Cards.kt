package com.balancetoolkit.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ExitToApp
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.MoreVert
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
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.balancetoolkit.R
import com.balancetoolkit.data.model.Device
import com.balancetoolkit.ui.theme.BorderGray
import com.balancetoolkit.ui.theme.CardBackground
import com.balancetoolkit.ui.theme.ErrorRed
import com.balancetoolkit.ui.theme.PrimaryBlue
import com.balancetoolkit.ui.theme.PrimaryBlueBackground
import com.balancetoolkit.ui.theme.TextGray

// Pre-defined shapes for reuse
private val cardShape = RoundedCornerShape(12.dp)
private val userCardShape = RoundedCornerShape(16.dp)
private val selectedBorder = BorderStroke(2.dp, PrimaryBlue)
private val unselectedBorder = BorderStroke(1.dp, BorderGray)
private val boardConnectedColor = Color(0xFF4CAF50)
private val boardAttentionColor = Color(0xFFF57C00)
private val boardDisconnectedColor = Color(0xFF9E9E9E)

@Composable
fun UserCard(
    name: String,
    isSelected: Boolean,
    updateDate: String,
    avatarBackgroundColor: Color,
    avatarIconColor: Color,
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
) {
    val containerColor =
        remember(isSelected) {
            if (isSelected) PrimaryBlueBackground else CardBackground
        }
    val border =
        remember(isSelected) {
            if (isSelected) selectedBorder else unselectedBorder
        }

    Box(modifier = modifier.semantics { contentDescription = "User card for $name" }) {
        Card(
            onClick = onClick ?: {},
            enabled = onClick != null,
            modifier =
                Modifier
                    .width(150.dp)
                    .height(180.dp),
            shape = userCardShape,
            colors = CardDefaults.cardColors(containerColor = containerColor),
            border = border,
        ) {
            Column(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .padding(16.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                // Avatar Circle
                Box(
                    modifier =
                        Modifier
                            .size(70.dp)
                            .background(avatarBackgroundColor, CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = Icons.Default.Person,
                        contentDescription = stringResource(R.string.user_avatar_description, name),
                        modifier = Modifier.size(42.dp),
                        tint = avatarIconColor,
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))

                Text(
                    text = name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                )

                Text(
                    text = stringResource(R.string.updated),
                    style = MaterialTheme.typography.bodySmall,
                    color = TextGray,
                )

                Text(
                    text = updateDate,
                    style = MaterialTheme.typography.bodySmall,
                    color = TextGray,
                )
            }
        }

        // Selected badge
        if (isSelected) {
            Box(
                modifier =
                    Modifier
                        .align(Alignment.TopEnd)
                        .padding(8.dp)
                        .background(PrimaryBlue, RoundedCornerShape(4.dp))
                        .padding(horizontal = 8.dp, vertical = 4.dp),
            ) {
                Text(
                    text = stringResource(R.string.selected_short),
                    color = Color.White,
                    style = MaterialTheme.typography.labelSmall,
                )
            }
        }
    }
}

@Composable
fun DeviceCard(
    device: Device,
    onToggleSelection: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var showMenu by remember { mutableStateOf(false) }

    val statusDescription =
        when {
            device.isSelected -> "selected"
            device.isConnected -> "connected"
            else -> "disconnected"
        }

    val containerColor =
        remember(device.isSelected) {
            if (device.isSelected) PrimaryBlueBackground else CardBackground
        }

    val border =
        remember(device.isSelected) {
            if (device.isSelected) selectedBorder else null
        }

    val boardStatusColor =
        when {
            device.isSelected -> boardConnectedColor
            device.isConnected -> boardAttentionColor
            else -> boardDisconnectedColor
        }

    Card(
        modifier =
            modifier
                .fillMaxWidth()
                .semantics { contentDescription = "Device ${device.name}, $statusDescription" },
        shape = cardShape,
        colors = CardDefaults.cardColors(containerColor = containerColor),
        border = border,
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            // Device Icon
            DeviceIcon(tint = boardStatusColor)

            Spacer(modifier = Modifier.width(12.dp))

            // Device Info
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = device.name,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                    )
                    if (device.isConnected) {
                        Spacer(modifier = Modifier.width(4.dp))
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ExitToApp,
                            contentDescription = stringResource(R.string.external_link),
                            modifier = Modifier.size(16.dp),
                            tint = TextGray,
                        )
                    }
                }

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text(
                        text = device.displayInfo,
                        style = MaterialTheme.typography.bodySmall,
                        color = TextGray,
                    )

                    // Mock device indicator
                    if (device.isMock) {
                        Text(
                            text = "Mock",
                            style = MaterialTheme.typography.labelSmall,
                            color = Color(0xFFFF9800),
                        )
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                // Status indicator and Action buttons
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    // Small status dot with text
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        Box(
                            modifier =
                                Modifier
                                    .size(8.dp)
                                    .background(boardStatusColor, CircleShape),
                        )
                        Text(
                            text =
                                when {
                                    device.isSelected -> stringResource(R.string.selected)
                                    device.isConnected -> stringResource(R.string.connected)
                                    else -> stringResource(R.string.disconnected)
                                },
                            style = MaterialTheme.typography.labelSmall,
                            color = if (device.isSelected) boardStatusColor else TextGray,
                        )
                    }

                    // Action Buttons - Select or Deselect (only for connected devices)
                    if (device.isSelected) {
                        OutlinedButton(
                            onClick = onToggleSelection,
                            border = BorderStroke(1.dp, PrimaryBlue),
                            shape = RoundedCornerShape(6.dp),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                            modifier = Modifier.height(28.dp),
                        ) {
                            Text(
                                text = stringResource(R.string.deselect),
                                style = MaterialTheme.typography.labelSmall,
                                color = PrimaryBlue,
                            )
                        }
                    } else if (device.isConnected) {
                        Button(
                            onClick = onToggleSelection,
                            colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue),
                            shape = RoundedCornerShape(6.dp),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                            modifier = Modifier.height(28.dp),
                        ) {
                            Text(
                                text = stringResource(R.string.select),
                                style = MaterialTheme.typography.labelSmall,
                            )
                        }
                    }
                }
            }

            // More options menu
            Box {
                IconButton(
                    onClick = { showMenu = true },
                    modifier =
                        Modifier
                            .size(40.dp)
                            .semantics {
                                contentDescription = "More options for ${device.name}"
                            },
                ) {
                    Icon(
                        imageVector = Icons.Default.MoreVert,
                        contentDescription = stringResource(R.string.more_options),
                        tint = TextGray,
                    )
                }

                DropdownMenu(
                    expanded = showMenu,
                    onDismissRequest = { showMenu = false },
                ) {
                    DropdownMenuItem(
                        text = { Text(stringResource(R.string.edit)) },
                        onClick = {
                            showMenu = false
                            onEdit()
                        },
                        leadingIcon = {
                            Icon(
                                imageVector = Icons.Default.Edit,
                                contentDescription = null,
                                tint = TextGray,
                            )
                        },
                    )
                    DropdownMenuItem(
                        text = {
                            Text(
                                stringResource(R.string.delete),
                                color = ErrorRed,
                            )
                        },
                        onClick = {
                            showMenu = false
                            onDelete()
                        },
                        leadingIcon = {
                            Icon(
                                imageVector = Icons.Default.Delete,
                                contentDescription = null,
                                tint = ErrorRed,
                            )
                        },
                    )
                }
            }
        }
    }
}

@Composable
private fun DeviceIcon(
    tint: Color,
    modifier: Modifier = Modifier,
) {
    Icon(
        painter = painterResource(id = R.drawable.wbb_top_bold),
        contentDescription = null,
        tint = tint,
        modifier = modifier.size(32.dp),
    )
}
