package com.balancetoolkit.util

import android.util.Log
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember

/**
 * Performance tracking utilities based on Compose best practices.
 * Tracks both initial composition time and recomposition counts.
 *
 * Set [DEBUG_PERFORMANCE] to false for production builds to disable logging.
 */

private const val TAG = "ComposePerformance"
private const val FRAME_BUDGET_MS = 16.0 // 60fps threshold

// Set to false in production builds
private const val DEBUG_PERFORMANCE = true

/**
 * Track frame render time (composition phase).
 * Only logs when DEBUG_PERFORMANCE is true.
 */
@Composable
fun TrackScreenLoadTime(screenName: String) {
    if (!DEBUG_PERFORMANCE) return

    val startTime = remember { System.nanoTime() }

    SideEffect {
        val endTime = System.nanoTime()
        val frameTimeMs = (endTime - startTime) / 1_000_000.0
        Log.d(TAG, "$screenName frame render time: %.2f ms".format(frameTimeMs))

        if (frameTimeMs > FRAME_BUDGET_MS) {
            Log.w(TAG, "$screenName exceeded ${FRAME_BUDGET_MS}ms frame budget!")
        }
    }
}

/**
 * Track recomposition count for a composable.
 * Only logs when DEBUG_PERFORMANCE is true.
 */
@Composable
fun RecompositionCounter(screenName: String) {
    if (!DEBUG_PERFORMANCE) return

    val recomposeCount = remember { mutableIntStateOf(0) }

    SideEffect {
        recomposeCount.intValue++
        Log.d(TAG, "$screenName recomposed: ${recomposeCount.intValue} times")
    }
}

/**
 * Combined tracking: frame time + recomposition count.
 * Only active when DEBUG_PERFORMANCE is true.
 */
@Composable
fun TrackPerformance(screenName: String) {
    if (!DEBUG_PERFORMANCE) return

    val startTime = remember { System.nanoTime() }
    val recomposeCount = remember { mutableIntStateOf(0) }
    val isFirstComposition = remember { mutableStateOf(true) }

    SideEffect {
        recomposeCount.intValue++
        val endTime = System.nanoTime()
        val frameTimeMs = (endTime - startTime) / 1_000_000.0

        if (isFirstComposition.value) {
            Log.d(TAG, "$screenName initial composition: %.2f ms".format(frameTimeMs))
            isFirstComposition.value = false
        } else {
            Log.d(TAG, "$screenName recomposition #${recomposeCount.intValue}: %.2f ms".format(frameTimeMs))
        }

        if (frameTimeMs > FRAME_BUDGET_MS) {
            Log.w(TAG, "$screenName exceeded ${FRAME_BUDGET_MS}ms frame budget (%.2f ms)!".format(frameTimeMs))
        }
    }
}
