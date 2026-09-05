package com.balancetoolkit.bluetooth

/**
 * Common listener interface for balance board connections.
 * Both mock and real HID connections implement this interface.
 */
interface BalanceBoardListener {
    fun onLog(message: String)

    fun onWeightData(
        topLeft: Float,
        topRight: Float,
        bottomLeft: Float,
        bottomRight: Float,
    )

    fun onError(message: String)
}

/**
 * Simple listener that only cares about total weight data.
 */
open class SimpleWeightListener(
    private val onWeight: (Float) -> Unit,
) : BalanceBoardListener {
    override fun onLog(message: String) {
        // Default: ignore logs
    }

    override fun onWeightData(
        topLeft: Float,
        topRight: Float,
        bottomLeft: Float,
        bottomRight: Float,
    ) {
        val totalWeight = topLeft + topRight + bottomLeft + bottomRight
        onWeight(totalWeight)
    }

    override fun onError(message: String) {
        // Default: ignore errors
    }
}

/**
 * Listener that captures full sensor data from all four corners.
 */
open class FullDataListener(
    private val onData: (topLeft: Float, topRight: Float, bottomLeft: Float, bottomRight: Float) -> Unit,
    private val onLogMessage: (String) -> Unit = {},
    private val onErrorMessage: (String) -> Unit = {},
) : BalanceBoardListener {
    override fun onLog(message: String) {
        onLogMessage(message)
    }

    override fun onWeightData(
        topLeft: Float,
        topRight: Float,
        bottomLeft: Float,
        bottomRight: Float,
    ) {
        onData(topLeft, topRight, bottomLeft, bottomRight)
    }

    override fun onError(message: String) {
        onErrorMessage(message)
    }
}
