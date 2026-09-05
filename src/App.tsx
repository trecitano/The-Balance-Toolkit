import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, useNavigate, useLocation, Outlet } from "react-router-dom";
import Navigation from "@/components/navigation/Navigation";
import Home from "@/pages/home/Home.tsx";
import { DevicesQuery } from "@/pages/devices/devicesQuery.ts";
import "./App.css";
import { QueryClient, QueryClientProvider, usePrefetchQuery } from "@tanstack/react-query";
import { SettingsQuery } from "@/components/modals/SettingsModal.tsx";

// Each page is its own chunk, so the plotting code (uPlot and the canvas overlays) only loads
// when a session or replay page is opened.
const DevicesPage = lazy(() => import("@/pages/devices/Devices"));
const UsersPage = lazy(() => import("@/pages/users/Users"));
const SessionPage = lazy(() => import("@/pages/session/session/SessionPage.tsx"));
const ReplayPage = lazy(() => import("@/pages/session/replay/ReplayPage.tsx"));
const Activities = lazy(() => import("@/pages/activities/Activities"));
const ActivityPopup = lazy(() => import("./pages/session-activity-pop-up/activityPopup.tsx"));

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
      <main className="h-screen min-h-120 min-w-330 grow bg-(--bg-primary) px-20 py-8 overflow-auto">
        <Suspense fallback={null}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}

function BareLayout() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-(--bg-primary)">
      <Suspense fallback={null}>
        <Outlet />
      </Suspense>
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
