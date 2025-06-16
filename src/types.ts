export interface UserType {
  id: string;
  name: string;
  gender: "male" | "female" | "other" | "prefer_not_to_say";
  customGender?: string;
  age: number | "";
  height: number | "";
  handedness: "left" | "right" | "ambidextrous";
  weight: number | "";
  metric: "kg" | "lb";
  color: string;
  lastUpdatedOn?: string;
  submitted?: boolean;
}

export const defaultUser: UserType = {
  id: "default-user-placeholder",
  name: "",
  gender: "prefer_not_to_say",
  age: "",
  height: "",
  handedness: "right",
  weight: "",
  metric: "kg",
  color: "#cccccc",
  submitted: false,
};

export const initialUsersData: UserType[] = [
  { id: "User-123", name: "John Doe", gender: "male", age: 30, height: 180, handedness: "right", weight: 75, metric: "kg", color: "#3498db", lastUpdatedOn: "2025-06-15T10:00:00Z", submitted: true },
  { id: "User-456", name: "Jane Smith", gender: "female", age: 28, height: 165, handedness: "left", weight: 60, metric: "kg", color: "#e74c3c", lastUpdatedOn: "2025-06-14T14:30:00Z", submitted: true },
  { id: "User-789", name: "Alex Green", gender: "other", customGender: "Non-binary", age: 35, height: 170, handedness: "ambidextrous", weight: 150, metric: "lb", color: "#2ecc71", lastUpdatedOn: "2025-06-13T09:15:00Z", submitted: true },
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