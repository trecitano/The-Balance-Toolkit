package com.balancetoolkit.ui.components

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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ExitToApp
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
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
    showLinks: Boolean = false,
    onCiteClick: () -> Unit = {},
    onSourceCodeClick: () -> Unit = {},
) {
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .background(PrimaryRed)
                .padding(if (showWelcome) 24.dp else 16.dp)
                .semantics { contentDescription = "App header" },
    ) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = if (showWelcome) Alignment.CenterHorizontally else Alignment.Start,
        ) {
            // Logo and Title Row
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = if (showWelcome) Modifier.fillMaxWidth() else Modifier,
            ) {
                // Logo - white rounded square
                AppLogo(size = if (showWelcome) 40 else 32)

                Spacer(modifier = Modifier.width(12.dp))

                Text(
                    text = stringResource(R.string.app_title),
                    color = Color.White,
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Medium,
                )
            }

            if (showWelcome) {
                Spacer(modifier = Modifier.height(24.dp))

                Text(
                    text = stringResource(R.string.welcome),
                    color = Color.White,
                    style = MaterialTheme.typography.headlineLarge,
                    fontStyle = FontStyle.Italic,
                    fontWeight = FontWeight.Bold,
                )
            }

            if (showLinks) {
                Spacer(modifier = Modifier.height(16.dp))

                Row(
                    horizontalArrangement = Arrangement.Center,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    HeaderLinkButton(
                        text = stringResource(R.string.cite),
                        onClick = onCiteClick,
                    )

                    Spacer(modifier = Modifier.width(16.dp))

                    HeaderLinkButton(
                        text = stringResource(R.string.source_code),
                        onClick = onSourceCodeClick,
                    )
                }
            }
        }
    }
}

@Composable
private fun AppLogo(size: Int = 32) {
    Box(
        modifier =
            Modifier
                .size(size.dp)
                .clip(RoundedCornerShape(if (size > 32) 8.dp else 6.dp))
                .border(2.dp, Color.White, RoundedCornerShape(if (size > 32) 8.dp else 6.dp))
                .semantics { contentDescription = "Balance Toolkit logo" },
        contentAlignment = Alignment.Center,
    ) {
        // Empty white border square as logo placeholder
    }
}

@Composable
private fun HeaderLinkButton(
    text: String,
    onClick: () -> Unit,
) {
    TextButton(onClick = onClick) {
        Icon(
            imageVector = Icons.AutoMirrored.Filled.ExitToApp,
            contentDescription = null,
            tint = Color.White,
            modifier = Modifier.size(18.dp),
        )
        Spacer(modifier = Modifier.width(4.dp))
        Text(
            text = text,
            color = Color.White,
        )
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
        AppHeader(showWelcome = true, showLinks = true)
    }
}
