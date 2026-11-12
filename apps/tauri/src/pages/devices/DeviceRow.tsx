import { NintendoDevice } from "@/types";
import wbbIcon from "@/assets/wbb-top-white.svg";
import wbbIconBlue from "@/assets/wbb-top-blue.png";
import { ToolkitButton } from "@/components/ToolkitButton.tsx";
import { InputPrimitive } from "@/components/InputPrimitive.tsx";
import { convertNumberToMacAddress } from "@/utils/macAddress.ts";
import { formatRelativeDay } from "@/utils/dates.ts";
import { DEFAULT_BOARD_NAME } from "@/utils/devices.ts";
import clsx from "clsx";

interface DeviceRowProps {
  device: NintendoDevice;
  /** The name being typed while renaming, or null when not renaming. */
  typedName: string | null;
  /** Selected for the next session. Distinct from `device.isConnected`, the Bluetooth link. */
  inSession: boolean;
  cannotJoin: boolean;
  busy: boolean;
  onStartRename: () => void;
  onTypeName: (name: string) => void;
  onSaveName: (name: string) => void;
  onCancelRename: () => void;
  onIdentify: () => void;
  onCalibrate: () => void;
  onJoinSession: () => void;
  onLeaveSession: () => void;
  onRemove: () => void;
}

export default function DeviceRow({
  device,
  typedName,
  inSession,
  cannotJoin,
  busy,
  onStartRename,
  onTypeName,
  onSaveName,
  onCancelRename,
  onIdentify,
  onCalibrate: _onCalibrate, // Calibration is not available yet; see the commented button below.
  onJoinSession,
  onLeaveSession,
  onRemove,
}: DeviceRowProps) {
  const trimmedName = typedName?.trim() ?? "";

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
        <img src={device.isConnected ? wbbIconBlue : wbbIcon} alt="" className="w-18 object-contain" />

        {inSession ? (
          <div className="rounded-lg bg-(--secondary) px-2 py-1 text-sm text-white">In session</div>
        ) : (
          !device.isConnected && <div className="text-sm text-(--text-lighter)">Disconnected</div>
        )}
      </div>

      <div className="mx-4 flex min-w-0 flex-col justify-center">
        {typedName !== null ? (
          // Saved with the Save button or Enter, cancelled with Cancel or Escape. Clicking away
          // keeps the edit open, so the buttons next to the field can be used.
          <form
            className="flex flex-col items-start gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              if (trimmedName) onSaveName(trimmedName);
            }}
          >
            <div className="flex items-center gap-2">
              <InputPrimitive
                aria-label="Device name"
                value={typedName}
                autoFocus
                onChange={(e) => onTypeName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") onCancelRename();
                }}
                className="w-56"
              />
              <ToolkitButton type="submit" color="blue" size="sm" disabled={busy || !trimmedName}>
                Save
              </ToolkitButton>
              <ToolkitButton type="button" color="grey" size="sm" onClick={onCancelRename}>
                Cancel
              </ToolkitButton>
            </div>
            <button
              type="button"
              disabled={typedName === DEFAULT_BOARD_NAME}
              onClick={() => onTypeName(DEFAULT_BOARD_NAME)}
              className="cursor-pointer text-xs text-(--primary) hover:underline disabled:cursor-default disabled:text-(--text-lighter) disabled:no-underline"
            >
              Use default name ({DEFAULT_BOARD_NAME})
            </button>
          </form>
        ) : (
          <div>
            <span className="font-semibold" title={device.name}>
              {device.name}
            </span>
            <button
              type="button"
              className="ml-2 cursor-pointer text-(--text-light) hover:text-(--primary)"
              onClick={onStartRename}
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

      <div className="mr-5 ml-auto flex h-10 shrink-0 flex-row gap-5 whitespace-nowrap">
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
