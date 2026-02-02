package com.balancetoolkit.ui.navigation

import androidx.annotation.DrawableRes
import com.balancetoolkit.R

sealed class AppDestination(
    val route: String,
    val label: String,
    @param:DrawableRes val icon: Int,
) {
    data object Home : AppDestination(
        route = "home",
        label = "Home",
        icon = R.drawable.home_24,
    )

    data object Users : AppDestination(
        route = "users",
        label = "Users",
        icon = R.drawable.group_24,
    )

    data object Devices : AppDestination(
        route = "devices",
        label = "Devices",
        icon = R.drawable.monitor_24,
    )

    data object Session : AppDestination(
        route = "session",
        label = "Session",
        icon = R.drawable.bar_chart_4_bars_24,
    )

    data object Settings : AppDestination(
        route = "settings",
        label = "Settings",
        icon = R.drawable.settings_24,
    )

    companion object {
        val entries = listOf(Home, Users, Devices, Session, Settings)

        fun fromRoute(route: String?): AppDestination = entries.find { it.route == route } ?: Home
    }
}
