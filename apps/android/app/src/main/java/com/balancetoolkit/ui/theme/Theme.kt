package com.balancetoolkit.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext

@Composable
fun TheBalanceToolkitTheme(content: @Composable () -> Unit) {
    // Always use light theme - dark mode is not supported
    val colorScheme = dynamicLightColorScheme(LocalContext.current)

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content,
    )
}
