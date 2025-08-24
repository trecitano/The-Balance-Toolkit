// When using the Tauri API npm package:
import { Channel, invoke } from "@tauri-apps/api/core";
import {
  Activity,
  BalanceBoardEvent,
  Device,
  GeneralSettings, ReplayConfiguration,
  SessionPanelConfiguration,
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
    selectedDevices: async () => invoke<number[]>("devices_get_selected_devices"),
    removeDevice: async (macAddress: number) => invoke<void>("devices_remove_device", { macAddress: macAddress }),
    disconnectDevice: async (macAddress: number) =>
      invoke<void>("devices_disconnect_device", { macAddress: macAddress }),
    updateDeviceName: async (macAddress: number, deviceName: string) => {
      return invoke<void>("devices_update_device_name", {
        macAddress: macAddress,
        deviceName: deviceName,
      });
    },
    identifyDevice: async (macAddress: number) => invoke<void>("devices_identify_device", { macAddress: macAddress }),
  },

  session: {
    sessionInfo: async () => invoke<SessionInformation>("session_information"),
    updateSession: async (configuration: SessionPanelConfiguration) => invoke<void>("session_update_session_configuration", { configuration: configuration }),

    startSession: async (sessionChannel: Channel<BalanceBoardEvent>) => {
      return invoke<void>("session_start_session", { sessionChannel: sessionChannel });
    },

    stopSession: async () => invoke<void>("session_stop_session"),
  },

  replay: {
    replayInfo: async () => invoke<ReplayConfiguration>("replay_information"),
    loadReplayFile: async (filePath: string) => invoke<void>("replay_load_file", { filePath: filePath }),
    updateReplay: async (configuration: SessionPanelConfiguration) =>
      invoke<void>("replay_update", { configuration: configuration }),
    startReplay: async (sessionChannel: Channel<BalanceBoardEvent>) => {
      return invoke<Device[]>("replay_start_replay", { sessionChannel: sessionChannel });
    },
    stopReplay: async () => invoke("replay_stop_replay"),
  },

  activity: {
    getActivities: async () => invoke<Activity[]>("activity_get_activities"),
    getActivity: async (activityId: string) => invoke<Activity>("activity_get_activity", { activityId: activityId }),
    updateActivity: async (activity: Activity) => invoke<void>("activity_update_activity", { activity: activity }),
    resetActivity: async (activityId: string) =>
      invoke<Activity>("activity_reset_activity_to_default", { activityId: activityId }),
  },
};
