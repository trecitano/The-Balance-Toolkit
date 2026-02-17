package com.balancetoolkit.ui.screens.session

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.balancetoolkit.R
import com.balancetoolkit.bluetooth.SensorReading
import com.balancetoolkit.data.model.User
import com.balancetoolkit.ui.components.AppHeader
import com.balancetoolkit.ui.theme.BackgroundGray
import com.balancetoolkit.ui.theme.BorderGray
import com.balancetoolkit.ui.theme.CardBackground
import com.balancetoolkit.ui.theme.ChartBlue
import com.balancetoolkit.ui.theme.ChartGreen
import com.balancetoolkit.ui.theme.ChartOrange
import com.balancetoolkit.ui.theme.ChartRed
import com.balancetoolkit.ui.theme.ChartYellow
import com.balancetoolkit.ui.theme.PrimaryBlue
import com.balancetoolkit.ui.theme.PrimaryRed
import com.balancetoolkit.ui.theme.SecondaryPurple
import com.balancetoolkit.ui.theme.TextGray
import com.balancetoolkit.ui.theme.TheBalanceToolkitTheme
import com.balancetoolkit.util.TrackPerformance
import com.balancetoolkit.viewmodel.AmplitudeSpectrum
import com.balancetoolkit.viewmodel.BoardSelectionStatus
import com.balancetoolkit.viewmodel.CopPosition
import com.balancetoolkit.viewmodel.DpsiMetrics
import com.balancetoolkit.viewmodel.SessionUiState
import com.balancetoolkit.viewmodel.SessionViewModel

private val cardShape = RoundedCornerShape(12.dp)
private val statusConnectedColor = Color(0xFF4CAF50)
private val statusAttentionColor = Color(0xFFF57C00)
private val statusDisconnectedColor = Color(0xFF9E9E9E)

@Composable
fun SessionScreen(
    viewModel: SessionViewModel,
    onNavigateToUsers: () -> Unit,
    onNavigateToDevices: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    SessionScreenContent(
        uiState = uiState,
        onSliderChange = viewModel::updateSliderPosition,
        onConfidenceEllipseChange = viewModel::setConfidenceEllipse,
        onConvexHullChange = viewModel::setConvexHull,
        onMlSiChange = viewModel::setMlSi,
        onApSiChange = viewModel::setApSi,
        onVsiChange = viewModel::setVsi,
        onDpsiChange = viewModel::setDpsi,
        onFftXChange = viewModel::setFftX,
        onFftYChange = viewModel::setFftY,
        onFftCombinedChange = viewModel::setFftCombined,
        onToggleSession = viewModel::togglePlay,
        onTare = viewModel::applyTare,
        canStartSession = uiState.canStartSession,
        onUserClick = onNavigateToUsers,
        onDevicesClick = onNavigateToDevices,
        modifier = modifier,
    )
}

@Composable
private fun SessionScreenContent(
    uiState: SessionUiState,
    onSliderChange: (Float) -> Unit,
    onConfidenceEllipseChange: (Boolean) -> Unit,
    onConvexHullChange: (Boolean) -> Unit,
    onMlSiChange: (Boolean) -> Unit,
    onApSiChange: (Boolean) -> Unit,
    onVsiChange: (Boolean) -> Unit,
    onDpsiChange: (Boolean) -> Unit,
    onFftXChange: (Boolean) -> Unit,
    onFftYChange: (Boolean) -> Unit,
    onFftCombinedChange: (Boolean) -> Unit,
    onToggleSession: () -> Unit,
    onTare: () -> Unit,
    canStartSession: Boolean,
    onUserClick: () -> Unit,
    onDevicesClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    TrackPerformance("SessionScreen")

    Column(
        modifier =
            modifier
                .fillMaxSize()
                .background(BackgroundGray),
    ) {
        AppHeader()

        LazyColumn(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(0.dp),
        ) {
            item(key = "device_card") {
                Spacer(modifier = Modifier.height(8.dp))
                SessionDeviceCard(
                    boardStatus = uiState.boardStatus,
                    deviceName = uiState.deviceName,
                    macAddress = uiState.deviceMacAddress,
                    isMockMode = uiState.isMockMode,
                )
            }

            // Selected user info
            uiState.selectedUser?.let { user ->
                item(key = "user_card") {
                    Spacer(modifier = Modifier.height(8.dp))
                    SelectedUserCard(user = user, onClick = onUserClick)
                }
            }

            item(key = "control_card") {
                // Session control buttons
                Spacer(modifier = Modifier.height(8.dp))
                SessionControlCard(
                    boardStatus = uiState.boardStatus,
                    isRecording = uiState.isRecording,
                    onToggleSession = onToggleSession,
                    onTare = onTare,
                    canStartSession = canStartSession,
                    onDevicesClick = onDevicesClick,
                )
            }

            item(key = "cop_viz") {
                Spacer(modifier = Modifier.height(16.dp))
                COPVisualizationCard(
                    currentCop = uiState.currentCop,
                    currentReading = uiState.currentReading,
                    readingFrequencyHz = uiState.readingFrequencyHz,
                    copTrail = uiState.copTrail,
                    confidenceEllipsePoints = uiState.confidenceEllipsePoints,
                    showConfidenceEllipse = uiState.showConfidenceEllipse,
                    onConfidenceEllipseChange = onConfidenceEllipseChange,
                    showConvexHull = uiState.showConvexHull,
                    onConvexHullChange = onConvexHullChange,
                )
            }

            item(key = "cop_plots") {
                Spacer(modifier = Modifier.height(16.dp))
                // CopX and CopY plots row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    CopPlotCard(
                        title = stringResource(R.string.cop_x_title),
                        copTrail = uiState.copTrail,
                        valueSelector = { it.x },
                        lineColor = ChartBlue,
                        minLabel = stringResource(R.string.left_negative_one),
                        maxLabel = stringResource(R.string.right_positive_one),
                        modifier = Modifier.weight(1f),
                    )
                    CopPlotCard(
                        title = stringResource(R.string.cop_y_title),
                        copTrail = uiState.copTrail,
                        valueSelector = { it.y },
                        lineColor = ChartRed,
                        minLabel = stringResource(R.string.back_negative_one),
                        maxLabel = stringResource(R.string.front_positive_one),
                        modifier = Modifier.weight(1f),
                    )
                }
            }

            item(key = "velocity_plots") {
                Spacer(modifier = Modifier.height(12.dp))
                // vCopX and vCopY plots row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    VelocityPlotCard(
                        title = "vCopX",
                        velocityTrail = uiState.vCopXTrail,
                        currentValue = uiState.vCopX,
                        lineColor = ChartBlue,
                        modifier = Modifier.weight(1f),
                    )
                    VelocityPlotCard(
                        title = "vCopY",
                        velocityTrail = uiState.vCopYTrail,
                        currentValue = uiState.vCopY,
                        lineColor = ChartRed,
                        modifier = Modifier.weight(1f),
                    )
                }
            }

            item(key = "fft_chart") {
                Spacer(modifier = Modifier.height(16.dp))
                FFTChartCard(
                    amplitudeSpectrum = uiState.amplitudeSpectrum,
                    showX = uiState.showFftX,
                    showY = uiState.showFftY,
                    showCombined = uiState.showFftCombined,
                    onShowXChange = onFftXChange,
                    onShowYChange = onFftYChange,
                    onShowCombinedChange = onFftCombinedChange,
                )
            }

            item(key = "dpsi_metrics") {
                Spacer(modifier = Modifier.height(16.dp))
                // DPSI Metrics card with plot and toggles
                DpsiMetricsCard(
                    dpsiMetrics = uiState.dpsiMetrics,
                    mlsiTrail = uiState.mlsiTrail,
                    apsiTrail = uiState.apsiTrail,
                    vsiTrail = uiState.vsiTrail,
                    dpsiTrail = uiState.dpsiTrail,
                    showMlsi = uiState.showMlSi,
                    showApsi = uiState.showApSi,
                    showVsi = uiState.showVsi,
                    showDpsi = uiState.showDpsi,
                    onMlsiChange = onMlSiChange,
                    onApsiChange = onApSiChange,
                    onVsiChange = onVsiChange,
                    onDpsiChange = onDpsiChange,
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(modifier = Modifier.height(16.dp))
            }
        }
    }
}

