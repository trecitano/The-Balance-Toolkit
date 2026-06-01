package com.balancetoolkit

import android.os.Bundle
import android.view.KeyEvent
import android.view.MotionEvent
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalRippleConfiguration
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.NavigationRailItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.adaptive.navigationsuite.NavigationSuiteDefaults
import androidx.compose.material3.adaptive.navigationsuite.NavigationSuiteScaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.tooling.preview.Preview
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.balancetoolkit.ui.components.isBalanceBoardInput
import com.balancetoolkit.ui.navigation.AppDestination
import com.balancetoolkit.ui.navigation.AppNavHost
import com.balancetoolkit.ui.theme.TheBalanceToolkitTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge(
            statusBarStyle =
                SystemBarStyle.light(
                    scrim = android.graphics.Color.TRANSPARENT,
                    darkScrim = android.graphics.Color.TRANSPARENT,
                ),
        )
        setContent {
            TheBalanceToolkitTheme {
                TheBalanceToolkitApp()
            }
        }
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (isBalanceBoardInput(event.device)) return true
        return super.dispatchKeyEvent(event)
    }

    override fun dispatchGenericMotionEvent(event: MotionEvent): Boolean {
        if (isBalanceBoardInput(event.device)) return true
        return super.dispatchGenericMotionEvent(event)
    }
}

@Composable
fun TheBalanceToolkitApp() {
    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentDestination = navBackStackEntry?.destination
    val navSuiteItemColors =
        NavigationSuiteDefaults.itemColors(
            navigationBarItemColors =
                NavigationBarItemDefaults.colors(
                    indicatorColor = Color.Black,
                    selectedIconColor = Color.White,
                    selectedTextColor = Color.Black.copy(alpha = 0.7f),
                    unselectedIconColor = Color.Black.copy(alpha = 0.7f),
                    unselectedTextColor = Color.Black.copy(alpha = 0.7f),
                ),
            navigationRailItemColors =
                NavigationRailItemDefaults.colors(
                    indicatorColor = Color.Black,
                    selectedIconColor = Color.White,
                    selectedTextColor = Color.Black.copy(alpha = 0.7f),
                    unselectedIconColor = Color.Black.copy(alpha = 0.7f),
                    unselectedTextColor = Color.Black.copy(alpha = 0.7f),
                ),
        )

    CompositionLocalProvider(LocalRippleConfiguration provides null) {
    NavigationSuiteScaffold(
        navigationSuiteItems = {
            AppDestination.entries.forEach { destination ->
                val selected =
                    currentDestination?.hierarchy?.any {
                        it.route == destination.route
                    } == true

                item(
                    icon = {
                        Icon(
                            painter = painterResource(destination.icon),
                            contentDescription = destination.label,
                        )
                    },
                    label = { Text(destination.label) },
                    colors = navSuiteItemColors,
                    selected = selected,
                    onClick = {
                        // Skip navigation if already on this destination
                        if (selected) return@item

                        navController.navigate(destination.route) {
                            // Pop up to the start destination to avoid building up a large stack
                            popUpTo(navController.graph.startDestinationId) {
                                saveState = true
                            }
                            // Avoid multiple copies of the same destination
                            launchSingleTop = true
                            // Restore destination state when switching tabs
                            restoreState = true
                        }
                    },
                )
            }
        },
    ) {
        Scaffold(modifier = Modifier.fillMaxSize()) { innerPadding ->
            AppNavHost(
                navController = navController,
                innerPadding = innerPadding,
            )
        }
    }
    }
}

@Preview(showBackground = true)
@Composable
private fun TheBalanceToolkitAppPreview() {
    TheBalanceToolkitTheme {
        TheBalanceToolkitApp()
    }
}
