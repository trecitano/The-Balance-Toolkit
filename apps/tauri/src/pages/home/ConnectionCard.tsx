import clsx from "clsx";
import { Link } from "react-router-dom";
import wbbIcon from "@/assets/wbb-top-white.svg";
import wbbIconLed from "@/assets/wbb-top-white-blink.svg";
import wbbIconBlue from "@/assets/wbb-top-blue.png";
import { devicesIcon, sessionIcon } from "@/assets/icons";
import { ToolkitButton } from "@/components/ToolkitButton.tsx";
import PageSubtitle from "@/components/PageSubtitle.tsx";
import { NintendoDevice } from "@/types.ts";
import { convertNumberToMacAddress } from "@/utils/macAddress.ts";
import { formatRelativeDay, sortDevices } from "@/utils/devices.ts";
import { tile } from "@/pages/home/tile.ts";

// The Connection card: the board's state up top, then every known board (connected ones first)
// with when each was last seen, and the next thing to do to get to a session.

export type ConnectionProps = {
  devices: NintendoDevice[];
  /** MAC addresses of the boards selected for the next session. */
  selected: number[];
  isScanning: boolean;
};

type State = "none" | "asleep" | "connected";

const SHOWN = 4;

/**
 * The original board pictures, with a little life: rings while connected, a blinking light while
 * waiting. The animations only run when the system allows motion.
 */
function BoardArt({ state, className }: { state: State; className?: string }) {
  return (
    <div className={clsx("relative flex items-center justify-center", className)}>
      {state === "connected" ? (
        <>
          <span className="absolute aspect-square w-3/4 rounded-full border-2 border-(--primary)/30 motion-safe:animate-ping motion-safe:[animation-duration:2.4s]" />
          <span className="absolute aspect-square w-[95%] rounded-full bg-[radial-gradient(circle,#e3edf8_0%,transparent_70%)]" />
          <img alt="" src={wbbIconBlue} draggable={false} className="relative max-h-full w-3/4 object-contain" />
        </>
      ) : (
        <div className="relative w-3/4">
          <img
            alt=""
            src={wbbIcon}
            draggable={false}
            className={clsx("w-full object-contain", state === "asleep" && "opacity-35")}
          />
          {state === "none" && (
            <img
              alt=""
              src={wbbIconLed}
              draggable={false}
              className="absolute inset-0 w-full object-contain motion-safe:animate-pulse motion-safe:[animation-duration:1.2s]"
            />
          )}
        </div>
      )}
    </div>
  );
}

const pillTone = {
  none: "bg-gray-100 text-gray-600",
  asleep: "bg-(--accent-light) text-[#7a6100]",
  connected: "bg-[#e3f4ea] text-[#1f7a43]",
  scanning: "bg-(--primary-light) text-(--primary-dark)",
};

function StatusPill({ tone, label }: { tone: keyof typeof pillTone; label: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        pillTone[tone],
      )}
    >
      <span
        className={clsx(
          "size-1.5 rounded-full bg-current",
          (tone === "connected" || tone === "scanning") && "motion-safe:animate-pulse",
        )}
      />
      {label}
    </span>
  );
}

const noteTone = {
  amber: "bg-(--accent-light) text-[#6b5500]",
  blue: "bg-(--primary-light) text-(--primary-dark)",
};

// The one thing to do next, as a short note above the buttons.
function Note({ tone, children }: { tone: keyof typeof noteTone; children: string }) {
  return <p className={clsx("rounded-lg px-3 py-2 text-sm font-medium", noteTone[tone])}>{children}</p>;
}

// With no board found, the usual reasons in the order to check them. The Wii Balance Board's
// Sync button sits in its battery compartment.
const PAIRING_STEPS = ["Turn on Bluetooth on this computer", "Press Sync in the battery cover"];

function PairingSteps() {
  return (
    <ol className="flex flex-col gap-2 rounded-lg bg-gray-100 p-3">
      {PAIRING_STEPS.map((step, index) => (
        <li key={step} className="flex items-center gap-2.5 text-sm text-gray-700">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-(--primary) shadow-sm">
            {index + 1}
          </span>
          {step}
        </li>
      ))}
    </ol>
  );
}

function shortMac(macAddress: number) {
  return convertNumberToMacAddress(macAddress).split(":").slice(-2).join(":");
}

