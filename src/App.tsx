import React from "react";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import Navigation from "@/components/navigation/Navigation";
import Home from "@/pages/home/Home.tsx";
import DevicesPage, { DevicesQuery } from "@/pages/devices/Devices";
import UsersPage from "@/pages/users/Users";
import Session from "@/pages/session/Session";
import Activities from "@/pages/activities/Activities";
import "./App.css";
import {QueryClient, QueryClientProvider, usePrefetchQuery} from "@tanstack/react-query";

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleViewChange = (view: string) => {
    const targetPath = `/${view === "home" ? "" : view}`;
    if (location.pathname !== targetPath) {
      navigate(targetPath);
    }
  };

  usePrefetchQuery(DevicesQuery)

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
          <Route path="/session" element={<Session/>}/>
          <Route path="/users" element={<UsersPage /> }/>
          <Route path="/activities" element={<Activities />} />
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