@Composable
private fun SessionDeviceCard(
    boardStatus: BoardSelectionStatus,
    deviceName: String,
    macAddress: String,
    isMockMode: Boolean,
) {
    val statusText =
        when (boardStatus) {
            BoardSelectionStatus.NoBoardConnected -> stringResource(R.string.no_board_connected)
            BoardSelectionStatus.BoardConnectedNotSelected -> stringResource(R.string.board_connected_select_board)
            BoardSelectionStatus.BoardSelected -> stringResource(R.string.board_selected, deviceName.ifBlank { stringResource(R.string.board) })
        }
    val statusColor =
        when (boardStatus) {
            BoardSelectionStatus.NoBoardConnected -> statusDisconnectedColor
            BoardSelectionStatus.BoardConnectedNotSelected -> statusAttentionColor
            BoardSelectionStatus.BoardSelected -> statusConnectedColor
        }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = cardShape,
        colors = CardDefaults.cardColors(containerColor = CardBackground),
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = statusText,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Medium,
                )
                if (isMockMode) {
                    Text(
                        text = stringResource(R.string.mock_mode),
                        style = MaterialTheme.typography.bodySmall,
                        color = ChartOrange,
                    )
                }
            }
            Box(
                modifier =
                    Modifier
                        .size(10.dp)
                        .background(statusColor, CircleShape),
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = if (boardStatus == BoardSelectionStatus.BoardSelected) macAddress else "",
                style = MaterialTheme.typography.bodySmall,
                color = TextGray,
            )
        }
    }
}

@Composable
private fun SelectedUserCard(
    user: User,
    onClick: () -> Unit,
) {
    Card(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(onClick = onClick),
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
            // User avatar
            Box(
                modifier =
                    Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .background(user.avatarBackgroundColor),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = Icons.Default.Person,
                    contentDescription = null,
                    tint = user.avatarIconColor,
                    modifier = Modifier.size(24.dp),
                )
            }

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = user.name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Medium,
                )
                Text(
                    text = "${user.weight} kg",
                    style = MaterialTheme.typography.bodySmall,
                    color = TextGray,
                )
            }
        }
    }
}

