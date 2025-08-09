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
  macAddress: string;
  battery?: number;
  temperature?: number;
  lastConnected: string; // ISO date string
}

export interface SessionInformation {
  selectedUser: string;
  availableUsers: string[],
  selectedBoards: string[],
  lslEnabled: boolean,
  tcpEnabled: boolean,
  fileLocation: string,
  isRecording: boolean,
}

export type BalanceBoardEvent = RawBalanceBoardEvent | ProcessedBoardEvent;

export type RawBalanceBoardEvent = {
  event: "raw",
  data: {
    cop_x: number,
    cop_y: number
  }
}

type ProcessedBoardEvent = {
  event: "processed",
  data: {
    timestamp: number;
    swayMetrics?: {
      meanVelocity: number,
      totalPathLength: number,
      velocityMoment: number,
    },
    areaMetrics?: {
      confidenceEllipseArea: number,
      convexHullArea: number,
    },
    dfaAlpha?: number,
    jerk?: number
  }
}