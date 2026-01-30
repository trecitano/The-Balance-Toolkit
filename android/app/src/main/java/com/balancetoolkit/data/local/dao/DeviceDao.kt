package com.balancetoolkit.data.local.dao

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.balancetoolkit.data.local.entity.DeviceEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface DeviceDao {
    @Query("SELECT * FROM devices ORDER BY name ASC")
    fun getAllDevices(): Flow<List<DeviceEntity>>

    @Query("SELECT * FROM devices WHERE isConnected = 1")
    fun getConnectedDevices(): Flow<List<DeviceEntity>>

    @Query("SELECT * FROM devices WHERE isConnected = 1")
    suspend fun getConnectedDevicesOnce(): List<DeviceEntity>

    @Query("SELECT * FROM devices WHERE id = :id")
    suspend fun getDeviceById(id: String): DeviceEntity?

    @Query("SELECT * FROM devices WHERE macAddress = :macAddress")
    suspend fun getDeviceByMacAddress(macAddress: String): DeviceEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertDevice(device: DeviceEntity)

    @Update
    suspend fun updateDevice(device: DeviceEntity)

    @Query("UPDATE devices SET isConnected = :isConnected WHERE id = :id")
    suspend fun updateConnectionStatus(
        id: String,
        isConnected: Boolean,
    )

    @Query("UPDATE devices SET lastSeen = :lastSeen WHERE id = :id")
    suspend fun updateLastSeen(
        id: String,
        lastSeen: String,
    )

    @Query("UPDATE devices SET name = :name WHERE id = :id")
    suspend fun updateDeviceName(
        id: String,
        name: String,
    )

    @Delete
    suspend fun deleteDevice(device: DeviceEntity)

    @Query("DELETE FROM devices WHERE id = :id")
    suspend fun deleteDeviceById(id: String)
}
