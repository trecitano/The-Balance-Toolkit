// When using the Tauri API npm package:
import { invoke } from '@tauri-apps/api/core';

import {mockUsersData, mockDeviceData, mockRecentFiles, mockScanDeviceData} from "@/utils/mocks.ts";
import {Device, RecentFile, UserType} from "@/types.ts";


const useMocks = true;

export const commands = {
    async fetchUsers(): Promise<UserType[]> {
        if (useMocks) {
            return mockUsersData;
        }

        return await invoke("get_devices_information");
    },

    async fetchDevices(): Promise<Device[]> {
        if (useMocks) {
            return mockDeviceData;
        }

        return await invoke("get_devices_information");
    },

    async fetchRecentFiles(): Promise<RecentFile[]> {
        if (useMocks) {
            return mockRecentFiles;
        }

        return await invoke("get_devices_information")
    },

    async scanDevices(): Promise<Device[]> {
        if (useMocks) {
            return new Promise(resolve => {
                setTimeout(() => {resolve(mockScanDeviceData) }, 3000);
            });
        }

        return await invoke("get_devices_information");
    }
}