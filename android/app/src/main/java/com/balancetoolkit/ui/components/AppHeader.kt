package com.balancetoolkit.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.balancetoolkit.R
import com.balancetoolkit.ui.theme.PrimaryRed
import com.balancetoolkit.ui.theme.TheBalanceToolkitTheme

@Composable
fun AppHeader(
    modifier: Modifier = Modifier,
    showWelcome: Boolean = false,
) {
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .background(PrimaryRed)
                .padding(horizontal = 16.dp, vertical = if (showWelcome) 12.dp else 8.dp)
                .semantics { contentDescription = "App header" },
    ) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                text = stringResource(R.string.app_title),
                color = Color.White,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Medium,
            )

            if (showWelcome) {
                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    text = stringResource(R.string.welcome),
                    color = Color.White,
                    style = MaterialTheme.typography.titleLarge,
                    fontStyle = FontStyle.Italic,
                    fontWeight = FontWeight.Bold,
                )
            }
        }
    }
}

@Preview
@Composable
private fun AppHeaderSimplePreview() {
    TheBalanceToolkitTheme {
        AppHeader()
    }
}

@Preview
@Composable
private fun AppHeaderWithWelcomePreview() {
    TheBalanceToolkitTheme {
        AppHeader(showWelcome = true)
    }
}
