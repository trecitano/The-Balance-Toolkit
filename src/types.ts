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
  sessionConfiguration: SessionConfiguration;
  hasOngoingSession: boolean;
}

export type SessionConfiguration = {
  selectedUser: string;
  lslEnabled: boolean;
  tcpEnabled: boolean;
  outputDirectory: string | null;
  windowSizeMs: number;
  windowSlideMs: number;
  samplingRate: number;
  interpolation: string;
  activityId: string;
  loadSessionFilePath?: string;
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
  copX: number;
  copY: number;
};

export type ProcessedBoardEvent = {
  event: "processed";
  macAddress: number;
  timestamp: number;
  vCopX: number;
  vCopY: number;
  confidenceEllipsePolygon: [number, number][];
  convexHullPolygon: [number, number][];
};

export type ProcessedSessionData = {
  timestamp: number;
  vCopX: number;
  vCopY: number;
};

export type ProcessedPolygonData = {
  confidenceEllipsePolygon: [number, number][];
  convexHullPolygon: [number, number][];
};

export type TimelineBlock = {
  id: number;
  title: string; // Human-readable title (e.g., "Step onto board")
  label: string; // Machine-readable identifier (e.g., "step-onto-board")
  start: number; // Start time in seconds
  duration: number; // Duration in seconds
  image?: string; // Path to the image for the action block
};

/**
 * Represents the configuration for a balance assessment activity
 */
export type Activity = {
  id: string;
  title: string; // Display name of the activity
  staticImage: string; // A SVG file
  sequenceImages: string[]; // Multiple SVG files
  hoverImages: string[];
  timelineBlocks: TimelineBlock[]; // Sequence of action blocks for this activity
  boardsRequired: number; // Number of balance boards needed (default: 1)
  description?: string; // Brief description of the activity purpose
};
