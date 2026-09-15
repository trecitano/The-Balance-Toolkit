import { useState } from "react";
import { NavLink } from "react-router-dom";
import clsx from "clsx";
import { useQuery } from "@tanstack/react-query";
import logo from "@/assets/logo/logo-flamingo-white.svg";
import {
  activitiesIcon,
  devicesIcon,
  homeIcon,
  replayIcon,
  sessionIcon,
  settingsIcon,
  usersIcon,
} from "@/assets/icons";
import Settings from "@/components/modals/SettingsModal.tsx";
import { SessionQuery } from "@/queries/toolkit";
import "./Navigation.css";

const menuItems = [
  { to: "/", label: "Home", icon: homeIcon },
  { to: "/users", label: "Users", icon: usersIcon },
  { to: "/devices", label: "Devices", icon: devicesIcon },
  { to: "/session", label: "Session", icon: sessionIcon },
  { to: "/replay", label: "Replay", icon: replayIcon },
  { to: "/activities", label: "Activities", icon: activitiesIcon },
];

function menuItemClass(isActive: boolean, isDisabled: boolean) {
  return clsx(
    "menu-item flex flex-col items-center",
    isActive && "active",
    isDisabled ? "disabled cursor-not-allowed opacity-65" : "group cursor-pointer",
  );
}

function MenuItemBody({
  icon,
  label,
  isActive,
  isDisabled,
}: {
  icon: string;
  label: string;
  isActive: boolean;
  isDisabled: boolean;
}) {
  return (
    <>
      <div
        className={clsx(
          "menu-item-icon flex size-12 items-center transition-all",
          !isActive && "scale-50",
          isActive && "rounded-xl bg-(--red-dark) p-2",
          !isActive &&
            !isDisabled &&
            "group-hover:scale-100 group-hover:rounded-xl group-hover:bg-(--red-dark) group-hover:p-2",
        )}
      >
        <img alt="" src={icon} className="object-contain" />
      </div>
      <div className="text-white">{label}</div>
    </>
  );
}

export default function Navigation() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { data: hasOngoingSession = false } = useQuery({
    ...SessionQuery,
    select: (data) => data.sessionInformation.hasOngoingSession,
  });

  return (
    <nav className="flex w-22 shrink-0 flex-col justify-between gap-10 bg-(--red)">
      <img alt="The Balance Toolkit" src={logo} className="mx-auto mt-5 size-15 object-contain" />
      <div className="flex grow flex-col gap-2">
        {menuItems.map((item) => (
          // `end` keeps Home from matching every path; the other items stay lit on nested
          // routes such as /activities/:id.
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            title={item.label}
            aria-disabled={hasOngoingSession || undefined}
            tabIndex={hasOngoingSession ? -1 : undefined}
            onClick={(event) => {
              if (hasOngoingSession) event.preventDefault();
            }}
            className={({ isActive }) => menuItemClass(isActive, hasOngoingSession)}
          >
            {({ isActive }) => (
              <MenuItemBody icon={item.icon} label={item.label} isActive={isActive} isDisabled={hasOngoingSession} />
            )}
          </NavLink>
        ))}
      </div>
      <div className="mb-8 flex flex-col">
        <button
          type="button"
          className={menuItemClass(settingsOpen, hasOngoingSession)}
          onClick={() => setSettingsOpen(true)}
          disabled={hasOngoingSession}
          title="Settings"
        >
          <MenuItemBody icon={settingsIcon} label="Settings" isActive={settingsOpen} isDisabled={hasOngoingSession} />
        </button>
      </div>

      <Settings isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </nav>
  );
}
