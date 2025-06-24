import { useState, useEffect, useCallback } from "react";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import Navigation from "@/components/navigation/Navigation";
import Home from "@/pages/home/Home";
import DevicesPage from "@/pages/devices/Devices";
import UsersPage from "@/pages/users/Users";
import Session from "@/pages/session/Session";
import Activities from "@/pages/activities/Activities";
import { UserType, Device } from "./types";
import { commands } from "@/utils/requests"
import "./App.css";

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();

  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [users, setUsers] = useState<UserType[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [editingDeviceId, setEditingDeviceId] = useState<number | null>(null);
  const [editingDeviceName, setEditingDeviceName] = useState<string>("");
  const [connectingDeviceIds, setConnectingDeviceIds] = useState<number[]>([]);
  const [disconnectingDeviceIds, setDisconnectingDeviceIds] = useState<number[]>([]);

  useEffect(() => {
    const fetchUsers = async () => {
      const users = await commands.fetchUsers()
      setUsers(users);
    }

    void fetchUsers();
  }, []);

  useEffect(() => {
    const loadInitialData = async () => {
      const initialDevices = await commands.fetchDevices();
      setDevices(initialDevices);
    };

    void loadInitialData();
  }, []);

  
  useEffect(() => {
    if (selectedUserId) {
      localStorage.setItem('selectedUserId', selectedUserId);
    }
  }, [selectedUserId]);

  const connectedDeviceNames = devices
    .filter(device => device.status === "Connected")
    .map(device => device.name);

  const handleConnectDevice = async (deviceId: number) => {
    setConnectingDeviceIds(prev => [...prev, deviceId]);
    
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
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    setDevices(prevDevices =>
      prevDevices.map(device =>
        device.id === deviceId ? { ...device, status: "Active" } : device 
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


  const handleInitialBoardConsumedInApp = useCallback(() => {
    
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
            <Session
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