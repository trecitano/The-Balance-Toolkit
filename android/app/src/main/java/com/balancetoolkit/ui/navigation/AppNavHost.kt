package com.balancetoolkit.ui.navigation

import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
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
            val viewModel: HomeViewModel = hiltViewModel()
            HomeScreen(
                viewModel = viewModel,
                modifier = Modifier.padding(innerPadding),
                onNavigateToUsers = {
                    navController.navigate(AppDestination.Users.route) {
                        popUpTo(navController.graph.startDestinationId) {
                            saveState = false
                        }
                        launchSingleTop = true
                        restoreState = false
                    }
                },
                onNavigateToDevices = {
                    navController.navigate(AppDestination.Devices.route) {
                        popUpTo(navController.graph.startDestinationId) {
                            saveState = false
                        }
                        launchSingleTop = true
                        restoreState = false
                    }
                },
                onNavigateToSession = {
                    navController.navigate(AppDestination.Session.route) {
                        popUpTo(navController.graph.startDestinationId) {
                            saveState = false
                        }
                        launchSingleTop = true
                        restoreState = false
                    }
                },
            )
        }

        composable(AppDestination.Users.route) {
            val viewModel: UsersViewModel = hiltViewModel()
            val devicesViewModel: DevicesViewModel = hiltViewModel()
            UsersScreen(
                viewModel = viewModel,
                devicesViewModel = devicesViewModel,
                modifier = Modifier.padding(innerPadding),
            )
        }

        composable(AppDestination.Devices.route) {
            val viewModel: DevicesViewModel = hiltViewModel()
            DevicesScreen(
                viewModel = viewModel,
                onNavigateToHome = {
                    navController.navigate(AppDestination.Home.route) {
                        popUpTo(navController.graph.startDestinationId) {
                            saveState = false
                        }
                        launchSingleTop = true
                        restoreState = false
                    }
                },
                modifier = Modifier.padding(innerPadding),
            )
        }

        composable(AppDestination.Session.route) {
            val viewModel: SessionViewModel = hiltViewModel()
            SessionScreen(
                viewModel = viewModel,
                onNavigateToUsers = {
                    navController.navigate(AppDestination.Users.route) {
                        popUpTo(navController.graph.startDestinationId) {
                            saveState = false
                        }
                        launchSingleTop = true
                        restoreState = false
                    }
                },
                onNavigateToDevices = {
                    navController.navigate(AppDestination.Devices.route) {
                        popUpTo(navController.graph.startDestinationId) {
                            saveState = false
                        }
                        launchSingleTop = true
                        restoreState = false
                    }
                },
                modifier = Modifier.padding(innerPadding),
            )
        }

        composable(AppDestination.Settings.route) {
            val viewModel: SettingsViewModel = hiltViewModel()
            SettingsScreen(
                viewModel = viewModel,
                modifier = Modifier.padding(innerPadding),
            )
        }
    }
}
