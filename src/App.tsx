import React, { useState, useEffect, useCallback } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  useNavigate,
  useLocation,
} from "react-router-dom";
import Navigation from "@/components/navigation/Navigation";
import Home from "@/pages/home/Home";
import DevicesPage from "@/pages/devices/Devices";
import UsersPage from "@/pages/users/Users";
import Session from "@/pages/session/Session";
import Activities from "@/pages/activities/Activities";
import { UserType, Device } from "./types";
import { commands } from "@/utils/requests";
import "./App.css";
import {QueryClient, QueryClientProvider, useQuery} from "@tanstack/react-query";

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const {data, isLoading, error} = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const [users, devices] = await Promise.all([
        commands.users.fetchUsers(),
        commands.devices.fetchDevices()
      ]);
      return { users, devices };
    },
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    console.log(error);
    return <div>Error: {error.message}</div>;
  }

  if (!data) {
    return <div>No data found!</div>;
  }

  const { users, devices } = data ?? {};

  useEffect(() => {
    if (selectedUserId) {
      localStorage.setItem("selectedUserId", selectedUserId);
    }
  }, [selectedUserId]);

  const connectedDeviceNames = devices
    .filter((device) => device.status === "Connected")
    .map((device) => device.name);

  const handleConnectDevice = async (macAddress: string) => {
    setConnectingDeviceMacAddresses((prev) => [...prev, macAddress]);

    await commands.devices.connectDevice(macAddress);

    await new Promise((resolve) => setTimeout(resolve, 1000));
    setDevices((prevDevices) =>
      prevDevices.map((device) =>
        device.macAddress === macAddress
          ? {
              ...device,
              status: "Connected",
              lastConnected: new Date().toISOString(),
            }
          : device,
      ),
    );
    setConnectingDeviceMacAddresses((prev) =>
      prev.filter((id) => id !== macAddress),
    );
  };


  const handleRemoveDevice = (deviceId: number) => {
    setDevices((prev) => prev.filter((device) => device.id !== deviceId));
  };

  const handleScanResults = (scannedDevices: Device[]) => {
    setDevices((prevDevices) => {
      const existingIds = new Set(prevDevices.map((d) => d.id));
      const newDevicesFromScan = scannedDevices.filter(
        (sd) => !existingIds.has(sd.id),
      );

      const updatedDevices = prevDevices.map((pd) => {
        const scannedVersion = scannedDevices.find((sd) => sd.id === pd.id);
        return scannedVersion
          ? {
              ...pd,
              ...scannedVersion,
              status: scannedVersion.status || pd.status,
            }
          : pd;
      });

      return [...updatedDevices, ...newDevicesFromScan];
    });
  };

  const handleInitialBoardConsumedInApp = useCallback(() => {}, []);

  const handleViewChange = (view: string) => {
    const targetPath = `/${view === "home" ? "" : view}`;
    if (location.pathname !== targetPath) {
      navigate(targetPath);
    }
  };

  const usersForSessionDropdown = users.map((user) => ({
    id: user.id,
    name: user.name,
    color: user.color,
  }));

  return (
    <div className={`app`}>
      <Navigation
        activeView={location.pathname.substring(1) || "home"}
        onViewChange={handleViewChange}
      />
      <main className="main-page">
        <Routes>
          <Route path="/" element={<Home onViewChange={handleViewChange} />} />
          <Route
            path="/devices"
            element={
              <DevicesPage
                devices={devices}
                setDevices={setDevices}
                devicesWithActiveSessions={[]}
                onScanResults={handleScanResults}
              />
            }
          />
          <Route
            path="/session"
            element={
              <Session
                availableBoards={connectedDeviceNames}
                onViewChange={handleViewChange}
                onInitialBoardConsumed={handleInitialBoardConsumedInApp}
                usersForDropdown={usersForSessionDropdown}
                currentSelectedUserId={selectedUserId}
                onSelectUserInSession={setSelectedUserId}
              />
            }
          />
          <Route
            path="/users"
            element={
              <UsersPage
                allUsers={users}
                setAllUsers={setUsers}
                currentSelectedUserId={selectedUserId}
                setCurrentSelectedUserId={setSelectedUserId}
              />
            }
          />
          <Route path="/activities" element={<Activities />} />
          <Route path="*" element={<div>Page not found</div>} />
        </Routes>
      </main>
    </div>
  );
}

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
