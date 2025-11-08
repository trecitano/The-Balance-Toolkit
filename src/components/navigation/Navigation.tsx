import { useState } from "react";
import logo from "@/assets/logo/logo-flamingo-white.svg";
import homeIcon from "@/assets/home-icon.svg";
import devicesIcon from "@/assets/wbb-top-bold.svg";
import usersIcon from "@/assets/users-icon.svg";
import sessionIcon from "@/assets/session-icon.svg";
import replayIcon from "@/assets/replay-icon.svg";
import settingsIcon from "@/assets/settings-icon.svg";
import activitiesIcon from "@/assets/activities-icon.svg";
import Settings from "@/components/settings/Settings.tsx";
import "./Navigation.css";
import clsx from "clsx";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SESSION_QUERY_KEY, SessionQueryData } from "@/pages/session/session/SessionPage.tsx";

interface NavigationProps {
  activeView: string;
  onViewChange: (view: string) => void;
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

function Navigation({ activeView, onViewChange }: NavigationProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: hasOngoingSession = false } = useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: async () => {
      return queryClient.getQueryData<SessionQueryData>(SESSION_QUERY_KEY);
    },
    enabled: false, // don’t fetch, just subscribe
    initialData: () => queryClient.getQueryData(SESSION_QUERY_KEY),
    select: (d: SessionQueryData | undefined) => d?.sessionInformation?.hasOngoingSession ?? false,
  });

  const handleSettingsClick = () => {
    if (!hasOngoingSession) {
      setSettingsOpen(true);
    }
  };

  return (
    <nav className={"flex w-22 shrink-0 flex-col justify-between gap-10 bg-(--red)"}>
      <img src={logo} className="mx-auto mt-5 size-15 object-contain" />
      <ul className={"flex grow flex-col gap-3"}>
        {menuItems.map((item) => (
          <li
            key={item.id}
            className={clsx(
              "menu-item",
              item.id,
              activeView === item.id && "active",
              hasOngoingSession && "disabled cursor-not-allowed opacity-65",
            )}
            onClick={() => {
              if (!hasOngoingSession) {
                onViewChange(item.id);
              }
            }}
          >
            <span className="menu-item-icon">
              <img src={item.icon} alt={item.label} />
            </span>
            <span className="text-white">{item.label}</span>
          </li>
        ))}
      </ul>
      <div className="mb-10">
        {/* Settings */}
        <button
          className={clsx("menu-item", hasOngoingSession && "disabled cursor-not-allowed opacity-65")}
          title="Settings"
          onClick={handleSettingsClick}
        >
          <span className="menu-item-icon">
            <img src={settingsIcon} alt="Settings" />
          </span>
          <span className="text-white">Settings</span>
        </button>
      </div>

      {/* Settings Popup */}
      <Settings isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </nav>
  );
}

export default Navigation;
export { sessionIcon, replayIcon, devicesIcon, activitiesIcon };
