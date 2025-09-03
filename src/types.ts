export interface GeneralSettings {
  tcpConnectionString: string;
  tcpSendRawData: boolean;
  tcpSendProcessedData: boolean;
  lslStreamName: string;
  lslSourceId: string;
  lslSendRawData: boolean;
  lslSendProcessedData: boolean;
  storeFilesDefaultDirectory: string;
  storeRawSession: boolean;
  storeProcessedData: boolean;
  processingSettings: ProcessingSettings;
  isDemoMode: boolean;
}

export interface ProcessingSettings {
  balanceBoardXSize: number;
  balanceBoardYSize: number;
  windowSizeMs: number;
  windowSlideMs: number;
  samplingRate: number;
  interpolation: InterpolationOption;
}

export type InterpolationOption = "Linear" | "Cubic" | "Polynomial";
export const interpolationOptions = ["Linear", "Cubic", "Polynomial"] as const;

export interface UserType {
  name: string;
  age?: number;
  gender?: string;
  customGender?: string;
  height?: number;
  heightMetric?: string; // New field for height unit (cm/in)
  weight?: number;
  weightMetric?: string; // Weight unit (kg/lb)
  handedness?: "Right" | "Left" | "Ambidextrous";
  color?: string;
  createdAt: string;
  updatedAt: string;
  isDefault: boolean;
}

export interface UserPageInformation {
  users: UserType[];
  selectedUser: string;
  sessionDevices: Device[];
}

export interface Device {
  id: string;
  name: string;
  isConnected: boolean;
  macAddress: number;
  battery?: number;
  temperature?: number;
  lastConnected: string; // ISO date string
}

export interface SessionInformation {
  availableUsers: string[];
  selectedBoards: SelectedBoard[];
  core: SessionPanelConfiguration;
  activity?: Activity;
  hasOngoingSession: boolean;
}

export type SessionPanelConfiguration = {
  selectedUser: string;
  activityId?: string;
  lslEnabled: boolean;
  tcpEnabled: boolean;
  outputDirectory: string | null;
  windowSizeMs: number;
  windowSlideMs: number;
  samplingRate: number;
  interpolation: string;
};

export type ReplayConfiguration = {
  core: SessionPanelConfiguration;
  devices: SelectedBoard[];
  activity?: Activity;
  filePath?: string;
  hasOngoingSession: boolean;
};

export interface SelectedBoard {
  name: string;
  macAddress: number;
}

export type BalanceBoardEvent = RawBalanceBoardEvent | ProcessedBoardEvent;

export type RawBalanceBoardEvent = {
  event: "raw";
  macAddress: number;
  timestamp: number;
  weight: number;
  copX: number;
  copY: number;
};

export type ProcessedBoardEvent = {
  event: "processed";
  macAddress: number;
  timestamp: number;
  vCopX: number;
  vCopY: number;
  stabilityIndex: number;
  confidenceEllipsePolygon: [number, number][];
  convexHullPolygon: [number, number][];
  frequencySpectrum: FrequencySpectrum;
  mlsi?: number;
  apsi?: number;
  vsi?: number;
  dpsi?: number;
};

export type ProcessedSessionData = {
  timestamp: number;
  vCopX: number;
  vCopY: number;
  mlsi?: number;
  apsi?: number;
  vsi?: number;
  dpsi?: number;
};

export type FrequencySpectrum = {
  freqs_hz: number[];
  psd_xy: number[]; // mm²/Hz
};

export type ProcessedSingleFrameSessionData = {
  confidenceEllipsePolygon: [number, number][];
  convexHullPolygon: [number, number][];
  stabilityIndex: number;
  frequencySpectrum?: FrequencySpectrum;
};

export type TimelineBlock = {
  id: string;
  title: string;
  duration: number;
};

export type Activity = {
  id: string;
  title: string;
  staticImage: string;
  timelineBlocks: TimelineBlock[];
  boardsRequired: number;
  description?: string;
};

export type SessionStats = {
  boardSamplingRate: number;
  duration: {
    secs: number;
    nanos: number;
  };
};

export type LastSessionInformation = {
  user: UserType;
  sessionStats: SessionStats;
  fileLocation: String;
  activity?: Activity;
};

export type OngoingSessionActivityState = {
  currentBlockIndex: number;
  timeToNextBlockMs: number;
}

export type SessionActivityState = {
  activity: Activity;
  ongoingState?: OngoingSessionActivityState;
}