package com.balancetoolkit.ui.screens.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.balancetoolkit.R
import com.balancetoolkit.ui.components.AppHeader
import com.balancetoolkit.ui.theme.BackgroundGray
import com.balancetoolkit.ui.theme.TheBalanceToolkitTheme

@Composable
fun SettingsScreen(modifier: Modifier = Modifier) {
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
                    .fillMaxSize()
                    .padding(16.dp),
        ) {
            Text(
                text = stringResource(R.string.settings),
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
            )

            // TODO: Add settings options
        }
    }
}

@Preview(showBackground = true)
@Composable
private fun SettingsScreenPreview() {
    TheBalanceToolkitTheme {
        SettingsScreen()
    }
}
