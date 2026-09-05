package com.balancetoolkit.bluetooth

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.float
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class TareManagerTest {
    @Test
    fun sharedSensorFixturesPreserveTareAndWeight() {
        val source = requireNotNull(javaClass.getResourceAsStream("/sensors.json"))
        val cases = source.bufferedReader().use { Json.parseToJsonElement(it.readText()).jsonArray }
        assertTrue(cases.isNotEmpty())
        for (entry in cases) {
            val case = entry.jsonObject
            val name = case.getValue("name").jsonPrimitive.content

            fun reading(key: String): SensorReading {
                val values = case.getValue(key).jsonArray.map { it.jsonPrimitive.float }
                return SensorReading(topRight = values[0], bottomRight = values[1], topLeft = values[2], bottomLeft = values[3])
            }

            val manager = TareManager()
            manager.requestTare()
            assertEquals(name, SensorReading(), manager.applyTare(reading("tare")))
            val adjusted = manager.applyTare(reading("reading"))
            assertEquals(name, reading("expected"), adjusted)
            assertEquals(name, case.getValue("weight").jsonPrimitive.float, adjusted.totalForce, 0.00001f)
            manager.reset()
            assertEquals(name, reading("reading"), manager.applyTare(reading("reading")))
        }
    }

    @Test
    fun tareIsCapturedOnceOnTheNextReading() {
        val manager = TareManager()
        var callbacks = 0
        manager.requestTare()
        manager.applyTare(SensorReading(topLeft = 10f)) { callbacks++ }
        val next = manager.applyTare(SensorReading(topLeft = 15f)) { callbacks++ }
        assertEquals(1, callbacks)
        assertEquals(5f, next.topLeft, 0f)
    }
}
