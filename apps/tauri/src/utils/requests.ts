// Grouped façade over the generated command bindings. Argument and return types are
// inferred from `@/bindings`, so a backend signature change fails `tsc` here.
import { Channel } from "@tauri-apps/api/core";
import { commands as backend } from "@/bindings";
import type {
  Activity,
  FrontendBalanceBoardEvent,
  FrontendCalibrationReading,
  CapturedCalibrationReading,
  GeneralSettings,
  SessionSettings,
  User,
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
    updateUser: (user: User) => backend.userUpdate(user),
    deleteUser: (userId: number) => backend.userDelete(userId),
    // The generator types a bare `f64` channel payload as nullable (JSON has no NaN); the
    // backend only ever sends finite weights.
    startMeasureWeight: (channel: Channel<number>, macAddress: number, measurementId: string) =>
      backend.userMeasureWeight(channel as Channel<number | null>, macAddress, measurementId),
    stopMeasureWeight: (measurementId: string) => backend.userStopMeasureWeight(measurementId),
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
    startCalibrationStream: (calibrationChannel: Channel<FrontendCalibrationReading>, macAddress: number) =>
      backend.devicesStartCalibrationStream(macAddress, calibrationChannel),
    stopCalibrationStream: (macAddress: number) => backend.devicesStopCalibrationStream(macAddress),
    submitCalibration: (macAddress: number, weightKg: number, readings: CapturedCalibrationReading[]) =>
      backend.devicesSubmitCalibration(macAddress, weightKg, readings),
  },

  session: {
    sessionInfo: () => backend.sessionInformation(),
    updateSession: (configuration: SessionSettings) => backend.sessionUpdateSessionConfiguration(configuration),
    startSession: (sessionChannel: Channel<FrontendBalanceBoardEvent>) => backend.sessionStartSession(sessionChannel),
    tareDevices: () => backend.sessionTareDevices(),
    stopSession: () => backend.sessionStopSession(),
    getActivityState: () => backend.sessionActivityState(),
  },

  replay: {
    loadLastSessionDetails: () => backend.replayLoadLastSessionInfo(),
    replayInfo: () => backend.replayInformation(),
    loadReplayFile: (filePath: string) => backend.replayLoadFile(filePath),
    updateReplay: (configuration: SessionSettings) => backend.replayUpdate(configuration),
    startReplay: (sessionChannel: Channel<FrontendBalanceBoardEvent>) => backend.replayStartReplay(sessionChannel),
    stopReplay: () => backend.replayStopReplay(),
    clearReplay: () => backend.replayClearReplay(),
  },

  activity: {
    getAvailableTimeBlocks: () => backend.activityGetAvailableTimeBlocks(),
    getActivities: () => backend.activityGetActivities(),
    updateActivity: (activity: Activity) => backend.activityUpdateActivity(activity),
    resetActivity: (activityId: string) => backend.activityResetActivityToDefault(activityId),
  },
};
