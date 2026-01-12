package com.balancetoolkit.ui.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Settings
import androidx.compose.ui.graphics.vector.ImageVector

sealed class AppDestination(
    val route: String,
    val label: String,
    val icon: ImageVector,
) {
    data object Home : AppDestination(
        route = "home",
        label = "Home",
        icon = Icons.Default.Home,
    )

    data object Users : AppDestination(
        route = "users",
        label = "Users",
        icon = Icons.Default.Person,
    )

    data object Devices : AppDestination(
        route = "devices",
        label = "Devices",
        icon = Icons.Default.Phone,
    )

    data object Session : AppDestination(
        route = "session",
        label = "Session",
        icon = Icons.Default.Refresh,
    )

    data object Settings : AppDestination(
        route = "settings",
        label = "Settings",
        icon = Icons.Default.Settings,
    )

    companion object {
        val entries = listOf(Home, Users, Devices, Session, Settings)

        fun fromRoute(route: String?): AppDestination = entries.find { it.route == route } ?: Home
    }
}
