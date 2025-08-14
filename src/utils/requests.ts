// When using the Tauri API npm package:
import { Channel, invoke } from "@tauri-apps/api/core";
import {
  BalanceBoardEvent,
  Device,
  GeneralSettings,
  SessionInformation,
  UserPageInformation,
  UserType,
} from "@/types.ts";

export const commands = {
  settings: {
    getSettings: async () => invoke<GeneralSettings>("settings_get_settings"),
    setSettings: async (settings: GeneralSettings) => invoke<void>("settings_set_settings", { settings: settings }),
  },

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
    selectDevice: async (macAddress: number) => invoke<void>("devices_select_device", { macAddress: macAddress }),
    unselectDevice: async (macAddress: number) => invoke<void>("devices_unselect_device", { macAddress: macAddress }),
    selectedDevices: async () => invoke<void>("devices_get_selected_devices"),
    removeDevice: async (macAddress: number) => invoke<void>("devices_remove_device", { macAddress: macAddress }),
    disconnectDevice: async (macAddress: number) => invoke<void>("devices_disconnect_device", { macAddress: macAddress }),
    updateDeviceName: async (macAddress: number, deviceName: string) => {
      return invoke<void>("devices_update_device_name", {
        macAddress: macAddress,
        deviceName: deviceName,
      });
    },
    identifyDevice: async (macAddress: number) => invoke<void>("devices_identify_device", { macAddress: macAddress }),
  },

  session: {
    sessionInfo: async () => invoke<Promise<SessionInformation>>("session_information"),
    startSession: async (sessionChannel: Channel<BalanceBoardEvent>) => {
      return invoke<Promise<Device[]>>("session_start_session", { sessionChannel: sessionChannel });
    },

    stopSession: async () => invoke("session_stop_session"),
  },
};
