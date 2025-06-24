export interface UserType {
  id: string;
  name: string;
  age?: number;
  gender?: string;
  customGender?: string;
  height?: number;
  heightMetric?: string; // New field for height unit (cm/in)
  weight?: number;
  metric?: string; // Weight unit (kg/lb)
  handedness?: 'Right' | 'Left' | 'Ambidextrous';
  color?: string;
  createdOn: string;
  lastUpdatedOn: string;
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
  id: '',
  name: '',
  age: undefined,
  gender: '',
  customGender: '',
  height: undefined,
  heightMetric: 'cm', // Default to centimeters
  weight: undefined,
  metric: 'kg', // Default to kilograms
  handedness: 'Right',
  color: '#397aac',
  createdOn: new Date().toISOString(),
  lastUpdatedOn: new Date().toISOString(),
  submitted: false
};

export interface Device {
  id: number;
  name: string;
  status: "Connected" | "Active" | "Disconnected" | string;
  mac: string;
  battery: number;
  temperature: number;
  firmware: string;
  lastConnected: string; // ISO date string
  [key: string]: any;
}