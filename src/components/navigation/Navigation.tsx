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

interface MenuItemProps {
  id: string;
  label: string;
  icon: string;
  isActive?: boolean;
  isDisabled?: boolean;
  onClick: () => void;
}

function MenuItem({
                    id,
                    label,
                    icon,
                    isActive = false,
                    isDisabled = false,
                    onClick,
                  }: MenuItemProps) {
  return (
    <button
      className={clsx(
        "menu-item flex flex-col items-center",
        id,
        isActive && "active",
        isDisabled
          ? "disabled cursor-not-allowed opacity-65"
          : "cursor-pointer group"
      )}
      onClick={onClick}
      disabled={isDisabled}
      title={label}
    >
  <span
    className={clsx(
      "menu-item-icon flex size-7 items-center",
      isActive && "bg-(--red-dark) rounded-xl w-15 p-2",
      !isActive &&
      !isDisabled &&
      "group-hover:bg-(--red-dark) group-hover:rounded-xl group-hover:w-15 group-hover:p-2"
    )}
  >
    <img src={icon} className={"object-contain"} />
  </span>
      <span className="text-white">{label}</span>
    </button>
  );
}

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
      <div className={"flex grow flex-col gap-3"}>
        {menuItems.map((item) => (
          <MenuItem
            key={item.id}
            id={item.id}
            label={item.label}
            icon={item.icon}
            isActive={activeView === item.id}
            isDisabled={hasOngoingSession}
            onClick={() => onViewChange(item.id)}
          />
        ))}
      </div>
      <div className="flex flex-col mb-8">
        {/* Settings */}
        <MenuItem
          id="settings"
          label="Settings"
          icon={settingsIcon}
          isActive={settingsOpen}
          isDisabled={hasOngoingSession}
          onClick={handleSettingsClick}
        />
      </div>

      {/* Settings Popup */}
      <Settings isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </nav>
  );
}

export default Navigation;
export { sessionIcon, replayIcon, devicesIcon, activitiesIcon };
