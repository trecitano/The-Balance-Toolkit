import React, { useState, useEffect, useCallback } from "react";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import Navigation from "./components/common/Navigation/Navigation";
import Home from "./pages/Home/Home";
import DevicesPage from "./pages/Devices/Devices";
import UsersPage from "./pages/Users/Users";
import SessionPage from "./pages/Session/Session";
import Activities from "./pages/Activities/Activities";
import lightIcon from "./assets/light-icon.svg";
import darkIcon from "./assets/dark-icon.svg";
import { UserType, initialUsersData, Device } from "./types";
import "./App.css";

const fetchInitialDeviceData = async (): Promise<Device[]> => {
  return [
    { id: 1, name: "Nintendo RVL-WBC-01", status: "Connected", mac: "00:1A:7D:DA:71:13", battery: 85, temperature: 22, firmware: "v1.2.3", lastConnected: "2023-10-01T10:00:00Z" },
    { id: 2, name: "Nintendo RVL-WBC-02", status: "Connected", mac: "00:1A:7D:DA:71:14", battery: 26, temperature: 23, firmware: "v1.2.4", lastConnected: "2023-10-05T11:00:00Z" },
    { id: 3, name: "Generic Board X", status: "Disconnected", mac: "00:1A:7D:DA:71:15", battery: 0, temperature: 20, firmware: "v1.0.0", lastConnected: "2023-09-15T12:00:00Z" },
  ];
};

function AppContent() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const navigate = useNavigate();
  const location = useLocation();

  const [users, setUsers] = useState<UserType[]>(initialUsersData);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(
    initialUsersData.find(u => u.id === "User-123")?.id || initialUsersData[0]?.id || null
  );

  const [devices, setDevices] = useState<Device[]>([]);
  const [editingDeviceId, setEditingDeviceId] = useState<number | null>(null);
  const [editingDeviceName, setEditingDeviceName] = useState<string>("");
  const [connectingDeviceIds, setConnectingDeviceIds] = useState<number[]>([]);
  const [disconnectingDeviceIds, setDisconnectingDeviceIds] = useState<number[]>([]);

  useEffect(() => {
    const loadInitialData = async () => {
      const initialDevices = await fetchInitialDeviceData();
      setDevices(initialDevices);
    };
    loadInitialData();
  }, []);

  const connectedDeviceNames = devices
    .filter(device => device.status === "Connected")
    .map(device => device.name);

  const handleConnectDevice = async (deviceId: number) => {
    setConnectingDeviceIds(prev => [...prev, deviceId]);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setDevices(prevDevices =>
      prevDevices.map(device =>
        device.id === deviceId
          ? { ...device, status: "Connected", lastConnected: new Date().toISOString() }
          : device
      )
    );
    setConnectingDeviceIds(prev => prev.filter(id => id !== deviceId));
  };

  const handleDisconnectDevice = async (deviceId: number) => {
    setDisconnectingDeviceIds(prev => [...prev, deviceId]);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setDevices(prevDevices =>
      prevDevices.map(device =>
        device.id === deviceId ? { ...device, status: "Active" } : device // Or "Disconnected" based on logic
      )
    );
    setDisconnectingDeviceIds(prev => prev.filter(id => id !== deviceId));
  };

  const handleSaveDeviceName = (deviceId: number, newName: string) => {
    setDevices(prevDevices =>
      prevDevices.map(d =>
        d.id === deviceId ? { ...d, name: newName.trim() || `Device ${d.id}` } : d
      )
    );
    setEditingDeviceId(null);
    setEditingDeviceName("");
  };

  const handleRemoveDevice = (deviceId: number) => {
    setDevices(prev => prev.filter(device => device.id !== deviceId));
  };
  
  const handleScanResults = (scannedDevices: Device[]) => {
    setDevices(prevDevices => {
      const existingIds = new Set(prevDevices.map(d => d.id));
      const newDevicesFromScan = scannedDevices.filter(sd => !existingIds.has(sd.id));
      
      const updatedDevices = prevDevices.map(pd => {
        const scannedVersion = scannedDevices.find(sd => sd.id === pd.id);
        return scannedVersion ? { ...pd, ...scannedVersion, status: scannedVersion.status || pd.status } : pd;
      });
      
      return [...updatedDevices, ...newDevicesFromScan];
    });
  };


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

  const usersForSessionDropdown = users.map(user => ({
    id: user.id,
    name: user.name,
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
            <DevicesPage
              devices={devices}
              setDevices={setDevices}
              editingDeviceId={editingDeviceId}
              setEditingDeviceId={setEditingDeviceId}
              editingDeviceName={editingDeviceName}
              setEditingDeviceName={setEditingDeviceName}
              connectingDeviceIds={connectingDeviceIds}
              setConnectingDeviceIds={setConnectingDeviceIds}
              disconnectingDeviceIds={disconnectingDeviceIds}
              setDisconnectingDeviceIds={setDisconnectingDeviceIds}
              onConnectDevice={handleConnectDevice}
              onDisconnectDevice={handleDisconnectDevice}
              onSaveDeviceName={handleSaveDeviceName}
              onRemoveDevice={handleRemoveDevice}
              onScanResults={handleScanResults}
            />
          } />
          <Route path="/session" element={
            <SessionPage
              availableBoards={connectedDeviceNames}
              onViewChange={handleViewChange}
              onInitialBoardConsumed={handleInitialBoardConsumedInApp}
              usersForDropdown={usersForSessionDropdown}
              currentSelectedUserId={selectedUserId}
              onSelectUserInSession={setSelectedUserId}
            />
          } />
          <Route path="/users" element={
            <UsersPage
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