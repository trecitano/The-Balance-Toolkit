package com.balancetoolkit.bluetooth

import javax.inject.Inject
import javax.inject.Singleton

/**
 * Manages MockBalanceBoardConnection lifecycle.
 * Can be shared across ViewModels that need mock board functionality.
 */
@Singleton
class MockConnectionManager @Inject constructor() {
    private var connection: MockBalanceBoardConnection? = null
    private var currentListener: BalanceBoardListener? = null

    val isRunning: Boolean
        get() = connection != null

    /**
     * Start a mock connection with the given listener.
     * If already running with a different listener, stops and restarts.
     */
    fun start(listener: BalanceBoardListener) {
        if (connection != null && currentListener === listener) {
            return
        }

        stop()
        currentListener = listener
        connection = MockBalanceBoardConnection(listener).also {
            it.start()
        }
    }

    /**
     * Stop the current mock connection.
     */
    fun stop() {
        connection?.stop()
        connection = null
        currentListener = null
    }

    /**
     * Request a tare (zero) on the mock connection.
     */
    fun tare() {
        connection?.tare()
    }
}

/**
 * Simple listener that only cares about weight data.
 */
open class SimpleWeightListener(
    private val onWeight: (Float) -> Unit,
) : BalanceBoardListener {
    override fun onLog(message: String) {
        // Default: ignore logs
    }

    override fun onWeightData(topLeft: Float, topRight: Float, bottomLeft: Float, bottomRight: Float) {
        val totalWeight = topLeft + topRight + bottomLeft + bottomRight
        onWeight(totalWeight)
    }

    override fun onError(message: String) {
        // Default: ignore errors
    }
}

/**
 * Listener that captures full sensor data.
 */
open class FullDataListener(
    private val onData: (topLeft: Float, topRight: Float, bottomLeft: Float, bottomRight: Float) -> Unit,
    private val onLogMessage: (String) -> Unit = {},
    private val onErrorMessage: (String) -> Unit = {},
) : BalanceBoardListener {
    override fun onLog(message: String) {
        onLogMessage(message)
    }

    override fun onWeightData(topLeft: Float, topRight: Float, bottomLeft: Float, bottomRight: Float) {
        onData(topLeft, topRight, bottomLeft, bottomRight)
    }

    override fun onError(message: String) {
        onErrorMessage(message)
    }
}
