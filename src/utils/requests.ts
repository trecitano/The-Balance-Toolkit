// When using the Tauri API npm package:
import { Channel, invoke } from "@tauri-apps/api/core";

import {
  mockUsersData,
  mockDeviceData,
  mockRecentFiles,
} from "@/utils/mocks.ts";
import {BalanceBoardEvent, Device, ProcessedBoardData, RecentFile, UserType} from "@/types.ts";

const useFileMocks = true;
const useUserMocks = false;
const useDeviceMocks = false;

export const commands = {
  users: {
    async fetchUsers(): Promise<UserType[]> {
      if (useUserMocks) {
        return mockUsersData;
      }

      return invoke("user_fetch_all_users");
    },
    async addUser(user: UserType): Promise<void> {
      if (useUserMocks) {
        mockUsersData.push(user);
        return;
      }

      return invoke("user_add", { user: user });
    },
    async updateUser(user: UserType): Promise<void> {
      if (useUserMocks) {
        const indexToUpdate = mockUsersData.findIndex((user) => user.id === user.id);
        if (indexToUpdate > -1) {
          mockUsersData[indexToUpdate] = user;
        }
        return;
      }

      return invoke("user_update", { user: user });
    },
    async deleteUser(userId: string): Promise<void> {
      if (useUserMocks) {
        const indexToRemove = mockUsersData.findIndex((user) => user.id === userId);
        if (indexToRemove > -1) {
          mockUsersData.splice(indexToRemove, 1);
        }
        return;
      }

      return invoke("user_delete", { userId: userId });
    },
  },

  files: {
    async fetchRecentFiles(): Promise<RecentFile[]> {
      if (useFileMocks) {
        return mockRecentFiles;
      }

      return invoke("get_recent_files");
    },
    async loadFile(filePath: string): Promise<void> {
      if (useFileMocks) {
        return;
      }

      return invoke("load_file", { filePath: filePath });
    },
  },

  devices: {
    async fetchDevices(): Promise<Device[]>   {
      if (useDeviceMocks) {
        return mockDeviceData;
      }

      return invoke("devices_fetch_all_devices");
    },
    scanDevices: async (): Promise<Device[]> => invoke("devices_scan_without_timeout"),
    cancelScanDevices: async (): Promise<void> => invoke("devices_cancel_scan"),
    isScanning: async (): Promise<boolean> => invoke("devices_is_scanning"),
    selectDevice: async (deviceId: string): Promise<void> => {
      console.log("Selecting device ", deviceId);
      return invoke("devices_select_device", { deviceId: deviceId })
    },
    unSelectDevice: async (deviceId: string): Promise<void> => {
      return invoke("devices_unselect_device", { deviceId: deviceId })
    },
    selectedDevices: async (): Promise<String[]> => invoke("devices_get_selected_devices"),

    connectDevice: async (deviceId: string): Promise<void> => {
      const channel = new Channel<BalanceBoardEvent>();
      channel.onmessage = (message) => {
        console.log(`got download event ${message.event}`);
      };

      console.log("Connecting to device ", deviceId);
      return invoke("devices_connect_device", {
        deviceId: deviceId,
        channel: channel,
      });
    },
    removeDevice: async (deviceId: string): Promise<void> => {
      return invoke("devices_remove_device", { deviceId: deviceId });
    },
    disconnectDevice: async (deviceId: string): Promise<void> => {
      return invoke("devices_disconnect_device", { deviceId: deviceId });
    },
    updateDeviceName: async (deviceId: string, deviceName: string): Promise<void> => {
      return invoke("devices_update_device_name", {
        deviceId: deviceId,
        device_name: deviceName,
      });
    },
    identifyDevice: async (deviceId: string): Promise<void> => {
      return invoke("devices_identify_device", { deviceId: deviceId });
    },
  },

  session: {
    async startSession(sessionChannel: Channel<ProcessedBoardData>): Promise<Device[]> {
      return invoke("session_start_session", { sessionChannel: sessionChannel });
    },

    async stopSession(): Promise<void> {
      return invoke("session_stop_session");
    },
  }
};
