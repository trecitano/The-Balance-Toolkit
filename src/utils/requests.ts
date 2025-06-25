// When using the Tauri API npm package:
import { invoke } from '@tauri-apps/api/core';

import {mockUsersData, mockDeviceData, mockRecentFiles, mockScanDeviceData} from "@/utils/mocks.ts";
import {Device, RecentFile, UserType} from "@/types.ts";


const useUserMocks = true;
const useFileMocks = true;
const useDeviceMocks = true;

export const commands = {
    users: {
        async fetchUsers(): Promise<UserType[]> {
            if (useUserMocks) {
                return mockUsersData;
            }

            console.log("user_fetch_users");
            return invoke("user_fetch_users");
        },
        async addUser(user: UserType): Promise<void> {
            if (useUserMocks) {
                mockUsersData.push(user);
                return;
            }

            console.log("user_add, user:", user);
            return invoke("user_add", { user: user });
        },
        async updateUser(user: UserType): Promise<void> {
            if (useUserMocks) {
                const indexToUpdate = mockUsersData.findIndex(
                  user => user.id === user.id,
                );
                if (indexToUpdate > -1) {
                    mockUsersData[indexToUpdate] = user;
                }
                return;
            }

            console.log("user_update, user:", user);
            return invoke("user_update", {user: user});
        },
        async deleteUser(userId: string): Promise<void> {
            if (useUserMocks) {
                const indexToRemove = mockUsersData.findIndex(
                  user => user.id === userId,
                );
                if (indexToRemove > -1) {
                    mockUsersData.splice(indexToRemove, 1);
                }
                return;
            }

            console.log("user_delete, user_id:", user_id);
            return invoke("user_delete", { user_id: userId });
        },
    },

    files: {
        async fetchRecentFiles(): Promise<RecentFile[]> {
            if (useFileMocks) {
                return mockRecentFiles;
            }

            return invoke("get_recent_files")
        },
        async loadFile(filePath: string): Promise<void> {
            if (useFileMocks) {
                return;
            }

            return invoke("load_file", { file_path: filePath} );
        }
    },

    devices: {
        async fetchDevices(): Promise<Device[]> {
            if (useDeviceMocks) {
                return mockDeviceData;
            }

            return invoke("get_devices_information");
        },

        async scanDevices(): Promise<Device[]> {
            if (useDeviceMocks) {
                return new Promise(resolve => {
                    setTimeout(() => {resolve(mockScanDeviceData) }, 3000);
                });
            }

            return invoke("get_devices_information");
        }
    },
}