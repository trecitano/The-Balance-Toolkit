package com.balancetoolkit

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Icon
import androidx.compose.ui.res.painterResource
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.adaptive.navigationsuite.NavigationSuiteScaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.balancetoolkit.ui.navigation.AppDestination
import com.balancetoolkit.ui.navigation.AppNavHost
import com.balancetoolkit.ui.theme.TheBalanceToolkitTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            TheBalanceToolkitTheme {
                TheBalanceToolkitApp()
            }
        }
    }
}

@Composable
fun TheBalanceToolkitApp() {
    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentDestination = navBackStackEntry?.destination

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
                    selected = selected,
                    onClick = {
                        // Skip navigation if already on this destination
                        if (selected) return@item

                        navController.navigate(destination.route) {
                            // Pop up to the start destination to avoid building up a large stack
                            popUpTo(navController.graph.startDestinationId) {
                                saveState = false
                            }
                            // Avoid multiple copies of the same destination
                            launchSingleTop = true
                            // Don't restore state - causes issues with ViewModel state mismatch
                            restoreState = false
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

@Preview(showBackground = true)
@Composable
private fun TheBalanceToolkitAppPreview() {
    TheBalanceToolkitTheme {
        TheBalanceToolkitApp()
    }
}
