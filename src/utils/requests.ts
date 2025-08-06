// When using the Tauri API npm package:
import { Channel, invoke } from "@tauri-apps/api/core";
import { Device, ProcessedBoardData, UserType } from "@/types.ts";

export const commands = {
  users: {
    fetchUsers: async () => invoke<UserType[]>("user_fetch_all_users"),
    addUser: async (user: UserType) => invoke<void>("user_add", { user: user }),
    updateUser: async (user: UserType) => invoke<void>("user_update", { user: user }),
    deleteUser: async (userId: string) => invoke<void>("user_delete", { userId: userId })
  },

  devices: {
    fetchDevices: async () => invoke<Device[]>("devices_fetch_all_devices"),
    scanDevices: async () => invoke<Device[]>("devices_scan_without_timeout"),
    cancelScanDevices: async () => invoke<void>("devices_cancel_scan"),
    isScanning: async () => invoke<boolean>("devices_is_scanning"),
    selectDevice: async (deviceId: string) => invoke<void>("devices_select_device", { deviceId: deviceId }),
    unSelectDevice: async (deviceId: string) => invoke<void>("devices_unselect_device", { deviceId: deviceId }),
    selectedDevices: async () => invoke<void>("devices_get_selected_devices"),
    removeDevice: async (deviceId: string) => invoke<void>("devices_remove_device", { deviceId: deviceId }),
    disconnectDevice: async (deviceId: string) => invoke<void>("devices_disconnect_device", { deviceId: deviceId }),
    updateDeviceName: async (deviceId: string, deviceName: string) => {
      return invoke<void>("devices_update_device_name", {
        deviceId: deviceId,
        device_name: deviceName,
      });
    },
    identifyDevice: async (deviceId: string) => invoke<void>("devices_identify_device", { deviceId: deviceId })
  },

  session: {
    startSession: async (sessionChannel: Channel<ProcessedBoardData>) => {
      return invoke<Promise<Device[]>>("session_start_session", { sessionChannel: sessionChannel });
    },

    stopSession: async () => invoke("session_stop_session")
  }
};
