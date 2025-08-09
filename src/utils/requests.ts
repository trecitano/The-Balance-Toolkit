// When using the Tauri API npm package:
import { Channel, invoke } from "@tauri-apps/api/core";
import {
  BalanceBoardEvent,
  Device,
  SessionInformation,
  UserPageInformation,
  UserType,
} from "@/types.ts";

export const commands = {
  users: {
    userPageInformation: async () => invoke<UserPageInformation>("user_page_information"),
    selectUser: async (userName: string) => invoke<void>("user_select_user", { userName: userName }),
    addUser: async (user: UserType) => invoke<void>("user_add", { user: user }),
    updateUser: async (user: UserType) => invoke<void>("user_update", { user: user }),
    deleteUser: async (userName: string) => invoke<void>("user_delete", { userName: userName }),
  },

  devices: {
    fetchDevices: async () => invoke<Device[]>("devices_fetch_all_devices"),
    scanDevices: async () => invoke<Device[]>("devices_scan_without_timeout"),
    cancelScanDevices: async () => invoke<void>("devices_cancel_scan"),
    isScanning: async () => invoke<boolean>("devices_is_scanning"),
    selectDevice: async (deviceId: string) =>
      invoke<void>("devices_select_device", { deviceId: deviceId }),
    unselectDevice: async (deviceId: string) =>
      invoke<void>("devices_unselect_device", { deviceId: deviceId }),
    selectedDevices: async () => invoke<void>("devices_get_selected_devices"),
    removeDevice: async (deviceId: string) =>
      invoke<void>("devices_remove_device", { deviceId: deviceId }),
    disconnectDevice: async (deviceId: string) =>
      invoke<void>("devices_disconnect_device", { deviceId: deviceId }),
    updateDeviceName: async (deviceId: string, deviceName: string) => {
      return invoke<void>("devices_update_device_name", {
        deviceId: deviceId,
        device_name: deviceName,
      });
    },
    identifyDevice: async (deviceId: string) =>
      invoke<void>("devices_identify_device", { deviceId: deviceId }),
  },

  session: {
    sessionInfo: async () => invoke<Promise<SessionInformation>>("session_information"),
    startSession: async (sessionChannel: Channel<BalanceBoardEvent>) => {
      return invoke<Promise<Device[]>>("session_start_session", { sessionChannel: sessionChannel });
    },

    stopSession: async () => invoke("session_stop_session"),
  },
};
