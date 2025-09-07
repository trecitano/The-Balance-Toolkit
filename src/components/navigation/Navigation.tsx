import { useState } from "react";
import logo from "@/assets/logo/logo-flamingo-white.svg";
import homeIcon from "@/assets/home-icon.svg";
import devicesIcon from "@/assets/wbb-top-white.svg";
import usersIcon from "@/assets/users-icon.svg";
import sessionIcon from "@/assets/session-icon.svg";
import replayIcon from "@/assets/replay-icon.svg";
import settingsIcon from "@/assets/settings-icon.svg";
import activitiesIcon from "@/assets/activities-icon.svg";
import Settings from "@/components/settings/Settings.tsx";
import "./Navigation.css";
import clsx from "clsx";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {SESSION_QUERY_KEY, SessionQueryData} from "@/pages/session/session/SessionPage.tsx";

interface NavigationProps {
  activeView: string;
  onViewChange: (view: string) => void;
  className?: string;
}

type MenuItemType = {
  id: string;
  label: string;
  icon: string;
};

const menuItems: MenuItemType[] = [
  { id: "home", label: "Home", icon: homeIcon },
  { id: "users", label: "Users", icon: usersIcon },
  { id: "devices", label: "Devices", icon: devicesIcon },
  { id: "session", label: "Session", icon: sessionIcon },
  { id: "replay", label: "Replay", icon: replayIcon },
  { id: "activities", label: "Activities", icon: activitiesIcon },
];

function Navigation({ activeView, onViewChange, className }: NavigationProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: hasOngoingSession = false } = useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: async () => {
      return queryClient.getQueryData<SessionQueryData>(SESSION_QUERY_KEY);
    },
    enabled: false, // don’t fetch, just subscribe
    initialData: () => queryClient.getQueryData(SESSION_QUERY_KEY),
    select: (d: SessionQueryData | undefined) =>
      d?.sessionInformation?.hasOngoingSession ?? false,
  });

  const handleSettingsClick = () => {
    if (!hasOngoingSession) {
      setSettingsOpen(true);
    }
  };

  return (
    <nav
      className={clsx(
        "menu-bar menu-bar--active box-border flex h-screen min-w-[50px] flex-col justify-between border-r border-r-[var(--border-primary)] bg-[var(--red)] p-0 shadow-[2px_0_10px_rgba(0,0,0,0.04)]",
        className,
      )}
    >
      <div>
        <img src={logo} alt="Logo" className="mt-3 mx-auto size-13 object-contain" />
        <div className="menu-container">
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {menuItems.map((item) => (
              <li
                key={item.id}
                className={clsx("menu-item", item.id, activeView === item.id && "active", hasOngoingSession && "opacity-65")}
                onClick={() => {
                  if (!hasOngoingSession) {
                    onViewChange(item.id);
                  }
                }}
              >
                <span className="menu-item-icon">
                  <img src={item.icon} alt={item.label} className="nav-icon" />
                </span>
                <span className="menu-item-text">{item.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="menu-bottom">
        {/* Settings */}
        <button className="menu-item settings unstyled-button" title="Settings" onClick={handleSettingsClick}>
          <span className="menu-item-icon">
            <img src={settingsIcon} alt="Settings" className="nav-icon-sm" />
          </span>
          <span className="menu-item-text">Settings</span>
        </button>
      </div>

      {/* Settings Popup */}
      <Settings isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </nav>
  );
}

export default Navigation;
