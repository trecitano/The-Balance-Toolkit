export interface UserType {
  id: string;
  name: string;
  gender: string;
  customGender: string;
  age: string;
  height: string;
  handedness: "right" | "left" | "ambidextrous"; // Or string
  weight: string;
  metric: "kg" | "lb"; // Or string
  submitted: boolean;
  createdOn: string;
  lastUpdatedOn: string;
  color: string;
}

export const defaultUser: UserType = {
  id: "DefaultUser",
  name: "DefaultUser",
  gender: "",
  customGender: "",
  age: "",
  height: "",
  handedness: "right",
  weight: "70", // Default weight
  metric: "kg",
  submitted: false, // Or true if it should be considered "complete"
  createdOn: new Date().toISOString(),
  lastUpdatedOn: new Date().toISOString(),
  color: "#397aac", // Default color
};

export const initialUsersData: UserType[] = [
  defaultUser,
  {
    id: "001",
    name: "Alice Johnson",
    gender: "Female",
    customGender: "",
    age: "28",
    height: "165",
    handedness: "right",
    weight: "65",
    metric: "kg",
    submitted: false,
    createdOn: "2024-05-20T09:15:00.000Z",
    lastUpdatedOn: "2024-05-20T09:15:00.000Z",
    color: "#397aac", // Example color, match Users.tsx
  },
  {
    id: "002",
    name: "Bob Smith",
    gender: "Male",
    customGender: "",
    age: "34",
    height: "180",
    handedness: "left",
    weight: "78",
    metric: "kg",
    submitted: false,
    createdOn: "2025-05-19T14:30:00.000Z",
    lastUpdatedOn: "2025-05-19T14:30:00.000Z",
    color: "#397aac", // Example color
  },
  // Add other initial users from Users.tsx here...
  {
    id: "Guest", // For Session.tsx's initial example
    name: "Guest User",
    gender: "",
    customGender: "",
    age: "",
    height: "",
    handedness: "right",
    weight: "",
    metric: "kg",
    submitted: false,
    createdOn: new Date().toISOString(),
    lastUpdatedOn: new Date().toISOString(),
    color: "#9E9E9E",
  }
];