@Composable
private fun SessionControlCard(
    boardStatus: BoardSelectionStatus,
    isRecording: Boolean,
    onToggleSession: () -> Unit,
    onTare: () -> Unit,
    canStartSession: Boolean,
    onDevicesClick: () -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = cardShape,
        colors = CardDefaults.cardColors(containerColor = CardBackground),
    ) {
        if (!canStartSession && !isRecording) {
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(4.dp),
            ) {
                OutlinedButton(
                    onClick = onDevicesClick,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(8.dp),
                ) {
                    Text(
                        text =
                            when (boardStatus) {
                                BoardSelectionStatus.NoBoardConnected -> stringResource(R.string.no_board_connected)
                                BoardSelectionStatus.BoardConnectedNotSelected -> stringResource(R.string.board_connected_select_board)
                                BoardSelectionStatus.BoardSelected -> stringResource(R.string.board_selected, stringResource(R.string.board))
                            },
                        fontWeight = FontWeight.Medium,
                    )
                }
            }
        } else {
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(4.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Button(
                    onClick = onToggleSession,
                    colors =
                        ButtonDefaults.buttonColors(
                            containerColor = if (isRecording) PrimaryRed else PrimaryBlue,
                        ),
                    modifier = Modifier.weight(1f),
                ) {
                    Text(
                        text = if (isRecording) stringResource(R.string.stop_session) else stringResource(R.string.start_session),
                        fontWeight = FontWeight.Medium,
                    )
                }

                Button(
                    onClick = onTare,
                    colors = ButtonDefaults.buttonColors(containerColor = SecondaryPurple),
                    enabled = isRecording,
                ) {
                    Icon(
                        imageVector = Icons.Default.Refresh,
                        contentDescription = stringResource(R.string.tare),
                        modifier = Modifier.size(20.dp),
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(stringResource(R.string.tare))
                }
            }
        }
    }
}

// CoP coordinate range (normalized)
private const val COP_MIN = -1f
private const val COP_MAX = 1f

/**
 * Maps a normalized CoP value [-1, 1] to screen X coordinate.
 */
private fun mapCopToScreenX(
    copX: Float,
    width: Float,
): Float {
    val ratio = (copX - COP_MIN) / (COP_MAX - COP_MIN)
    return ratio.coerceIn(0f, 1f) * width
}

/**
 * Maps a normalized CoP value [-1, 1] to screen Y coordinate.
 * Inverts Y so positive is visually up.
 */
private fun mapCopToScreenY(
    copY: Float,
    height: Float,
): Float {
    val ratio = (copY - COP_MIN) / (COP_MAX - COP_MIN)
    return (1f - ratio.coerceIn(0f, 1f)) * height
}

