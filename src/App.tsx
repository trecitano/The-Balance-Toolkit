import React, { useState, useEffect, useCallback } from "react";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import Navigation from "./components/common/Navigation/Navigation";
import Home from "./pages/Home/Home";
import Devices from "./pages/Devices/Devices";
import Users from "./pages/Users/Users";
import Session from "./pages/Session/Session";
import Activities from "./pages/Activities/Activities";
import lightIcon from "./assets/light-icon.svg";
import darkIcon from "./assets/dark-icon.svg";
import "./App.css";

interface Device {
  id: number;
  name: string;
  status: "Connected" | "Active" | "Disconnected" | string;
  [key: string]: any;
}

const fetchInitialDeviceData = async (): Promise<Device[]> => {
  console.log("[App.tsx] Simulating initial device data fetch...");
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

  useEffect(() => {
    const loadInitialData = async () => {
      const initialDevices = await fetchInitialDeviceData();
      const initiallyConnectedNames = initialDevices
        .filter(device => device.status === "Connected")
        .map(device => device.name);
      console.log("[App.tsx] Setting initial connectedDeviceNames:", initiallyConnectedNames);
      setConnectedDeviceNames(initiallyConnectedNames);
    };
    loadInitialData();
  }, []);

  const handleSetConnectedDeviceNames = useCallback((names: string[]) => {
    console.log("[App.tsx] handleSetConnectedDeviceNames called by Devices.tsx with:", names);
    setConnectedDeviceNames(names);
  }, []);

  useEffect(() => {
    console.log("[App.tsx] connectedDeviceNames state updated to:", connectedDeviceNames);
  }, [connectedDeviceNames]);

  useEffect(() => {
    document.documentElement.className = `${theme}-theme`;
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  const handleInitialBoardConsumedInApp = useCallback(() => {
    console.log("[App.tsx] Initial board consumed signal received by App.");
  }, []);

  const handleViewChange = (view: string) => {
    const targetPath = `/${view === "home" ? "" : view}`;
    if (location.pathname !== targetPath) {
      navigate(targetPath);
    }
  };

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
            <Session
              availableBoards={connectedDeviceNames}
              onViewChange={handleViewChange}
              onInitialBoardConsumed={handleInitialBoardConsumedInApp}
            />
          } />
          <Route path="/users" element={<Users />} />
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