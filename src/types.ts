export interface UserType {
  id: string;
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
  isSelected: boolean
  submitted?: boolean;
}

export interface RecentFile {
  id: string;
  name: string;
  location: string;
  lastUpdated: string;
  userName: string;
}

export const defaultUser: UserType = {
  id: "",
  name: "",
  age: undefined,
  gender: "",
  customGender: "",
  height: undefined,
  heightMetric: "cm", // Default to centimeters
  weight: undefined,
  weightMetric: "kg", // Default to kilograms
  handedness: "Right",
  color: "#397aac",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  submitted: false,
  isDefault: true,
  isSelected: true,
};

export interface Device {
  id: string;
  name: string;
  isConnected: boolean;
  macAddress: string;
  battery?: number;
  temperature?: number;
  lastConnected: string; // ISO date string
}

export type BalanceBoardEvent = {
  event: "reading";
  data: {
    record: number;
  };
};

// TEMP
export type ProcessedBoardData = {
  ts: number; // epoch ms
  boardId: string;
  userId: string;

  // instantaneous center of pressure
  cop: { x: number; y: number }; // normalized -1..1 or device units

  // derived per-frame values
  traces: {
    vCoPx: number;
    vCoPy: number;
  };

  // derived metrics
  metrics: {
    stabilityIndex?: number | null;
  };
};

export type ActiveBoards = {
  leftBoardId: string;
  rightBoardId: string;
};