@Composable
private fun COPVisualizationCard(
    currentCop: CopPosition,
    currentReading: SensorReading,
    readingFrequencyHz: Float,
    copTrail: List<CopPosition>,
    confidenceEllipsePoints: List<Pair<Float, Float>>,
    showConfidenceEllipse: Boolean,
    onConfidenceEllipseChange: (Boolean) -> Unit,
    showConvexHull: Boolean,
    onConvexHullChange: (Boolean) -> Unit,
) {
    val crosshairColor = BorderGray
    val copDotColor = SecondaryPurple
    val trailColor = SecondaryPurple.copy(alpha = 0.5f)
    val hullColor = ChartBlue.copy(alpha = 0.3f)
    val hullStrokeColor = ChartBlue
    val ellipseColor = ChartOrange.copy(alpha = 0.3f)
    val ellipseStrokeColor = ChartOrange

    // Color range for weight intensity
    val lowLoadColor = ChartGreen.copy(alpha = 0.4f)
    val highLoadColor = ChartRed.copy(alpha = 0.7f)
    val maxSensorValue =
        maxOf(
            currentReading.topLeft,
            currentReading.topRight,
            currentReading.bottomLeft,
            currentReading.bottomRight,
            0.1f,
        )

    Card(
        modifier =
            Modifier
                .fillMaxWidth()
                .semantics { contentDescription = "Center of pressure visualization" },
        shape = cardShape,
        colors = CardDefaults.cardColors(containerColor = CardBackground),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .height(200.dp)
                        .border(2.dp, BorderGray, RoundedCornerShape(8.dp)),
                contentAlignment = Alignment.Center,
            ) {
                // Sensor weight overlays in corners
                SensorWeightLabel(
                    weight = currentReading.topLeft,
                    relativeIntensity = currentReading.topLeft / maxSensorValue,
                    lowColor = lowLoadColor,
                    highColor = highLoadColor,
                    modifier = Modifier.align(Alignment.TopStart).padding(4.dp),
                )
                SensorWeightLabel(
                    weight = currentReading.topRight,
                    relativeIntensity = currentReading.topRight / maxSensorValue,
                    lowColor = lowLoadColor,
                    highColor = highLoadColor,
                    modifier = Modifier.align(Alignment.TopEnd).padding(4.dp),
                )
                SensorWeightLabel(
                    weight = currentReading.bottomLeft,
                    relativeIntensity = currentReading.bottomLeft / maxSensorValue,
                    lowColor = lowLoadColor,
                    highColor = highLoadColor,
                    modifier = Modifier.align(Alignment.BottomStart).padding(4.dp),
                )
                SensorWeightLabel(
                    weight = currentReading.bottomRight,
                    relativeIntensity = currentReading.bottomRight / maxSensorValue,
                    lowColor = lowLoadColor,
                    highColor = highLoadColor,
                    modifier = Modifier.align(Alignment.BottomEnd).padding(4.dp),
                )

                Canvas(
                    modifier = Modifier.fillMaxSize().padding(4.dp),
                ) {
                    val w = size.width
                    val h = size.height
                    val centerX = w / 2
                    val centerY = h / 2

                    // Draw crosshair lines
                    drawLine(
                        color = crosshairColor,
                        start = Offset(centerX, 0f),
                        end = Offset(centerX, h),
                        strokeWidth = 1.dp.toPx(),
                    )
                    drawLine(
                        color = crosshairColor,
                        start = Offset(0f, centerY),
                        end = Offset(w, centerY),
                        strokeWidth = 1.dp.toPx(),
                    )

                    // Draw convex hull of trail points if enabled
                    if (showConvexHull && copTrail.size >= 3) {
                        val hull = computeConvexHull(copTrail)
                        if (hull.size >= 3) {
                            val hullPath =
                                Path().apply {
                                    val firstPoint = hull.first()
                                    moveTo(
                                        mapCopToScreenX(firstPoint.x, w),
                                        mapCopToScreenY(firstPoint.y, h),
                                    )
                                    hull.drop(1).forEach { point ->
                                        lineTo(
                                            mapCopToScreenX(point.x, w),
                                            mapCopToScreenY(point.y, h),
                                        )
                                    }
                                    close()
                                }
                            drawPath(hullPath, color = hullColor)
                            drawPath(hullPath, color = hullStrokeColor, style = Stroke(width = 2.dp.toPx()))
                        }
                    }

                    // Draw confidence ellipse if enabled
                    if (showConfidenceEllipse && confidenceEllipsePoints.size >= 3) {
                        val ellipsePath =
                            Path().apply {
                                val firstPoint = confidenceEllipsePoints.first()
                                moveTo(
                                    mapCopToScreenX(firstPoint.first, w),
                                    mapCopToScreenY(firstPoint.second, h),
                                )
                                confidenceEllipsePoints.drop(1).forEach { point ->
                                    lineTo(
                                        mapCopToScreenX(point.first, w),
                                        mapCopToScreenY(point.second, h),
                                    )
                                }
                                close()
                            }
                        drawPath(ellipsePath, color = ellipseColor)
                        drawPath(ellipsePath, color = ellipseStrokeColor, style = Stroke(width = 2.dp.toPx()))
                    }

                    // Draw CoP trail
                    if (copTrail.size >= 2) {
                        val trailPath =
                            Path().apply {
                                val firstPoint = copTrail.first()
                                moveTo(
                                    mapCopToScreenX(firstPoint.x, w),
                                    mapCopToScreenY(firstPoint.y, h),
                                )
                                copTrail.drop(1).forEach { point ->
                                    lineTo(
                                        mapCopToScreenX(point.x, w),
                                        mapCopToScreenY(point.y, h),
                                    )
                                }
                            }
                        drawPath(trailPath, color = trailColor, style = Stroke(width = 2.dp.toPx()))
                    }

                    // Draw current CoP position
                    val copScreenX = mapCopToScreenX(currentCop.x, w)
                    val copScreenY = mapCopToScreenY(currentCop.y, h)
                    drawCircle(
                        color = copDotColor,
                        radius = 6.dp.toPx(),
                        center = Offset(copScreenX, copScreenY),
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // CoP coordinates, total weight, and frequency display
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    text = "CoP: (%6.2f, %6.2f)".format(currentCop.x, currentCop.y),
                    style = MaterialTheme.typography.bodySmall,
                    fontFamily = FontFamily.Monospace,
                    color = TextGray,
                )
                Column(
                    horizontalAlignment = Alignment.End,
                ) {
                    Text(
                        text = "%7.1f kg".format(currentReading.totalForce),
                        style = MaterialTheme.typography.bodySmall,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Medium,
                        color = PrimaryBlue,
                    )
                    Text(
                        text = "%5.1f Hz".format(readingFrequencyHz),
                        style = MaterialTheme.typography.labelSmall,
                        fontFamily = FontFamily.Monospace,
                        color = TextGray,
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Stable references for tap handlers
            val currentConvexHullState = rememberUpdatedState(showConvexHull)
            val currentConvexHullCallback = rememberUpdatedState(onConvexHullChange)
            val currentEllipseState = rememberUpdatedState(showConfidenceEllipse)
            val currentEllipseCallback = rememberUpdatedState(onConfidenceEllipseChange)

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Start,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                // Use pointerInput with detectTapGestures for explicit tap handling
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier =
                        Modifier.pointerInput(Unit) {
                            detectTapGestures(
                                onTap = { currentConvexHullCallback.value(!currentConvexHullState.value) },
                            )
                        },
                ) {
                    Checkbox(
                        checked = showConvexHull,
                        onCheckedChange = null, // Disabled - only explicit tap triggers change
                        colors = CheckboxDefaults.colors(checkedColor = ChartBlue),
                    )
                    Box(
                        modifier =
                            Modifier
                                .size(8.dp)
                                .background(ChartBlue, CircleShape),
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(stringResource(R.string.convex_hull), style = MaterialTheme.typography.bodySmall)
                }

                Spacer(modifier = Modifier.width(16.dp))

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier =
                        Modifier.pointerInput(Unit) {
                            detectTapGestures(
                                onTap = { currentEllipseCallback.value(!currentEllipseState.value) },
                            )
                        },
                ) {
                    Checkbox(
                        checked = showConfidenceEllipse,
                        onCheckedChange = null, // Disabled - only explicit tap triggers change
                        colors = CheckboxDefaults.colors(checkedColor = ChartOrange),
                    )
                    Box(
                        modifier =
                            Modifier
                                .size(8.dp)
                                .background(ChartOrange, CircleShape),
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("95% Ellipse", style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}

/**
 * Compact sensor weight label for corner overlay.
 */
@Composable
private fun SensorWeightLabel(
    weight: Float,
    relativeIntensity: Float,
    lowColor: Color,
    highColor: Color,
    modifier: Modifier = Modifier,
) {
    val backgroundColor = lerp(lowColor, highColor, relativeIntensity.coerceIn(0f, 1f))

    Box(
        modifier =
            modifier
                .background(backgroundColor, RoundedCornerShape(4.dp))
                .padding(horizontal = 6.dp, vertical = 2.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = "%.1f".format(weight),
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold,
            color = Color.Black.copy(alpha = 0.8f),
        )
    }
}

/**
 * Compute the convex hull of a set of points using Graham scan algorithm.
 */
private fun computeConvexHull(points: List<CopPosition>): List<CopPosition> {
    if (points.size < 3) return points

    // Find the point with lowest y (and leftmost if tie)
    val start = points.minWithOrNull(compareBy({ it.y }, { it.x })) ?: return points

    // Sort points by polar angle with respect to start
    val sorted =
        points.filter { it != start }.sortedWith { a, b ->
            val crossProduct = cross(start, a, b)
            if (crossProduct == 0f) {
                // Collinear points - sort by distance
                val distA = (a.x - start.x) * (a.x - start.x) + (a.y - start.y) * (a.y - start.y)
                val distB = (b.x - start.x) * (b.x - start.x) + (b.y - start.y) * (b.y - start.y)
                distA.compareTo(distB)
            } else {
                -crossProduct.compareTo(0f)
            }
        }

    val hull = mutableListOf(start)

    for (point in sorted) {
        while (hull.size > 1 && cross(hull[hull.size - 2], hull[hull.size - 1], point) <= 0) {
            hull.removeAt(hull.size - 1)
        }
        hull.add(point)
    }

    return hull
}

private fun cross(
    o: CopPosition,
    a: CopPosition,
    b: CopPosition,
): Float = (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)

@Composable
private fun FFTChartCard(
    amplitudeSpectrum: AmplitudeSpectrum,
    showX: Boolean,
    showY: Boolean,
    showCombined: Boolean,
    onShowXChange: (Boolean) -> Unit,
    onShowYChange: (Boolean) -> Unit,
    onShowCombinedChange: (Boolean) -> Unit,
) {
    // Calculate dynamic Y-axis range based on visible data
    val visibleAmplitudes = mutableListOf<List<Float>>()
    if (showX) visibleAmplitudes.add(amplitudeSpectrum.amplitudeX)
    if (showY) visibleAmplitudes.add(amplitudeSpectrum.amplitudeY)
    if (showCombined) visibleAmplitudes.add(amplitudeSpectrum.amplitudeXY)

    val maxAmplitude =
        if (visibleAmplitudes.isNotEmpty() && visibleAmplitudes.any { it.isNotEmpty() }) {
            visibleAmplitudes.flatten().maxOrNull()?.let { maxOf(it, 0.1f) } ?: 1f
        } else {
            1f
        }

    // Round up to nice number for display
    val yMax =
        when {
            maxAmplitude <= 0.5f -> 0.5f
            maxAmplitude <= 1f -> 1f
            maxAmplitude <= 2f -> 2f
            else -> ((maxAmplitude.toInt()) + 1).toFloat()
        }

    // Max frequency for X-axis (2 Hz)
    val xMax = 2f

    Card(
        modifier =
            Modifier
                .fillMaxWidth()
                .semantics { contentDescription = "FFT Amplitude Spectrum chart" },
        shape = cardShape,
        colors = CardDefaults.cardColors(containerColor = CardBackground),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = stringResource(R.string.fft_amplitude_spectrum),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
            )

            Spacer(modifier = Modifier.height(8.dp))

            // Chart with Y-axis labels
            Row(modifier = Modifier.fillMaxWidth()) {
                // Y-axis labels column
                Column(
                    modifier = Modifier.width(25.dp).height(120.dp),
                    verticalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(
                        text = "%.1f".format(yMax),
                        style = MaterialTheme.typography.labelSmall,
                        color = TextGray,
                    )
                    Text(
                        text = "%.1f".format(yMax / 2),
                        style = MaterialTheme.typography.labelSmall,
                        color = TextGray,
                    )
                    Text(
                        text = "0",
                        style = MaterialTheme.typography.labelSmall,
                        color = TextGray,
                    )
                }

                // Chart area
                Column(modifier = Modifier.weight(1f)) {
                    Box(
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .height(120.dp)
                                .border(1.dp, BorderGray, RoundedCornerShape(4.dp)),
                    ) {
                        Canvas(modifier = Modifier.fillMaxSize().padding(4.dp)) {
                            val w = size.width
                            val h = size.height

                            // Draw horizontal grid lines
                            drawLine(
                                color = BorderGray.copy(alpha = 0.3f),
                                start = Offset(0f, h / 2),
                                end = Offset(w, h / 2),
                                strokeWidth = 0.5.dp.toPx(),
                            )

                            // Draw each enabled spectrum
                            if (showX && amplitudeSpectrum.freqsHz.isNotEmpty()) {
                                drawFftLine(amplitudeSpectrum.freqsHz, amplitudeSpectrum.amplitudeX, ChartYellow, yMax, xMax, w, h)
                            }
                            if (showY && amplitudeSpectrum.freqsHz.isNotEmpty()) {
                                drawFftLine(amplitudeSpectrum.freqsHz, amplitudeSpectrum.amplitudeY, ChartRed, yMax, xMax, w, h)
                            }
                            if (showCombined && amplitudeSpectrum.freqsHz.isNotEmpty()) {
                                drawFftLine(amplitudeSpectrum.freqsHz, amplitudeSpectrum.amplitudeXY, ChartBlue, yMax, xMax, w, h)
                            }

                            // Draw dots at the last point for each enabled spectrum
                            if (showX && amplitudeSpectrum.amplitudeX.isNotEmpty()) {
                                val lastIdx = amplitudeSpectrum.amplitudeX.lastIndex
                                val x = (amplitudeSpectrum.freqsHz[lastIdx] / xMax).coerceIn(0f, 1f) * w
                                val y = h - (amplitudeSpectrum.amplitudeX[lastIdx] / yMax).coerceIn(0f, 1f) * h
                                drawCircle(ChartYellow, 4.dp.toPx(), Offset(x, y))
                            }
                            if (showY && amplitudeSpectrum.amplitudeY.isNotEmpty()) {
                                val lastIdx = amplitudeSpectrum.amplitudeY.lastIndex
                                val x = (amplitudeSpectrum.freqsHz[lastIdx] / xMax).coerceIn(0f, 1f) * w
                                val y = h - (amplitudeSpectrum.amplitudeY[lastIdx] / yMax).coerceIn(0f, 1f) * h
                                drawCircle(ChartRed, 4.dp.toPx(), Offset(x, y))
                            }
                            if (showCombined && amplitudeSpectrum.amplitudeXY.isNotEmpty()) {
                                val lastIdx = amplitudeSpectrum.amplitudeXY.lastIndex
                                val x = (amplitudeSpectrum.freqsHz[lastIdx] / xMax).coerceIn(0f, 1f) * w
                                val y = h - (amplitudeSpectrum.amplitudeXY[lastIdx] / yMax).coerceIn(0f, 1f) * h
                                drawCircle(ChartBlue, 4.dp.toPx(), Offset(x, y))
                            }
                        }
                    }

                    // X-axis labels
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(top = 2.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Text("0", style = MaterialTheme.typography.labelSmall, color = TextGray)
                        Text("0.5", style = MaterialTheme.typography.labelSmall, color = TextGray)
                        Text("1", style = MaterialTheme.typography.labelSmall, color = TextGray)
                        Text("1.5", style = MaterialTheme.typography.labelSmall, color = TextGray)
                        Text("2", style = MaterialTheme.typography.labelSmall, color = TextGray)
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Toggle checkboxes row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                FftToggleItem(
                    label = "X",
                    checked = showX,
                    onCheckedChange = onShowXChange,
                    color = ChartYellow,
                )
                FftToggleItem(
                    label = "Y",
                    checked = showY,
                    onCheckedChange = onShowYChange,
                    color = ChartRed,
                )
                FftToggleItem(
                    label = stringResource(R.string.combined),
                    checked = showCombined,
                    onCheckedChange = onShowCombinedChange,
                    color = ChartBlue,
                )
            }
        }
    }
}

private fun androidx.compose.ui.graphics.drawscope.DrawScope.drawFftLine(
    freqs: List<Float>,
    amplitudes: List<Float>,
    color: Color,
    yMax: Float,
    xMax: Float,
    w: Float,
    h: Float,
) {
    if (freqs.size < 2 || amplitudes.size < 2) return

    val path =
        Path().apply {
            val firstX = (freqs[0] / xMax).coerceIn(0f, 1f) * w
            val firstY = h - (amplitudes[0] / yMax).coerceIn(0f, 1f) * h
            moveTo(firstX, firstY)

            for (i in 1 until minOf(freqs.size, amplitudes.size)) {
                val x = (freqs[i] / xMax).coerceIn(0f, 1f) * w
                val y = h - (amplitudes[i] / yMax).coerceIn(0f, 1f) * h
                lineTo(x, y)
            }
        }
    drawPath(
        path = path,
        color = color,
        style = Stroke(width = 2.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round),
    )
}

@Composable
private fun FftToggleItem(
    label: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    color: Color,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Checkbox(
            checked = checked,
            onCheckedChange = onCheckedChange,
            modifier = Modifier.size(20.dp),
            colors = CheckboxDefaults.colors(checkedColor = color),
        )
        Box(
            modifier =
                Modifier
                    .size(8.dp)
                    .background(color, CircleShape),
        )
        Spacer(modifier = Modifier.width(2.dp))
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
        )
    }
}

@Composable
private fun CopPlotCard(
    title: String,
    copTrail: List<CopPosition>,
    valueSelector: (CopPosition) -> Float,
    lineColor: Color,
    minLabel: String,
    maxLabel: String,
    modifier: Modifier = Modifier,
) {
    Card(
        modifier = modifier,
        shape = cardShape,
        colors = CardDefaults.cardColors(containerColor = CardBackground),
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
            )

            Spacer(modifier = Modifier.height(4.dp))

            // Labels row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    text = maxLabel,
                    style = MaterialTheme.typography.labelSmall,
                    color = TextGray,
                )
            }

            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .height(80.dp)
                        .border(1.dp, BorderGray, RoundedCornerShape(4.dp)),
            ) {
                Canvas(modifier = Modifier.fillMaxSize().padding(4.dp)) {
                    val w = size.width
                    val h = size.height
                    val centerY = h / 2

                    // Draw center line (zero line)
                    drawLine(
                        color = BorderGray,
                        start = Offset(0f, centerY),
                        end = Offset(w, centerY),
                        strokeWidth = 1.dp.toPx(),
                    )

                    // Draw the time-series line
                    if (copTrail.size >= 2) {
                        val values = copTrail.map { valueSelector(it) }
                        val path =
                            Path().apply {
                                val firstValue = values.first()
                                // Map value from [-1, 1] to [h, 0] (inverted so +1 is at top)
                                val firstY = ((1f - firstValue) / 2f) * h
                                moveTo(0f, firstY)

                                values.forEachIndexed { index, value ->
                                    val x = (index.toFloat() / (values.size - 1)) * w
                                    val y = ((1f - value) / 2f) * h
                                    lineTo(x, y)
                                }
                            }
                        drawPath(
                            path = path,
                            color = lineColor,
                            style = Stroke(width = 2.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round),
                        )

                        // Draw current position dot
                        if (copTrail.isNotEmpty()) {
                            val lastValue = values.last()
                            val lastX = w
                            val lastY = ((1f - lastValue) / 2f) * h
                            drawCircle(
                                color = lineColor,
                                radius = 5.dp.toPx(),
                                center = Offset(lastX, lastY),
                            )
                        }
                    }
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    text = minLabel,
                    style = MaterialTheme.typography.labelSmall,
                    color = TextGray,
                )
            }
        }
    }
}

