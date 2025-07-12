import React, { useState, useEffect, useCallback } from "react";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import Navigation from "@/components/navigation/Navigation";
import Home from "@/pages/home/Home";
import DevicesPage from "@/pages/devices/Devices";
import UsersPage from "@/pages/users/Users";
import Session from "@/pages/session/Session";
import Activities from "@/pages/activities/Activities";
import { commands } from "@/utils/requests";
import "./App.css";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedUserId) {
      localStorage.setItem("selectedUserId", selectedUserId);
    }
  }, [selectedUserId]);

  const handleInitialBoardConsumedInApp = useCallback(() => {}, []);

  const { data, isLoading, error } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const [users, devices] = await Promise.all([
        commands.users.fetchUsers(),
        commands.devices.fetchDevices(),
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

  const { users, devices } = data;

  const connectedDeviceNames = devices
    .filter((device) => device.status === "Connected")
    .map((device) => device.name);

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
          <Route path="/devices" element={<DevicesPage />} />
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

const queryClient = new QueryClient();

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
