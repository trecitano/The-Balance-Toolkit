package com.balancetoolkit.ui.navigation

import android.content.Context
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.balancetoolkit.BalanceToolkitApplication
import com.balancetoolkit.ui.screens.devices.DevicesScreen
import com.balancetoolkit.ui.screens.home.HomeScreen
import com.balancetoolkit.ui.screens.session.SessionScreen
import com.balancetoolkit.ui.screens.settings.SettingsScreen
import com.balancetoolkit.ui.screens.users.UsersScreen
import com.balancetoolkit.viewmodel.DevicesViewModel
import com.balancetoolkit.viewmodel.HomeViewModel
import com.balancetoolkit.viewmodel.SessionViewModel
import com.balancetoolkit.viewmodel.SettingsViewModel
import com.balancetoolkit.viewmodel.UsersViewModel

@Composable
fun AppNavHost(
    navController: NavHostController,
    innerPadding: PaddingValues,
    modifier: Modifier = Modifier,
) {
    val application = LocalContext.current.applicationContext as BalanceToolkitApplication
    val database = application.database
    val sharedPreferences = application.getSharedPreferences(
        "balance_toolkit_prefs",
        Context.MODE_PRIVATE
    )

    NavHost(
        navController = navController,
        startDestination = AppDestination.Home.route,
        modifier = modifier,
        enterTransition = { EnterTransition.None },
        exitTransition = { ExitTransition.None },
        popEnterTransition = { EnterTransition.None },
        popExitTransition = { ExitTransition.None },
    ) {
        composable(AppDestination.Home.route) {
            val viewModel: HomeViewModel = viewModel(
                factory = HomeViewModel.Factory(
                    database.userDao(),
                    database.deviceDao(),
                    sharedPreferences
                ),
            )
            HomeScreen(
                viewModel = viewModel,
                modifier = Modifier.padding(innerPadding),
                onNavigateToUsers = {
                    navController.navigate(AppDestination.Users.route) {
                        popUpTo(navController.graph.startDestinationId) {
                            saveState = true
                        }
                        launchSingleTop = true
                        restoreState = true
                    }
                },
                onNavigateToDevices = {
                    navController.navigate(AppDestination.Devices.route) {
                        popUpTo(navController.graph.startDestinationId) {
                            saveState = true
                        }
                        launchSingleTop = true
                        restoreState = true
                    }
                },
                onNavigateToSession = {
                    navController.navigate(AppDestination.Session.route) {
                        popUpTo(navController.graph.startDestinationId) {
                            saveState = true
                        }
                        launchSingleTop = true
                        restoreState = true
                    }
                },
            )
        }

        composable(AppDestination.Users.route) {
            val viewModel: UsersViewModel =
                viewModel(
                    factory = UsersViewModel.Factory(database.userDao(), sharedPreferences),
                )
            UsersScreen(
                viewModel = viewModel,
                modifier = Modifier.padding(innerPadding),
            )
        }

        composable(AppDestination.Devices.route) {
            val viewModel: DevicesViewModel =
                viewModel(
                    factory = DevicesViewModel.Factory(database.deviceDao(), sharedPreferences),
                )
            DevicesScreen(
                viewModel = viewModel,
                modifier = Modifier.padding(innerPadding),
            )
        }

        composable(AppDestination.Session.route) {
            val viewModel: SessionViewModel = viewModel(
                factory = SessionViewModel.Factory(
                    application,
                    sharedPreferences,
                    database.userDao(),
                    database.deviceDao(),
                ),
            )
            SessionScreen(
                viewModel = viewModel,
                modifier = Modifier.padding(innerPadding),
            )
        }

        composable(AppDestination.Settings.route) {
            val viewModel: SettingsViewModel = viewModel(
                factory = SettingsViewModel.Factory(sharedPreferences, application),
            )
            SettingsScreen(
                viewModel = viewModel,
                modifier = Modifier.padding(innerPadding),
            )
        }
    }
}
