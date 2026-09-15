// Grouped façade over the generated command bindings. Argument and return types are
// inferred from `@/bindings`, so a backend signature change fails `tsc` here.
import { Channel } from "@tauri-apps/api/core";
import { commands as backend } from "@/bindings";
import type {
  Activity,
  BalanceBoardEvent,
  CalibrationReading,
  CapturedCalibrationReading,
  GeneralSettings,
  SessionPanelConfiguration,
  UserType,
} from "@/types.ts";

export const commands = {
  settings: {
    getSettings: () => backend.settingsGetSettings(),
    setSettings: (settings: GeneralSettings) => backend.settingsSetSettings(settings),
  },

  users: {
    userPageInformation: () => backend.userPageInformation(),
    selectUser: (userId: number) => backend.userSelectUser(userId),
    createUser: () => backend.userCreate(),
    updateUser: (user: UserType) => backend.userUpdate(user),
    deleteUser: (userId: number) => backend.userDelete(userId),
    // The generator types a bare `f64` channel payload as nullable (JSON has no NaN); the
    // backend only ever sends finite weights.
    startMeasureWeight: (channel: Channel<number>, macAddress: number) =>
      backend.userMeasureWeight(channel as Channel<number | null>, macAddress),
  },

  devices: {
    fetchDevices: () => backend.devicesFetchAllDevices(),
    scanDevices: () => backend.devicesScanWithoutTimeout(),
    cancelScanDevices: () => backend.devicesCancelScan(),
    isScanning: () => backend.devicesIsScanning(),
    selectDevice: (macAddress: number) => backend.devicesSelectDevice(macAddress),
    unselectDevice: (macAddress: number) => backend.devicesUnselectDevice(macAddress),
    selectedDevices: () => backend.devicesGetSelectedDevices(),
    removeDevice: (macAddress: number) => backend.devicesRemoveDevice(macAddress),
    updateDeviceName: (macAddress: number, deviceName: string) =>
      backend.devicesUpdateDeviceName(macAddress, deviceName),
    tareDevice: (macAddress: number) => backend.devicesTareDevice(macAddress),
    identifyDevice: (macAddress: number) => backend.devicesIdentifyDevice(macAddress),
    startCalibrationStream: (calibrationChannel: Channel<CalibrationReading>, macAddress: number) =>
      backend.devicesStartCalibrationStream(macAddress, calibrationChannel),
    stopCalibrationStream: (macAddress: number) => backend.devicesStopCalibrationStream(macAddress),
    submitCalibration: (macAddress: number, weightKg: number, readings: CapturedCalibrationReading[]) =>
      backend.devicesSubmitCalibration(macAddress, weightKg, readings),
  },

  session: {
    sessionInfo: () => backend.sessionInformation(),
    updateSession: (configuration: SessionPanelConfiguration) =>
      backend.sessionUpdateSessionConfiguration(configuration),
    startSession: (sessionChannel: Channel<BalanceBoardEvent>) => backend.sessionStartSession(sessionChannel),
    tareDevices: () => backend.sessionTareDevices(),
    stopSession: () => backend.sessionStopSession(),
    getActivityState: () => backend.sessionActivityState(),
  },

  replay: {
    loadLastSessionDetails: () => backend.replayLoadLastSessionInfo(),
    replayInfo: () => backend.replayInformation(),
    loadReplayFile: (filePath: string) => backend.replayLoadFile(filePath),
    updateReplay: (configuration: SessionPanelConfiguration) => backend.replayUpdate(configuration),
    startReplay: (sessionChannel: Channel<BalanceBoardEvent>) => backend.replayStartReplay(sessionChannel),
    stopReplay: () => backend.replayStopReplay(),
    clearReplay: () => backend.replayClearReplay(),
  },

  activity: {
    getAvailableTimeBlocks: () => backend.activityGetAvailableTimeBlocks(),
    getActivities: () => backend.activityGetActivities(),
    getActivity: (activityId: string) => backend.activityGetActivity(activityId),
    updateActivity: (activity: Activity) => backend.activityUpdateActivity(activity),
    resetActivity: (activityId: string) => backend.activityResetActivityToDefault(activityId),
  },
};
