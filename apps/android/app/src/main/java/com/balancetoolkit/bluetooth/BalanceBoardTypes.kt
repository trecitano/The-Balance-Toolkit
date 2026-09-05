package com.balancetoolkit.bluetooth

/**
 * Represents tare (zero) values for the four balance board sensors.
 * Used to offset raw readings to show relative weight changes.
 */
data class TareValue(
    val topLeft: Float = 0f,
    val topRight: Float = 0f,
    val bottomLeft: Float = 0f,
    val bottomRight: Float = 0f,
)

/**
 * Represents a single reading from the four balance board sensors.
 */
data class SensorReading(
    val topLeft: Float = 0f,
    val topRight: Float = 0f,
    val bottomLeft: Float = 0f,
    val bottomRight: Float = 0f,
) {
    val totalForce: Float
        get() = topLeft + topRight + bottomLeft + bottomRight
}

/**
 * Utility class for tare management logic shared between mock and real connections.
 */
class TareManager {
    @Volatile
    private var updateTare = false
    private var tareValue = TareValue()

    /**
     * Request a tare (zero) on the next reading.
     */
    fun requestTare() {
        updateTare = true
    }

    /**
     * Apply tare logic to a reading. If tare was requested, captures current values.
     * Always returns tare-adjusted values.
     *
     * @param reading The raw sensor reading
     * @param onTareSet Optional callback when tare is set, receives the tare values
     * @return Tare-adjusted sensor reading
     */
    fun applyTare(
        reading: SensorReading,
        onTareSet: ((TareValue) -> Unit)? = null,
    ): SensorReading {
        if (updateTare) {
            updateTare = false
            tareValue =
                TareValue(
                    topLeft = reading.topLeft,
                    topRight = reading.topRight,
                    bottomLeft = reading.bottomLeft,
                    bottomRight = reading.bottomRight,
                )
            onTareSet?.invoke(tareValue)
        }

        return SensorReading(
            topLeft = reading.topLeft - tareValue.topLeft,
            topRight = reading.topRight - tareValue.topRight,
            bottomLeft = reading.bottomLeft - tareValue.bottomLeft,
            bottomRight = reading.bottomRight - tareValue.bottomRight,
        )
    }

    /**
     * Reset tare values to zero.
     */
    fun reset() {
        tareValue = TareValue()
        updateTare = false
    }
}