// Worded as on the Devices page, so a board reads the same on both.
function lastSeenText(device: NintendoDevice) {
  return device.lastConnected ? `Last seen: ${formatRelativeDay(device.lastConnected)}` : "Not seen yet";
}

export default function ConnectionCard({ devices, selected, isScanning }: ConnectionProps) {
  const connected = devices.filter((device) => device.isConnected);
  const hasBoardInSession = connected.some((device) => selected.includes(device.macAddress));
  const state: State = devices.length === 0 ? "none" : connected.length === 0 ? "asleep" : "connected";
  const boards = sortDevices(devices);
  const hidden = boards.length - SHOWN;

  const pillTone = isScanning ? "scanning" : state;
  const pillLabel = {
    scanning: "Scanning…",
    none: "No board yet",
    asleep: "Board off",
    connected: connected.length === 1 ? "Connected" : `${connected.length} connected`,
  }[pillTone];

  return (
    <div className="flex h-full flex-col gap-4 p-(--space-sm)">
      <div className="flex items-center justify-between gap-3">
        <PageSubtitle>Connection</PageSubtitle>
        {devices.length > 0 && (
          <span className="text-xs font-semibold text-gray-500">
            {connected.length} of {devices.length} connected
          </span>
        )}
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center rounded-xl bg-(--bg-light)">
        <BoardArt state={state} className="h-full w-full max-w-72" />
        <span className="absolute top-3 left-3">
          <StatusPill tone={pillTone} label={pillLabel} />
        </span>
      </div>

      {boards.length > 0 && (
        <ul className="flex flex-col gap-2">
          {boards.slice(0, SHOWN).map((device) => {
            const isSelected = selected.includes(device.macAddress);
            return (
              <li key={device.macAddress}>
                {/* Each board opens the Devices page, where boards are selected for a session. */}
                <Link
                  to="/devices"
                  aria-label={`${device.name} ${shortMac(device.macAddress)}, open on the Devices page`}
                  className={clsx(tile, "items-center gap-3 bg-white px-3 py-2")}
                >
                  <span
                    className={clsx(
                      "size-2.5 shrink-0 rounded-full",
                      device.isConnected ? "bg-[#1f9d55] ring-4 ring-[#1f9d55]/15" : "bg-gray-300",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-gray-900" title={device.name}>
                      {device.name} <span className="font-normal text-gray-400">· {shortMac(device.macAddress)}</span>
                    </span>
                    <span className="block truncate text-xs text-gray-500">
                      {!device.isConnected
                        ? lastSeenText(device)
                        : isSelected
                          ? "Connected"
                          : "Connected, not selected"}
                    </span>
                  </span>
                  {isSelected && (
                    <span className="shrink-0 rounded-full bg-(--primary-light) px-2 py-0.5 text-[11px] font-semibold text-(--primary-dark)">
                      In session
                    </span>
                  )}
                  <span
                    aria-hidden="true"
                    className="shrink-0 text-gray-300 transition-colors group-hover:text-(--primary)"
                  >
                    ›
                  </span>
                </Link>
              </li>
            );
          })}
          {hidden > 0 && <li className="px-1 text-xs text-gray-500">+{hidden} more on the Devices page</li>}
        </ul>
      )}

      {isScanning && <Note tone="blue">Searching… press Sync on the board now.</Note>}
      {!isScanning && state === "none" && <PairingSteps />}
      {!isScanning && state === "asleep" && <Note tone="amber">Turn a board on and it will reconnect.</Note>}
      {!isScanning && state === "connected" && !hasBoardInSession && (
        <Note tone="blue">No board is selected for the next session yet.</Note>
      )}

      <div className="flex justify-end gap-3">
        {state === "none" && !isScanning ? (
          <ToolkitButton to="/devices" color="blue" iconUrl={devicesIcon}>
            Scan for boards →
          </ToolkitButton>
        ) : state === "connected" && !hasBoardInSession ? (
          <ToolkitButton to="/devices" color="blue" iconUrl={devicesIcon}>
            Select a board →
          </ToolkitButton>
        ) : (
          <ToolkitButton to="/devices" color="grey" iconUrl={devicesIcon}>
            Devices →
          </ToolkitButton>
        )}
        {hasBoardInSession && (
          <ToolkitButton to="/session" color="blue" iconUrl={sessionIcon}>
            Start a session →
          </ToolkitButton>
        )}
      </div>
    </div>
  );
}
