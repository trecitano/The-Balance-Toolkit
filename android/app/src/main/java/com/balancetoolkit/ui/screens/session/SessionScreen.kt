package com.balancetoolkit.ui.screens.session

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
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
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
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
import com.balancetoolkit.viewmodel.SessionUiState
import com.balancetoolkit.viewmodel.SessionViewModel

private val cardShape = RoundedCornerShape(12.dp)
private val timelineCardColor = Color(0xFFEEEEEE)

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
            // Loop info row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    text = stringResource(R.string.loop_info, uiState.currentLoop, uiState.totalLoops),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    text = uiState.currentTime,
                    style = MaterialTheme.typography.bodyMedium,
                    color = TextGray,
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            TimelineCard(
                sliderPosition = uiState.sliderPosition,
                startTime = uiState.startTime,
                endTime = uiState.endTime,
                onSliderChange = onSliderChange,
            )

            Spacer(modifier = Modifier.height(16.dp))

            SessionDeviceCard(
                deviceName = uiState.deviceName,
                macAddress = uiState.deviceMacAddress,
            )

            Spacer(modifier = Modifier.height(16.dp))

            COPVisualizationCard(
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
private fun TimelineCard(
    sliderPosition: Float,
    startTime: Float,
    endTime: Float,
    onSliderChange: (Float) -> Unit,
) {
    Card(
        modifier =
            Modifier
                .fillMaxWidth()
                .semantics { contentDescription = "Timeline slider" },
        shape = cardShape,
        colors = CardDefaults.cardColors(containerColor = timelineCardColor),
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .height(40.dp)
                        .background(BorderGray, RoundedCornerShape(4.dp)),
            ) {
                Box(
                    modifier =
                        Modifier
                            .fillMaxHeight()
                            .width(2.dp)
                            .align(Alignment.CenterStart)
                            .padding(start = (sliderPosition * 300).dp)
                            .background(PrimaryRed),
                )
            }

            Spacer(modifier = Modifier.height(4.dp))

            Slider(
                value = sliderPosition,
                onValueChange = onSliderChange,
                modifier = Modifier.fillMaxWidth(),
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text("${startTime}s", style = MaterialTheme.typography.bodySmall, color = TextGray)
                Text("${endTime.toInt()}s", style = MaterialTheme.typography.bodySmall, color = TextGray)
            }
        }
    }
}

@Composable
private fun SessionDeviceCard(
    deviceName: String,
    macAddress: String,
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
            Text(
                text = deviceName,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Medium,
            )
            Text(
                text = macAddress,
                style = MaterialTheme.typography.bodySmall,
                color = TextGray,
            )
        }
    }
}

@Composable
private fun COPVisualizationCard(
    showConfidenceEllipse: Boolean,
    onConfidenceEllipseChange: (Boolean) -> Unit,
    showConvexHull: Boolean,
    onConvexHullChange: (Boolean) -> Unit,
) {
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
                        .border(1.dp, BorderGray, RoundedCornerShape(8.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Box(modifier = Modifier.size(150.dp)) {
                    if (showConfidenceEllipse) {
                        Box(
                            modifier =
                                Modifier
                                    .size(120.dp)
                                    .align(Alignment.Center)
                                    .border(2.dp, ChartRed.copy(alpha = 0.7f), CircleShape),
                        )
                    }
                    if (showConvexHull) {
                        Box(
                            modifier =
                                Modifier
                                    .size(80.dp)
                                    .align(Alignment.Center)
                                    .background(ChartBlue.copy(alpha = 0.2f), RoundedCornerShape(30.dp))
                                    .border(2.dp, ChartBlue, RoundedCornerShape(30.dp)),
                        )
                    }
                    Box(
                        modifier =
                            Modifier
                                .size(8.dp)
                                .align(Alignment.Center)
                                .background(SecondaryPurple, CircleShape),
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Start,
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(
                        checked = showConfidenceEllipse,
                        onCheckedChange = onConfidenceEllipseChange,
                        colors = CheckboxDefaults.colors(checkedColor = PrimaryBlue),
                    )
                    Text(stringResource(R.string.confidence_ellipse), style = MaterialTheme.typography.bodySmall)
                }
                Spacer(modifier = Modifier.width(8.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(
                        checked = showConvexHull,
                        onCheckedChange = onConvexHullChange,
                        colors = CheckboxDefaults.colors(checkedColor = PrimaryBlue),
                    )
                    Text(stringResource(R.string.convex_hull), style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}

@Composable
private fun StabilityCard(
    force: Float,
    modifier: Modifier = Modifier,
) {
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
                        .background(PrimaryRed, CircleShape),
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
                color = PrimaryRed,
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
        )
    }
}
