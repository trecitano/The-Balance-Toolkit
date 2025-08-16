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
  samplingNumber: number;
  interpolation: string;
}

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
  selectedUser: string;
  availableUsers: string[];
  selectedBoards: SelectedBoard[];
  lslEnabled: boolean;
  tcpEnabled: boolean;
  fileLocation: string;
  isRecording: boolean;
}

export interface SelectedBoard {
  name: string;
  macAddress: number;
}

export type BalanceBoardEvent = RawBalanceBoardEvent | ProcessedBoardEvent;

export type RawBalanceBoardEvent = {
  event: "raw";
  macAddress: number;
  timestamp: number;
  copX: number;
  copY: number;
};

export type ProcessedBoardEvent = {
  event: "processed";
  macAddress: number;
  timestamp: number;
  vCopX: number;
  vCopY: number;
  confidenceEllipsePolygon: [number, number][],
  convexHullPolygon: [number, number][],
};
