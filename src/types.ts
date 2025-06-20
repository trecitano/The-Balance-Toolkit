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

export const initialUsersData: UserType[] = [
  { 
    id: "User-123", 
    name: "John Doe", 
    gender: "Male", 
    age: 30, 
    height: 180, 
    heightMetric: "cm", 
    handedness: "Right", 
    weight: 75, 
    metric: "kg", 
    color: "#3498db", 
    createdOn: "2025-06-10T10:00:00Z",
    lastUpdatedOn: "2025-06-15T10:00:00Z", 
    submitted: true 
  },
  { 
    id: "User-456", 
    name: "Jane Smith", 
    gender: "Female", 
    age: 28, 
    height: 165, 
    heightMetric: "cm", 
    handedness: "Left", 
    weight: 60, 
    metric: "kg", 
    color: "#e74c3c", 
    createdOn: "2025-06-09T14:30:00Z",
    lastUpdatedOn: "2025-06-14T14:30:00Z", 
    submitted: true 
  },
  { 
    id: "User-789", 
    name: "Alex Green", 
    gender: "Other", 
    customGender: "Non-binary", 
    age: 35, 
    height: 67, 
    heightMetric: "in", 
    handedness: "Ambidextrous", 
    weight: 150, 
    metric: "lb", 
    color: "#2ecc71", 
    createdOn: "2025-06-08T09:15:00Z",
    lastUpdatedOn: "2025-06-13T09:15:00Z", 
    submitted: true 
  },
];

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