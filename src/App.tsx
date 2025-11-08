import { BrowserRouter, Routes, Route, useNavigate, useLocation, Outlet } from "react-router-dom";
import Navigation from "@/components/navigation/Navigation";
import Home from "@/pages/home/Home.tsx";
import DevicesPage, { DevicesQuery } from "@/pages/devices/Devices";
import UsersPage from "@/pages/users/Users";
import SessionPage from "@/pages/session/session/SessionPage.tsx";
import ReplayPage from "@/pages/session/replay/ReplayPage.tsx";
import Activities from "@/pages/activities/Activities";
import "./App.css";
import { QueryClient, QueryClientProvider, usePrefetchQuery } from "@tanstack/react-query";
import { SettingsQuery } from "@/components/settings/Settings.tsx";
import ActivityPopup from "./pages/session-activity-pop-up/activityPopup.tsx";

function DefaultLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleViewChange = (view: string) => {
    const targetPath = `/${view === "home" ? "" : view}`;
    if (location.pathname !== targetPath) {
      navigate(targetPath);
    }
  };

  usePrefetchQuery(SettingsQuery);
  usePrefetchQuery(DevicesQuery);

  return (
    <div className="flex flex-row">
      <Navigation activeView={location.pathname.substring(1) || "home"} onViewChange={handleViewChange} />
      <main className="h-screen min-h-120 min-w-330 grow bg-(--bg-primary) px-20 py-8">
        <Outlet />
      </main>
    </div>
  );
}

function BareLayout() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-(--bg-primary)">
      <Outlet />
    </div>
  );
}

const queryClient = new QueryClient();
export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Routes with Navigation */}
          <Route element={<DefaultLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/devices" element={<DevicesPage />} />
            <Route path="/session" element={<SessionPage />} />
            <Route path="/replay" element={<ReplayPage />} />
            <Route path="/activities/:activityId?" element={<Activities />} />
          </Route>

          {/* Routes without Navigation */}
          <Route element={<BareLayout />}>
            <Route path="/session-activity-pop-up" element={<ActivityPopup />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
