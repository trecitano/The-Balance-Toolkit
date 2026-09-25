import { BrowserRouter, Routes, Route, useLocation, Outlet } from "react-router-dom";
import Navigation from "@/components/navigation/Navigation";
import Home from "@/pages/home/Home.tsx";
import DevicesPage from "@/pages/devices/Devices";
import UsersPage from "@/pages/users/Users";
import SessionPage from "@/pages/session/session/SessionPage.tsx";
import ReplayPage from "@/pages/session/replay/ReplayPage.tsx";
import Activities from "@/pages/activities/Activities";
import ActivityPopup from "./pages/session-activity-pop-up/activityPopup.tsx";
import "./App.css";
import { QueryClient, QueryClientProvider, usePrefetchQuery } from "@tanstack/react-query";
import { SettingsQuery, DevicesQuery } from "@/queries/toolkit";
import { ToolkitEvents } from "@/services/ToolkitEvents";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";

function DefaultLayout() {
  const location = useLocation();
  usePrefetchQuery(SettingsQuery);
  usePrefetchQuery(DevicesQuery);

  return (
    <div className="flex flex-row">
      <Navigation />
      <main className="h-screen min-h-120 min-w-346 grow overflow-auto bg-(--bg-primary) px-20 py-8">
        <PageErrorBoundary key={location.pathname}>
          <Outlet />
        </PageErrorBoundary>
      </main>
    </div>
  );
}

function BareLayout() {
  const location = useLocation();
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-(--bg-primary)">
      <PageErrorBoundary key={location.pathname}>
        <Outlet />
      </PageErrorBoundary>
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    // Every query is a local IPC command: a failure is a bug or a dead board, not a flaky
    // network, so retrying only delays the error UI by several seconds.
    queries: { retry: false },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToolkitEvents />
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
