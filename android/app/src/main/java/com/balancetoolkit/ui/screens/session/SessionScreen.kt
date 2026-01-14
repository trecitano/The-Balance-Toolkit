package com.balancetoolkit.ui.screens.session

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import com.balancetoolkit.R
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
import com.balancetoolkit.viewmodel.CopPosition
import com.balancetoolkit.viewmodel.SessionUiState
import com.balancetoolkit.viewmodel.SessionViewModel

private val cardShape = RoundedCornerShape(12.dp)

@Composable
fun SessionScreen(
    viewModel: SessionViewModel,
    modifier: Modifier = Modifier,
) {
    val uiState by viewModel.uiState.collectAsState()

    SessionScreenContent(
        uiState = uiState,
        onSliderChange = viewModel::updateSliderPosition,
        onConfidenceEllipseChange = viewModel::setConfidenceEllipse,
        onConvexHullChange = viewModel::setConvexHull,
        onMlSiChange = viewModel::setMlSi,
        onApSiChange = viewModel::setApSi,
        onVsiChange = viewModel::setVsi,
        onDpsiChange = viewModel::setDpsi,
        onToggleSession = viewModel::togglePlay,
        onTare = viewModel::applyTare,
        canStartSession = uiState.canStartSession,
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
    onToggleSession: () -> Unit,
    onTare: () -> Unit,
    canStartSession: Boolean,
    modifier: Modifier = Modifier,
) {
    TrackPerformance("SessionScreen")
    val scrollState = rememberScrollState()

    Column(
        modifier =
            modifier
                .fillMaxSize()
                .background(BackgroundGray),
    ) {
        AppHeader()

        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .verticalScroll(scrollState)
                    .padding(16.dp),
        ) {
            SessionDeviceCard(
                deviceName = uiState.deviceName,
                macAddress = uiState.deviceMacAddress,
                isMockMode = uiState.isMockMode,
            )

            // Session control buttons
            SessionControlCard(
                isRecording = uiState.isRecording,
                onToggleSession = onToggleSession,
                onTare = onTare,
                canStartSession = canStartSession,
            )

            Spacer(modifier = Modifier.height(16.dp))

            COPVisualizationCard(
                currentCop = uiState.currentCop,
                copTrail = uiState.copTrail,
                showConfidenceEllipse = uiState.showConfidenceEllipse,
                onConfidenceEllipseChange = onConfidenceEllipseChange,
                showConvexHull = uiState.showConvexHull,
                onConvexHullChange = onConvexHullChange,
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Stability and Left cards row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                StabilityCard(
                    force = uiState.stabilityMetrics.force,
                    isRecording = uiState.isRecording,
                    onToggleSession = onToggleSession,
                    canStartSession = canStartSession,
                    modifier = Modifier.weight(1f),
                )
                DirectionCard(
                    title = stringResource(R.string.left_direction, uiState.leftValue),
                    modifier = Modifier.weight(1f),
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Right and Front cards row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                DirectionCard(
                    title = stringResource(R.string.right_direction, uiState.rightValue),
                    modifier = Modifier.weight(1f),
                )
                DirectionCard(
                    title = stringResource(R.string.front_direction, uiState.frontValue),
                    modifier = Modifier.weight(1f),
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            FFTChartCard(
                mlSi = uiState.showMlSi,
                onMlSiChange = onMlSiChange,
                apSi = uiState.showApSi,
                onApSiChange = onApSiChange,
                vsi = uiState.showVsi,
                onVsiChange = onVsiChange,
                dpsi = uiState.showDpsi,
                onDpsiChange = onDpsiChange,
            )

            Spacer(modifier = Modifier.height(16.dp))

            // DPSI Metrics and vCopM row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                MetricsCard(
                    title = stringResource(R.string.dpsi_metrics),
                    modifier = Modifier.weight(1f),
                )
                MetricsCard(
                    title = stringResource(R.string.vcop_m),
                    modifier = Modifier.weight(1f),
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            MetricsCard(
                title = stringResource(R.string.vcop_y),
                modifier = Modifier.fillMaxWidth(0.5f),
            )

            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}

@Composable
private fun SessionDeviceCard(
    deviceName: String,
    macAddress: String,
    isMockMode: Boolean,
) {
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
            Column {
                Text(
                    text = deviceName,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Medium,
                )
                if (isMockMode) {
                    Text(
                        text = "Mock Mode",
                        style = MaterialTheme.typography.bodySmall,
                        color = ChartOrange,
                    )
                }
            }
            Text(
                text = macAddress,
                style = MaterialTheme.typography.bodySmall,
                color = TextGray,
            )
        }
    }
}

@Composable
private fun SessionControlCard(
    isRecording: Boolean,
    onToggleSession: () -> Unit,
    onTare: () -> Unit,
    canStartSession: Boolean,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = cardShape,
        colors = CardDefaults.cardColors(containerColor = CardBackground),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(4.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Button(
                onClick = onToggleSession,
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (isRecording) PrimaryRed else PrimaryBlue
                ),
                modifier = Modifier.weight(1f),
                enabled = isRecording || canStartSession,
            ) {
                Text(
                    text = if (isRecording) "Stop Session" else "Start Session",
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
                    contentDescription = "Tare",
                    modifier = Modifier.size(20.dp),
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text("Tare")
            }
        }
    }
}

@Composable
private fun COPVisualizationCard(
    currentCop: CopPosition,
    copTrail: List<CopPosition>,
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
                Canvas(
                    modifier = Modifier.fillMaxSize().padding(4.dp)
                ) {
                    val centerX = size.width / 2
                    val centerY = size.height / 2

                    // Scale factors to convert mm to pixels
                    // Board is approximately 433mm x 228mm between sensors
                    // We want to fit this in our canvas with some margin
                    val scaleX = size.width * 0.8f / 433f
                    val scaleY = size.height * 0.8f / 228f
                    val scale = minOf(scaleX, scaleY)

                    // Draw crosshair lines
                    drawLine(
                        color = crosshairColor,
                        start = Offset(centerX, 0f),
                        end = Offset(centerX, size.height),
                        strokeWidth = 1.dp.toPx()
                    )
                    drawLine(
                        color = crosshairColor,
                        start = Offset(0f, centerY),
                        end = Offset(size.width, centerY),
                        strokeWidth = 1.dp.toPx()
                    )

                    // Draw convex hull of trail points if enabled
                    if (showConvexHull && copTrail.size >= 3) {
                        val hull = computeConvexHull(copTrail)
                        if (hull.size >= 3) {
                            val hullPath = Path().apply {
                                val firstPoint = hull.first()
                                moveTo(
                                    centerX + firstPoint.x * scale,
                                    centerY - firstPoint.y * scale // Invert Y for screen coords
                                )
                                hull.drop(1).forEach { point ->
                                    lineTo(
                                        centerX + point.x * scale,
                                        centerY - point.y * scale
                                    )
                                }
                                close()
                            }
                            drawPath(hullPath, color = hullColor)
                            drawPath(hullPath, color = hullStrokeColor, style = Stroke(width = 2.dp.toPx()))
                        }
                    }

                    // Draw CoP trail
                    if (copTrail.size >= 2) {
                        val trailPath = Path().apply {
                            val firstPoint = copTrail.first()
                            moveTo(
                                centerX + firstPoint.x * scale,
                                centerY - firstPoint.y * scale
                            )
                            copTrail.drop(1).forEach { point ->
                                lineTo(
                                    centerX + point.x * scale,
                                    centerY - point.y * scale
                                )
                            }
                        }
                        drawPath(trailPath, color = trailColor, style = Stroke(width = 2.dp.toPx()))
                    }

                    // Draw current CoP position
                    val copScreenX = centerX + currentCop.x * scale
                    val copScreenY = centerY - currentCop.y * scale // Invert Y for screen coords
                    drawCircle(
                        color = copDotColor,
                        radius = 6.dp.toPx(),
                        center = Offset(copScreenX, copScreenY)
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // CoP coordinates display
            Text(
                text = "CoP: X=%.1f mm, Y=%.1f mm".format(currentCop.x, currentCop.y),
                style = MaterialTheme.typography.bodySmall,
                color = TextGray,
            )

            Spacer(modifier = Modifier.height(8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Start,
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(
                        checked = showConvexHull,
                        onCheckedChange = onConvexHullChange,
                        colors = CheckboxDefaults.colors(checkedColor = SecondaryPurple),
                    )
                    Text(stringResource(R.string.convex_hull), style = MaterialTheme.typography.bodySmall)
                }
            }
        }
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
    val sorted = points.filter { it != start }.sortedWith { a, b ->
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

private fun cross(o: CopPosition, a: CopPosition, b: CopPosition): Float {
    return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
}

@Composable
private fun StabilityCard(
    force: Float,
    isRecording: Boolean,
    onToggleSession: () -> Unit,
    canStartSession: Boolean,
    modifier: Modifier = Modifier,
) {
    val isEnabled = isRecording || canStartSession
    Card(
        modifier = modifier.semantics { contentDescription = "Stability: Force $force kg" },
        shape = cardShape,
        colors = CardDefaults.cardColors(containerColor = CardBackground),
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                text = stringResource(R.string.stability),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.align(Alignment.Start),
            )

            Spacer(modifier = Modifier.height(16.dp))

            Box(
                modifier =
                    Modifier
                        .size(56.dp)
                        .background(
                            when {
                                !isEnabled -> BorderGray
                                isRecording -> ChartGreen
                                else -> PrimaryRed
                            },
                            CircleShape
                        )
                        .then(if (isEnabled) Modifier.clickable { onToggleSession() } else Modifier),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = Icons.Default.PlayArrow,
                    contentDescription = stringResource(R.string.play),
                    tint = Color.White,
                    modifier = Modifier.size(32.dp),
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            Text(
                text = stringResource(R.string.force_kg),
                style = MaterialTheme.typography.bodySmall,
                color = TextGray,
            )
            Text(
                text = String.format("%.2f", force),
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                color = if (force > 0) PrimaryBlue else PrimaryRed,
            )
        }
    }
}

@Composable
private fun DirectionCard(
    title: String,
    modifier: Modifier = Modifier,
) {
    Card(
        modifier = modifier,
        shape = cardShape,
        colors = CardDefaults.cardColors(containerColor = CardBackground),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
            )

            Spacer(modifier = Modifier.height(12.dp))

            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .height(60.dp),
            ) {
                Box(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .height(1.dp)
                            .align(Alignment.Center)
                            .background(BorderGray),
                )
                Box(
                    modifier =
                        Modifier
                            .fillMaxWidth(0.8f)
                            .height(2.dp)
                            .align(Alignment.CenterStart)
                            .padding(start = 8.dp)
                            .background(ChartBlue),
                )
                Box(
                    modifier =
                        Modifier
                            .size(8.dp)
                            .align(Alignment.CenterEnd)
                            .padding(end = 20.dp)
                            .background(PrimaryRed, CircleShape),
                )
            }
        }
    }
}

@Composable
private fun FFTChartCard(
    mlSi: Boolean,
    onMlSiChange: (Boolean) -> Unit,
    apSi: Boolean,
    onApSiChange: (Boolean) -> Unit,
    vsi: Boolean,
    onVsiChange: (Boolean) -> Unit,
    dpsi: Boolean,
    onDpsiChange: (Boolean) -> Unit,
) {
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

            Spacer(modifier = Modifier.height(12.dp))

            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .height(120.dp)
                        .border(1.dp, BorderGray, RoundedCornerShape(4.dp))
                        .padding(8.dp),
            ) {
                Text(
                    text = stringResource(R.string.amplitude),
                    style = MaterialTheme.typography.labelSmall,
                    color = TextGray,
                    modifier =
                        Modifier
                            .align(Alignment.CenterStart)
                            .padding(start = 4.dp),
                )

                Column(
                    modifier =
                        Modifier
                            .fillMaxSize()
                            .padding(start = 40.dp, end = 8.dp, top = 8.dp, bottom = 20.dp),
                    verticalArrangement = Arrangement.Center,
                ) {
                    Box(
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .height(2.dp)
                                .background(ChartOrange),
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Box(
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .height(2.dp)
                                .background(ChartGreen),
                    )
                }

                Text(
                    text = stringResource(R.string.frequency_hz),
                    style = MaterialTheme.typography.labelSmall,
                    color = TextGray,
                    modifier =
                        Modifier
                            .align(Alignment.BottomCenter)
                            .padding(bottom = 2.dp),
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Legend row 1
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Start,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(modifier = Modifier.size(12.dp).background(ChartYellow))
                Text(" X  ", style = MaterialTheme.typography.labelSmall)

                Box(modifier = Modifier.size(12.dp).background(ChartRed))
                Text(" Y  ", style = MaterialTheme.typography.labelSmall)

                Box(modifier = Modifier.size(12.dp).background(ChartGreen))
                Text(" Combined  ", style = MaterialTheme.typography.labelSmall)

                Checkbox(
                    checked = mlSi,
                    onCheckedChange = onMlSiChange,
                    modifier = Modifier.size(20.dp),
                    colors = CheckboxDefaults.colors(checkedColor = PrimaryBlue),
                )
                Text("ML SI ", style = MaterialTheme.typography.labelSmall)

                Checkbox(
                    checked = apSi,
                    onCheckedChange = onApSiChange,
                    modifier = Modifier.size(20.dp),
                    colors = CheckboxDefaults.colors(checkedColor = PrimaryBlue),
                )
                Text("AP SI ", style = MaterialTheme.typography.labelSmall)

                Checkbox(
                    checked = vsi,
                    onCheckedChange = onVsiChange,
                    modifier = Modifier.size(20.dp),
                    colors = CheckboxDefaults.colors(checkedColor = PrimaryBlue),
                )
                Text("VSI", style = MaterialTheme.typography.labelSmall)
            }

            Row(verticalAlignment = Alignment.CenterVertically) {
                Checkbox(
                    checked = dpsi,
                    onCheckedChange = onDpsiChange,
                    modifier = Modifier.size(20.dp),
                    colors = CheckboxDefaults.colors(checkedColor = PrimaryBlue),
                )
                Text("DPSI", style = MaterialTheme.typography.labelSmall)
            }
        }
    }
}

@Composable
private fun MetricsCard(
    title: String,
    modifier: Modifier = Modifier,
) {
    Card(
        modifier = modifier,
        shape = cardShape,
        colors = CardDefaults.cardColors(containerColor = CardBackground),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
            )

            Spacer(modifier = Modifier.height(12.dp))

            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .height(60.dp),
            ) {
                Row(
                    modifier = Modifier.fillMaxSize(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(
                        modifier =
                            Modifier
                                .weight(1f)
                                .height(2.dp)
                                .background(ChartBlue),
                    )
                    Box(
                        modifier =
                            Modifier
                                .size(6.dp)
                                .background(PrimaryRed, CircleShape),
                    )
                    Box(
                        modifier =
                            Modifier
                                .weight(1f)
                                .height(2.dp)
                                .background(ChartBlue),
                    )
                }
            }
        }
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
            onToggleSession = {},
            onTare = {},
            canStartSession = true,
        )
    }
}
