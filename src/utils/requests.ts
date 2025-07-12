// When using the Tauri API npm package:
import { Channel, invoke } from "@tauri-apps/api/core";

import {
  mockUsersData,
  mockDeviceData,
  mockRecentFiles,
  mockScanDeviceData,
} from "@/utils/mocks.ts";
import {
  BalanceBoardEvent,
  Device,
  ErrorMessage,
  RecentFile,
  UserType,
} from "@/types.ts";

const useFileMocks = true;
const useUserMocks = false;
const useDeviceMocks = false;

export const commands = {
  users: {
    async fetchUsers(): Promise<UserType[] | ErrorMessage> {
      if (useUserMocks) {
        return mockUsersData;
      }

      console.log("user_fetch_all");
      return invoke("user_fetch_all");
    },
    async addUser(user: UserType): Promise<void | ErrorMessage> {
      if (useUserMocks) {
        mockUsersData.push(user);
        return;
      }

      console.log("user_add, user:", user);
      return invoke("user_add", { user: user });
    },
    async updateUser(user: UserType): Promise<void | ErrorMessage> {
      if (useUserMocks) {
        const indexToUpdate = mockUsersData.findIndex(
          (user) => user.id === user.id,
        );
        if (indexToUpdate > -1) {
          mockUsersData[indexToUpdate] = user;
        }
        return;
      }

      console.log("user_update, user:", user);
      return invoke("user_update", { user: user });
    },
    async deleteUser(userId: string): Promise<void | ErrorMessage> {
      if (useUserMocks) {
        const indexToRemove = mockUsersData.findIndex(
          (user) => user.id === userId,
        );
        if (indexToRemove > -1) {
          mockUsersData.splice(indexToRemove, 1);
        }
        return;
      }

      console.log("user_delete, user_id:", userId);
      return invoke("user_delete", { user_id: userId });
    },
  },

  files: {
    async fetchRecentFiles(): Promise<RecentFile[] | ErrorMessage> {
      if (useFileMocks) {
        return mockRecentFiles;
      }

      return invoke("get_recent_files");
    },
    async loadFile(filePath: string): Promise<void> {
      if (useFileMocks) {
        return;
      }

      return invoke("load_file", { file_path: filePath });
    },
  },

  devices: {
    async fetchDevices(): Promise<Device[]> {
      if (useDeviceMocks) {
        return mockDeviceData;
      }

      return invoke("devices_fetch_all");
    },
    async scanDevices(): Promise<Device[] | ErrorMessage> {
      if (useDeviceMocks) {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(mockScanDeviceData);
          }, 3000);
        });
      }

      console.log("Invoking devices_scan_without_timeout");
      return invoke("devices_scan_without_timeout");
    },
    async cancelScanDevices(): Promise<void | ErrorMessage> {
      if (useDeviceMocks) {
        return;
      }

      console.log("Invoking devices_cancel_scan");
      return invoke("devices_cancel_scan");
    },

    async connectDevice(macAddress: string): Promise<void> {
      if (useDeviceMocks) {
        return;
      }

      const channel = new Channel<BalanceBoardEvent>();
      channel.onmessage = (message) => {
        console.log(`got download event ${message.event}`);
      };

      console.log("Connecting to device ", macAddress);
      return invoke("devices_connect_device", {
        macAddress: macAddress,
        channel: channel,
      });
    },
    async removeDevice(macAddress: string): Promise<void | ErrorMessage> {
      if (useDeviceMocks) {
        return;
      }

      return invoke("devices_remove_device", { mac_address: macAddress });
    },
    async disconnectDevice(macAddress: string): Promise<void | ErrorMessage> {
      if (useDeviceMocks) {
        return;
      }

      return invoke("devices_disconnect_device", { mac_address: macAddress });
    },
    async updateDeviceName(
      macAddress: string,
      deviceName: string,
    ): Promise<void | ErrorMessage> {
      return invoke("devices_update_device_name", {
        mac_address: macAddress,
        device_name: deviceName,
      });
    },
    async identifyDevice(macAddress: string): Promise<void | ErrorMessage> {
      return invoke("devices_identify_device", { mac_address: macAddress });
    },
  },
};
