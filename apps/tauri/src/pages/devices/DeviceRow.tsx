import { useRef } from "react";
import { NintendoDevice } from "@/types";
import wbbIcon from "@/assets/wbb-top-white.svg";
import wbbIconBlue from "@/assets/wbb-top-blue.png";
import { ToolkitButton } from "@/components/ToolkitButton.tsx";
import { convertNumberToMacAddress } from "@/utils/macAddress.ts";
import { formatRelativeDay } from "@/utils/dates.ts";
import clsx from "clsx";

interface DeviceRowProps {
  device: NintendoDevice;
  isEditing: boolean;
  /** Selected for the next session. Distinct from `device.isConnected`, the Bluetooth link. */
  inSession: boolean;
  cannotJoin: boolean;
  busy: boolean;
  onStartRename: () => void;
  onRename: (name: string) => void;
  onCancelRename: () => void;
  onIdentify: () => void;
  onCalibrate: () => void;
  onJoinSession: () => void;
  onLeaveSession: () => void;
  onRemove: () => void;
}

export default function DeviceRow({
  device,
  isEditing,
  inSession,
  cannotJoin,
  busy,
  onStartRename,
  onRename,
  onCancelRename,
  onIdentify,
  onCalibrate: _onCalibrate, // Calibration is not available yet; see the commented button below.
  onJoinSession,
  onLeaveSession,
  onRemove,
}: DeviceRowProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  // Enter commits and then the input loses focus; this stops the blur from committing twice.
  const committed = useRef(false);
  const commit = () => {
    if (committed.current) return;
    committed.current = true;
    onRename(inputRef.current?.value.trim() || device.name);
  };

  return (
    <div
      className={clsx(
        "relative flex min-h-23 items-center rounded-lg bg-(--light-accent) px-4 py-2",
        !device.isConnected && "opacity-70",
      )}
    >
      <button
        type="button"
        aria-label={`Forget ${device.name}`}
        title="Forget device"
        disabled={busy}
        onClick={onRemove}
        className="btn-danger absolute top-2 right-3 rounded px-1"
      >
        ✕
      </button>

      {/* Fixed width, wide enough for either status label, so the icon is centered in the same place with or without one. */}
      <div className="flex w-22 shrink-0 flex-col items-center">
        <img src={device.isConnected ? wbbIconBlue : wbbIcon} alt="" className="size-10 object-contain" />

        {inSession ? (
          <div className="rounded-lg bg-(--secondary) px-2 py-1 text-sm text-white">In session</div>
        ) : (
          !device.isConnected && <div className="text-sm text-(--text-lighter)">Disconnected</div>
        )}
      </div>

      <div className="ml-4 flex flex-col justify-center">
        {isEditing ? (
          <div className="flex">
            <input
              ref={inputRef}
              type="text"
              aria-label="Device name"
              defaultValue={device.name}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") {
                  committed.current = true;
                  onCancelRename();
                }
              }}
              onBlur={commit}
              className="px-2 py-1"
            />
          </div>
        ) : (
          <div>
            <span className="font-semibold" title={device.name}>
              {device.name}
            </span>
            <button
              type="button"
              className="cursor-pointer text-(--text-light)"
              onClick={() => {
                committed.current = false;
                onStartRename();
              }}
              title="Edit name"
              aria-label={`Rename ${device.name}`}
            >
              ✎
            </button>
          </div>
        )}
        <div className="text-(--text-lighter)">
          {device.isConnected
            ? `MAC: ${convertNumberToMacAddress(device.macAddress)}`
            : `Last seen: ${formatRelativeDay(device.lastConnected)}`}
        </div>
      </div>

      <div className="mr-5 ml-auto flex h-10 flex-row gap-5">
        <ToolkitButton
          disabled={!device.isConnected || busy}
          type="button"
          className="text-sm"
          shape="circle"
          color="white"
          onClick={onIdentify}
        >
          ID
        </ToolkitButton>
        {/* Feature not available for now.
        <ToolkitButton disabled={!device.isConnected || busy} type="button" className="text-sm" shape="circle" color="white" onClick={_onCalibrate}>
          Calibrate
        </ToolkitButton>
        */}
        {!inSession ? (
          <ToolkitButton type="button" color="blue" onClick={onJoinSession} disabled={cannotJoin || busy}>
            Add to session
          </ToolkitButton>
        ) : (
          <ToolkitButton type="button" color="red" onClick={onLeaveSession} disabled={busy}>
            Remove from session
          </ToolkitButton>
        )}
      </div>
    </div>
  );
}
