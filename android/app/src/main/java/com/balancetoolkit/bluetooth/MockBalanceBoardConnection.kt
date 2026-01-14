package com.balancetoolkit.bluetooth

import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin
import kotlin.random.Random

/**
 * Mock balance board connection that simulates sensor readings.
 * Generates elliptical motion patterns similar to someone walking
 * around a balance board.
 */
class MockBalanceBoardConnection(
    private val listener: Listener
) {
    interface Listener {
        fun onLog(message: String)
        fun onWeightData(topLeft: Float, topRight: Float, bottomLeft: Float, bottomRight: Float)
        fun onError(message: String)
    }

    companion object {
        private const val TAG = "MockBalanceBoard"
        private const val SAMPLE_INTERVAL_MS = 10L
    }

    private var mockGenerator: MockBoardGenerator? = null
    private var pollingThread: Thread? = null

    @Volatile
    private var isRunning = false

    private var updateTare = false
    private var tareValue = TareValue()

    data class TareValue(
        val topLeft: Float = 0f,
        val topRight: Float = 0f,
        val bottomLeft: Float = 0f,
        val bottomRight: Float = 0f
    )

    /**
     * Generator that creates realistic balance board readings by
     * simulating a person moving in an elliptical path on the board.
     */
    private class MockBoardGenerator {
        private val startTime = System.nanoTime()

        // Randomized parameters for this session
        private val radiusX: Float
        private val radiusY: Float
        private val omega: Float // radians per second
        private val baseForce: Float
        private val verticalAmplitude: Float
        private val initialPhase: Float

        init {
            // Choose radii inside support polygon (35-65% of board width/height)
            val rxFrac = Random.nextFloat() * 0.30f + 0.35f // 0.35 to 0.65
            val ryFrac = Random.nextFloat() * 0.35f + 0.35f // 0.35 to 0.70

            // 0.10 to 1.0 revolutions per second (slow walk around ellipse)
            val revsPerSec = Random.nextFloat() * 0.90f + 0.10f
            omega = 2.0f * PI.toFloat() * revsPerSec

            // Base total force: 4 corners × 20-45 kg each = 80-180 kg total
            val perCorner = Random.nextFloat() * 25f + 20f
            baseForce = 4f * perCorner

            // Small vertical modulation (±3-8%)
            verticalAmplitude = Random.nextFloat() * 0.05f + 0.03f

            // Random initial phase
            initialPhase = Random.nextFloat() * 2f * PI.toFloat()

            // Calculate actual radii (using board dimensions)
            // Board is approximately 440mm × 120mm
            radiusX = rxFrac * 220f
            radiusY = ryFrac * 60f
        }

        /**
         * Generate the next reading based on elapsed time.
         */
        fun next(): Reading {
            val elapsedSecs = (System.nanoTime() - startTime) / 1_000_000_000f
            val phase = initialPhase + omega * elapsedSecs

            // Elliptical motion: x = cos, y = sin (CCW path)
            val x = radiusX * cos(phase)
            val y = radiusY * sin(phase)

            // Vertical oscillation at 2x frequency (simulates weight shifts)
            val totalForce = baseForce * (1f + verticalAmplitude * sin(2f * phase))

            // Convert CoP position to corner weights using bilinear interpolation
            return readingFromCop(x, y, totalForce)
        }

        /**
         * Convert Center of Pressure (x, y) and total force to four corner weights.
         * Uses bilinear distribution that keeps all corners >= 0.
         */
        private fun readingFromCop(x: Float, y: Float, totalForce: Float): Reading {
            // Normalize to [-1, 1] range based on board dimensions
            val xn = (x / 300f).coerceIn(-1f, 1f)
            val yn = (y / 200f).coerceIn(-1f, 1f)

            val w = 0.25f * totalForce

            val topRight = w * (1f + xn) * (1f + yn)
            val topLeft = w * (1f - xn) * (1f + yn)
            val bottomRight = w * (1f + xn) * (1f - yn)
            val bottomLeft = w * (1f - xn) * (1f - yn)

            return Reading(topLeft, topRight, bottomLeft, bottomRight)
        }
    }

    data class Reading(
        val topLeft: Float,
        val topRight: Float,
        val bottomLeft: Float,
        val bottomRight: Float
    )

    /**
     * Start generating mock readings.
     */
    fun start() {
        if (isRunning) return

        isRunning = true
        mockGenerator = MockBoardGenerator()
        listener.onLog("Mock balance board started")

        pollingThread = Thread {
            while (isRunning) {
                val reading = mockGenerator?.next() ?: break

                // Apply tare if requested
                if (updateTare) {
                    updateTare = false
                    tareValue = TareValue(
                        topLeft = reading.topLeft,
                        topRight = reading.topRight,
                        bottomLeft = reading.bottomLeft,
                        bottomRight = reading.bottomRight
                    )
                    listener.onLog("Tare set: TL=%.1f TR=%.1f BL=%.1f BR=%.1f".format(
                        reading.topLeft, reading.topRight, reading.bottomLeft, reading.bottomRight
                    ))
                }

                // Apply tare by subtracting tare values
                val tlTared = reading.topLeft - tareValue.topLeft
                val trTared = reading.topRight - tareValue.topRight
                val blTared = reading.bottomLeft - tareValue.bottomLeft
                val brTared = reading.bottomRight - tareValue.bottomRight

                listener.onWeightData(tlTared, trTared, blTared, brTared)

                try {
                    Thread.sleep(SAMPLE_INTERVAL_MS)
                } catch (_: InterruptedException) {
                    break
                }
            }
        }.apply {
            name = "MockBoard-Polling"
            start()
        }
    }

    /**
     * Request a tare (zero) on the next reading.
     */
    fun tare() {
        updateTare = true
    }

    /**
     * Stop generating mock readings.
     */
    fun stop() {
        isRunning = false
        pollingThread?.interrupt()
        pollingThread = null
        mockGenerator = null
        listener.onLog("Mock balance board stopped")
    }
}
