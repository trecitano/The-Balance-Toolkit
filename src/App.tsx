import React, { useState, useEffect, useCallback } from "react";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import Navigation from "./components/common/Navigation/Navigation";
import Home from "./pages/Home/Home";
import Devices from "./pages/Devices/Devices";
import UsersPage from "./pages/Users/Users"; // Renamed import for clarity
import SessionPage from "./pages/Session/Session"; // Renamed import for clarity
import Activities from "./pages/Activities/Activities";
import lightIcon from "./assets/light-icon.svg";
import darkIcon from "./assets/dark-icon.svg";
import { UserType, initialUsersData } from "./types"; // Assuming types.ts is created
import "./App.css";

interface Device {
  id: number;
  name: string;
  status: "Connected" | "Active" | "Disconnected" | string;
  [key: string]: any;
}

const fetchInitialDeviceData = async (): Promise<Device[]> => {
  return [
    { id: 1, name: "Nintendo RVL-WBC-01", status: "Connected", mac: "00:1A:7D:DA:71:13", battery: 85, temperature: 22, firmware: "v1.2.3", lastConnected: "2023-10-01" },
    { id: 2, name: "Nintendo RVL-WBC-02", status: "Connected", mac: "00:1A:7D:DA:71:14", battery: 26, temperature: 23, firmware: "v1.2.4", lastConnected: "2023-10-05" },
    { id: 3, name: "Generic Board X", status: "Disconnected", mac: "00:1A:7D:DA:71:15", battery: 0, temperature: 20, firmware: "v1.0.0", lastConnected: "2023-09-15" },
  ];
};

function AppContent() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [connectedDeviceNames, setConnectedDeviceNames] = useState<string[]>([]);
  const navigate = useNavigate();
  const location = useLocation();

  const [users, setUsers] = useState<UserType[]>(initialUsersData);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(
    initialUsersData.find(u => u.id === "User-123")?.id || initialUsersData[0]?.id || null // Prioritize "User-123" if exists, else first, else null
  );


  useEffect(() => {
    const loadInitialData = async () => {
      const initialDevices = await fetchInitialDeviceData();
      const initiallyConnectedNames = initialDevices
        .filter(device => device.status === "Connected")
        .map(device => device.name);
      setConnectedDeviceNames(initiallyConnectedNames);
    };
    loadInitialData();
  }, []);

  const handleSetConnectedDeviceNames = useCallback((names: string[]) => {
    setConnectedDeviceNames(names);
  }, []);

  useEffect(() => {
    document.documentElement.className = `${theme}-theme`;
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  const handleInitialBoardConsumedInApp = useCallback(() => {
    // Placeholder
  }, []);

  const handleViewChange = (view: string) => {
    const targetPath = `/${view === "home" ? "" : view}`;
    if (location.pathname !== targetPath) {
      navigate(targetPath);
    }
  };
  
  // Prepare users for Session.tsx dropdown (id, name, color)
  const usersForSessionDropdown = users.map(user => ({
    id: user.id,
    name: user.name, // Assuming UserType has a name property
    color: user.color,
  }));

  return (
    <div className={`app ${theme}-theme`}>
      <Navigation activeView={location.pathname.substring(1) || "home"} onViewChange={handleViewChange} />
      <main className="main-content">
        <div className="theme-toggle-hover-zone">
          <button
            className="theme-toggle-btn"
            onClick={(e) => {
              handleToggleTheme();
              e.currentTarget.blur();
            }}
            aria-label="Toggle theme"
          >
            <img
              src={theme === "light" ? lightIcon : darkIcon}
              alt={theme === "light" ? "Light mode" : "Dark mode"}
              className="theme-toggle-icon"
            />
          </button>
        </div>
        <Routes>
          <Route path="/" element={<Home onViewChange={handleViewChange} />} />
          <Route path="/devices" element={
            <Devices
              connectedDeviceNames={connectedDeviceNames}
              onConnectedDevicesChange={handleSetConnectedDeviceNames}
            />
          } />
          <Route path="/session" element={
            <SessionPage
              availableBoards={connectedDeviceNames}
              onViewChange={handleViewChange}
              onInitialBoardConsumed={handleInitialBoardConsumedInApp}
              // User related props for SessionPage
              usersForDropdown={usersForSessionDropdown}
              currentSelectedUserId={selectedUserId}
              onSelectUserInSession={setSelectedUserId} // Pass the setter directly
            />
          } />
          <Route path="/users" element={
            <UsersPage
              // User related props for UsersPage
              allUsers={users}
              setAllUsers={setUsers}
              currentSelectedUserId={selectedUserId}
              setCurrentSelectedUserId={setSelectedUserId}
            />
          } />
          <Route path="/activities" element={<Activities />} />
          <Route path="*" element={<div>Page not found</div>} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;