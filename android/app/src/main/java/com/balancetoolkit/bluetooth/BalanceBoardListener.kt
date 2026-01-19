package com.balancetoolkit.bluetooth

/**
 * Common listener interface for balance board connections.
 * Both mock and real HID connections implement this interface.
 */
interface BalanceBoardListener {
    fun onLog(message: String)
    fun onWeightData(topLeft: Float, topRight: Float, bottomLeft: Float, bottomRight: Float)
    fun onError(message: String)
}
