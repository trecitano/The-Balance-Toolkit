package com.balancetoolkit.data.local.dao

import com.balancetoolkit.data.MockDeviceIds
import com.balancetoolkit.data.local.entity.toEntity
import com.balancetoolkit.data.model.Device

suspend fun DeviceDao.syncMockBoards(mockModeEnabled: Boolean) {
    if (!mockModeEnabled) {
        deleteDeviceById(MockDeviceIds.MOCK_BOARD_1)
        deleteDeviceById(MockDeviceIds.MOCK_BOARD_2)
        deleteDeviceById(MockDeviceIds.MOCK_BOARD_3)
        return
    }

    upsertMockBoard(
        id = MockDeviceIds.MOCK_BOARD_1,
        name = "Mock Board 1",
        macAddress = "00:00:00:00:00:01",
        isConnected = true,
    )
    upsertMockBoard(
        id = MockDeviceIds.MOCK_BOARD_2,
        name = "Mock Board 2",
        macAddress = "00:00:00:00:00:02",
        isConnected = true,
    )
    upsertMockBoard(
        id = MockDeviceIds.MOCK_BOARD_3,
        name = "Mock Board 3",
        macAddress = "00:00:00:00:00:03",
        isConnected = false,
    )
}

private suspend fun DeviceDao.upsertMockBoard(
    id: String,
    name: String,
    macAddress: String,
    isConnected: Boolean,
) {
    val existing = getDeviceById(id)
    if (existing == null) {
        insertDevice(
            Device(
                id = id,
                name = name,
                macAddress = macAddress,
                isConnected = isConnected,
            ).toEntity(),
        )
        return
    }

    val updated =
        existing.copy(
            name = name,
            macAddress = macAddress,
            isConnected = isConnected,
            isSelected = if (isConnected) existing.isSelected else false,
        )
    if (updated != existing) {
        updateDevice(updated)
    }
}
