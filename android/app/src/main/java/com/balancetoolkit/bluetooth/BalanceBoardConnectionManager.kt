package com.balancetoolkit.bluetooth

/**
 * Interface for managing balance board connections.
 * Implementations handle the details of mock vs real connections.
 */
interface BalanceBoardConnectionManager {
    val isRunning: Boolean

    /**
     * Start a connection with the given listener.
     * @param listener The listener to receive sensor data callbacks
     * @return true if connection was started successfully
     */
    fun start(listener: BalanceBoardListener): Boolean

    /**
     * Stop the current connection.
     */
    fun stop()

    /**
     * Request a tare (zero) calibration.
     */
    fun tare()
}