@Composable
private fun VelocityPlotCard(
    title: String,
    velocityTrail: List<Float>,
    currentValue: Float,
    lineColor: Color,
    modifier: Modifier = Modifier,
) {
    // Calculate dynamic Y-axis range based on data
    val maxValue =
        if (velocityTrail.isNotEmpty()) {
            maxOf(velocityTrail.maxOrNull() ?: 0f, 0.1f)
        } else {
            0.5f // Default max
        }
    // Round up to nice number for display
    val yMax =
        when {
            maxValue <= 0.1f -> 0.1f
            maxValue <= 0.2f -> 0.2f
            maxValue <= 0.3f -> 0.3f
            maxValue <= 0.5f -> 0.5f
            maxValue <= 1f -> 1f
            else -> ((maxValue * 10).toInt() + 1) / 10f
        }

    Card(
        modifier = modifier,
        shape = cardShape,
        colors = CardDefaults.cardColors(containerColor = CardBackground),
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
            )

            Spacer(modifier = Modifier.height(4.dp))

            // Y-axis labels on the left
            Row(modifier = Modifier.fillMaxWidth()) {
                // Y-axis labels column
                Column(
                    modifier = Modifier.width(30.dp).height(80.dp),
                    verticalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(
                        text = "%.1f".format(yMax),
                        style = MaterialTheme.typography.labelSmall,
                        color = TextGray,
                    )
                    Text(
                        text = "%.1f".format(yMax / 2),
                        style = MaterialTheme.typography.labelSmall,
                        color = TextGray,
                    )
                    Text(
                        text = "0",
                        style = MaterialTheme.typography.labelSmall,
                        color = TextGray,
                    )
                }

                // Chart area
                Box(
                    modifier =
                        Modifier
                            .weight(1f)
                            .height(80.dp)
                            .border(1.dp, BorderGray, RoundedCornerShape(4.dp)),
                ) {
                    Canvas(modifier = Modifier.fillMaxSize().padding(4.dp)) {
                        val w = size.width
                        val h = size.height

                        // Draw horizontal grid lines
                        drawLine(
                            color = BorderGray.copy(alpha = 0.5f),
                            start = Offset(0f, h / 2),
                            end = Offset(w, h / 2),
                            strokeWidth = 0.5.dp.toPx(),
                        )

                        // Draw the time-series line
                        if (velocityTrail.size >= 2) {
                            val path =
                                Path().apply {
                                    val firstValue = velocityTrail.first()
                                    // Map value from [0, yMax] to [h, 0] (inverted so max is at top)
                                    val firstY = h - (firstValue / yMax).coerceIn(0f, 1f) * h
                                    moveTo(0f, firstY)

                                    velocityTrail.forEachIndexed { index, value ->
                                        val x = (index.toFloat() / (velocityTrail.size - 1)) * w
                                        val y = h - (value / yMax).coerceIn(0f, 1f) * h
                                        lineTo(x, y)
                                    }
                                }
                            drawPath(
                                path = path,
                                color = lineColor,
                                style = Stroke(width = 2.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round),
                            )

                            // Draw current position dot
                            if (velocityTrail.isNotEmpty()) {
                                val lastValue = velocityTrail.last()
                                val lastX = w
                                val lastY = h - (lastValue / yMax).coerceIn(0f, 1f) * h
                                drawCircle(
                                    color = lineColor,
                                    radius = 5.dp.toPx(),
                                    center = Offset(lastX, lastY),
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun DpsiMetricsCard(
    dpsiMetrics: DpsiMetrics,
    mlsiTrail: List<Float>,
    apsiTrail: List<Float>,
    vsiTrail: List<Float>,
    dpsiTrail: List<Float>,
    showMlsi: Boolean,
    showApsi: Boolean,
    showVsi: Boolean,
    showDpsi: Boolean,
    onMlsiChange: (Boolean) -> Unit,
    onApsiChange: (Boolean) -> Unit,
    onVsiChange: (Boolean) -> Unit,
    onDpsiChange: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
) {
    // Calculate dynamic Y-axis range based on visible data
    val visibleTrails = mutableListOf<List<Float>>()
    if (showMlsi) visibleTrails.add(mlsiTrail)
    if (showApsi) visibleTrails.add(apsiTrail)
    if (showVsi) visibleTrails.add(vsiTrail)
    if (showDpsi) visibleTrails.add(dpsiTrail)

    val maxValue =
        if (visibleTrails.isNotEmpty()) {
            visibleTrails.flatten().maxOrNull()?.let { maxOf(it, 0.1f) } ?: 1f
        } else {
            1f
        }

    // Round up to nice number for display
    val yMax =
        when {
            maxValue <= 0.5f -> 0.5f
            maxValue <= 1f -> 1f
            maxValue <= 2f -> 2f
            maxValue <= 5f -> 5f
            else -> ((maxValue.toInt() / 5) + 1) * 5f
        }

    Card(
        modifier = modifier,
        shape = cardShape,
        colors = CardDefaults.cardColors(containerColor = CardBackground),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = stringResource(R.string.dpsi_metrics),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
            )

            Spacer(modifier = Modifier.height(8.dp))

            // Time-series plot
            Row(modifier = Modifier.fillMaxWidth()) {
                // Y-axis labels column
                Column(
                    modifier = Modifier.width(30.dp).height(120.dp),
                    verticalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(
                        text = "%.1f".format(yMax),
                        style = MaterialTheme.typography.labelSmall,
                        color = TextGray,
                    )
                    Text(
                        text = "%.1f".format(yMax / 2),
                        style = MaterialTheme.typography.labelSmall,
                        color = TextGray,
                    )
                    Text(
                        text = "0",
                        style = MaterialTheme.typography.labelSmall,
                        color = TextGray,
                    )
                }

                // Chart area
                Box(
                    modifier =
                        Modifier
                            .weight(1f)
                            .height(120.dp)
                            .border(1.dp, BorderGray, RoundedCornerShape(4.dp)),
                ) {
                    Canvas(modifier = Modifier.fillMaxSize().padding(4.dp)) {
                        val w = size.width
                        val h = size.height

                        // Draw horizontal grid lines
                        drawLine(
                            color = BorderGray.copy(alpha = 0.3f),
                            start = Offset(0f, h / 2),
                            end = Offset(w, h / 2),
                            strokeWidth = 0.5.dp.toPx(),
                        )

                        // Draw each enabled metric trail
                        if (showMlsi && mlsiTrail.size >= 2) {
                            drawMetricLine(mlsiTrail, ChartBlue, yMax, w, h)
                        }
                        if (showApsi && apsiTrail.size >= 2) {
                            drawMetricLine(apsiTrail, ChartRed, yMax, w, h)
                        }
                        if (showVsi && vsiTrail.size >= 2) {
                            drawMetricLine(vsiTrail, ChartGreen, yMax, w, h)
                        }
                        if (showDpsi && dpsiTrail.size >= 2) {
                            drawMetricLine(dpsiTrail, ChartOrange, yMax, w, h)
                        }

                        // Draw current position dots
                        if (showMlsi && mlsiTrail.isNotEmpty()) {
                            val y = h - (mlsiTrail.last() / yMax).coerceIn(0f, 1f) * h
                            drawCircle(ChartBlue, 5.dp.toPx(), Offset(w, y))
                        }
                        if (showApsi && apsiTrail.isNotEmpty()) {
                            val y = h - (apsiTrail.last() / yMax).coerceIn(0f, 1f) * h
                            drawCircle(ChartRed, 5.dp.toPx(), Offset(w, y))
                        }
                        if (showVsi && vsiTrail.isNotEmpty()) {
                            val y = h - (vsiTrail.last() / yMax).coerceIn(0f, 1f) * h
                            drawCircle(ChartGreen, 5.dp.toPx(), Offset(w, y))
                        }
                        if (showDpsi && dpsiTrail.isNotEmpty()) {
                            val y = h - (dpsiTrail.last() / yMax).coerceIn(0f, 1f) * h
                            drawCircle(ChartOrange, 5.dp.toPx(), Offset(w, y))
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Toggle checkboxes row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                DpsiToggleItem(
                    label = "MLSI",
                    checked = showMlsi,
                    onCheckedChange = onMlsiChange,
                    color = ChartBlue,
                )
                DpsiToggleItem(
                    label = "APSI",
                    checked = showApsi,
                    onCheckedChange = onApsiChange,
                    color = ChartRed,
                )
                DpsiToggleItem(
                    label = "VSI",
                    checked = showVsi,
                    onCheckedChange = onVsiChange,
                    color = ChartGreen,
                )
                DpsiToggleItem(
                    label = "DPSI",
                    checked = showDpsi,
                    onCheckedChange = onDpsiChange,
                    color = ChartOrange,
                )
            }
        }
    }
}

private fun androidx.compose.ui.graphics.drawscope.DrawScope.drawMetricLine(
    trail: List<Float>,
    color: Color,
    yMax: Float,
    w: Float,
    h: Float,
) {
    val path =
        Path().apply {
            val firstY = h - (trail.first() / yMax).coerceIn(0f, 1f) * h
            moveTo(0f, firstY)

            trail.forEachIndexed { index, value ->
                val x = (index.toFloat() / (trail.size - 1)) * w
                val y = h - (value / yMax).coerceIn(0f, 1f) * h
                lineTo(x, y)
            }
        }
    drawPath(
        path = path,
        color = color,
        style = Stroke(width = 2.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round),
    )
}

@Composable
private fun DpsiToggleItem(
    label: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    color: Color,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Checkbox(
            checked = checked,
            onCheckedChange = onCheckedChange,
            modifier = Modifier.size(20.dp),
            colors = CheckboxDefaults.colors(checkedColor = color),
        )
        Box(
            modifier =
                Modifier
                    .size(8.dp)
                    .background(color, CircleShape),
        )
        Spacer(modifier = Modifier.width(2.dp))
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
        )
    }
}

@Preview(showBackground = true)
@Composable
private fun SessionScreenPreview() {
    TheBalanceToolkitTheme {
        SessionScreenContent(
            uiState = SessionUiState(),
            onSliderChange = {},
            onConfidenceEllipseChange = {},
            onConvexHullChange = {},
            onMlSiChange = {},
            onApSiChange = {},
            onVsiChange = {},
            onDpsiChange = {},
            onFftXChange = {},
            onFftYChange = {},
            onFftCombinedChange = {},
            onToggleSession = {},
            onTare = {},
            canStartSession = true,
            onUserClick = {},
            onDevicesClick = {},
        )
    }
}
