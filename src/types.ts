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

export type ProcessedBoardData = {
  timestamp: Date;
  reading: [number, number, number, number];
};
