package com.balancetoolkit.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.IconButton
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
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
import com.balancetoolkit.ui.theme.PrimaryBlueDark
import com.balancetoolkit.ui.theme.StatusConnected
import com.balancetoolkit.ui.theme.StatusDisconnected
import com.balancetoolkit.ui.theme.TextDarkGray
import com.balancetoolkit.ui.theme.TextGray

// Pre-defined shapes for reuse
private val cardShape = RoundedCornerShape(12.dp)
private val userCardShape = RoundedCornerShape(16.dp)
private val selectedBorder = BorderStroke(2.dp, PrimaryBlue)
private val unselectedBorder = BorderStroke(1.dp, BorderGray)
private val statusBadgeShape = RoundedCornerShape(16.dp)
private val deviceIconShape = RoundedCornerShape(8.dp)
private val deviceIconGridShape = RoundedCornerShape(2.dp)

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
    onToggleConnection: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Card(
        modifier =
            modifier
                .fillMaxWidth()
                .semantics { contentDescription = "Device ${device.name}, ${if (device.isConnected) "connected" else "disconnected"}" },
        shape = cardShape,
        colors = CardDefaults.cardColors(containerColor = CardBackground),
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            // Device Icon
            DeviceIcon()

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

                Text(
                    text = device.displayInfo,
                    style = MaterialTheme.typography.bodySmall,
                    color = TextGray,
                )

                // Mock device indicator
                if (device.isMock) {
                    Text(
                        text = "Mock Device",
                        style = MaterialTheme.typography.labelSmall,
                        color = Color(0xFFFF9800),
                    )
                }

                Spacer(modifier = Modifier.height(8.dp))

                // Status and Action buttons
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    // Status Badge
                    Box(
                        modifier =
                            Modifier
                                .background(
                                    if (device.isConnected) StatusConnected else StatusDisconnected,
                                    statusBadgeShape,
                                ).padding(horizontal = 12.dp, vertical = 6.dp),
                    ) {
                        Text(
                            text =
                                if (device.isConnected) {
                                    stringResource(R.string.connected)
                                } else {
                                    stringResource(R.string.disconnected)
                                },
                            style = MaterialTheme.typography.labelMedium,
                            color = if (device.isConnected) Color.White else TextDarkGray,
                        )
                    }

                    // Action Button
                    Button(
                        onClick = onToggleConnection,
                        colors =
                            ButtonDefaults.buttonColors(
                                containerColor = if (device.isConnected) ErrorRed else PrimaryBlue,
                            ),
                        shape = statusBadgeShape,
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 6.dp),
                    ) {
                        Text(
                            text =
                                if (device.isConnected) {
                                    stringResource(R.string.disconnect)
                                } else {
                                    stringResource(R.string.connect)
                                },
                            style = MaterialTheme.typography.labelMedium,
                        )
                    }
                }
            }

            // Edit Button
            IconButton(
                onClick = onEdit,
                modifier = Modifier.semantics {
                    contentDescription = "Edit device ${device.name}"
                },
            ) {
                Icon(
                    imageVector = Icons.Default.Edit,
                    contentDescription = stringResource(R.string.edit),
                    tint = TextGray,
                )
            }

            // Delete Button
            IconButton(
                onClick = onDelete,
                modifier = Modifier.semantics {
                    contentDescription = "Delete device ${device.name}"
                },
            ) {
                Icon(
                    imageVector = Icons.Default.Delete,
                    contentDescription = stringResource(R.string.delete),
                    tint = ErrorRed,
                )
            }
        }
    }
}

@Composable
private fun DeviceIcon() {
    Box(
        modifier =
            Modifier
                .size(48.dp)
                .background(PrimaryBlueBackground, deviceIconShape),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                Box(
                    modifier =
                        Modifier
                            .size(16.dp)
                            .background(PrimaryBlue, deviceIconGridShape),
                )
                Box(
                    modifier =
                        Modifier
                            .size(16.dp)
                            .background(PrimaryBlue, deviceIconGridShape),
                )
            }
            Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                Box(
                    modifier =
                        Modifier
                            .size(16.dp)
                            .background(PrimaryBlue, deviceIconGridShape),
                )
                Box(
                    modifier =
                        Modifier
                            .size(16.dp)
                            .background(PrimaryBlue, deviceIconGridShape),
                )
            }
        }
    }
}

@Composable
fun BoardVisualization(
    connectedBoards: List<Int>,
    modifier: Modifier = Modifier,
) {
    val totalBoards = 9
    val boardsPerRow = 3

    Column(
        modifier =
            modifier.semantics {
                contentDescription = "${connectedBoards.size} of $totalBoards boards connected"
            },
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        for (row in 0 until 3) {
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                for (col in 0 until boardsPerRow) {
                    val boardIndex = row * boardsPerRow + col
                    val isConnected = boardIndex in connectedBoards

                    Box(
                        modifier =
                            Modifier
                                .size(40.dp)
                                .background(
                                    if (isConnected) PrimaryBlue else StatusDisconnected,
                                    RoundedCornerShape(4.dp),
                                ).border(
                                    width = 1.dp,
                                    color = if (isConnected) PrimaryBlueDark else BorderGray,
                                    shape = RoundedCornerShape(4.dp),
                                ),
                    )
                }
            }
        }
    }
}
