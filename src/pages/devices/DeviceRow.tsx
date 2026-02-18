import { useRef } from "react";
import { Device } from "@/types";
import wbbIcon from "@/assets/wbb-top-white.svg";
import wbbIconBlue from "@/assets/wbb-top-blue.svg";
import { ToolkitButton } from "@/components/ToolkitButton.tsx";
import { convertNumberToMacAddress } from "@/pages/devices/Devices.tsx";
import clsx from "clsx";

interface DeviceRowProps {
  device: Device;
  isEditing: boolean;
  isSelected: boolean;
  cannotConnect: boolean;
  handleStartEditName: (deviceId: string) => void;
  handleSaveDeviceName: (macAddress: number, deviceName: string) => void;
  handleIdentifyClick: (device: Device) => void;
  handleCalibrationClick: (device: Device) => void;
  handleUnselectDevice: (macAddress: number) => void;
  handleRemoveDevice: (macAddress: number) => void;
  handleSelectDeviceForSession: (macAddress: number) => void;
}

export default function DeviceRow({
  device,
  isEditing,
  isSelected,
  cannotConnect,
  handleStartEditName,
  handleSaveDeviceName,
  handleIdentifyClick,
  //handleCalibrationClick,
  handleUnselectDevice,
  handleRemoveDevice,
  handleSelectDeviceForSession,
}: DeviceRowProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const formatLastConnected = (dateString: string | undefined) => {
    if (!dateString) return "N/A";
    const now = new Date();
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Invalid Date";
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffWeeks = Math.floor(diffDays / 7);

    const pad = (n: number) => n.toString().padStart(2, "0");
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());

    if (diffDays === 0) return `Today ${hours}:${minutes}`;
    if (diffDays === 1) return `Yesterday ${hours}:${minutes}`;
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffWeeks === 1) return `1 week ago`;
    if (diffWeeks < 5) return `${diffWeeks} weeks ago`;

    return date.toLocaleDateString();
  };

  return (
    <div
      className={clsx(
        "relative flex min-h-23 items-center rounded-lg bg-(--light-accent) px-4 py-2",
        !device.isConnected && "opacity-70",
      )}
    >
      <button
        onClick={() => handleRemoveDevice(device.macAddress)}
        className="btn-danger absolute top-2 right-3 rounded px-1"
      >
        ✕
      </button>

      <div>
        <img src={device.isConnected ? wbbIconBlue : wbbIcon} alt="Device" className={"size-10 object-contain"} />

        {isSelected ? (
          <div className={"rounded-lg bg-(--secondary) px-2 py-1 text-sm text-white"}>Connected</div>
        ) : (
          !device.isConnected && <div className={"text-sm text-(--text-lighter)"}>Disconnected</div>
        )}
      </div>

      <div className="ml-8 flex flex-col justify-center">
        {isEditing ? (
          <div className="flex">
            <input
              ref={inputRef}
              type="text"
              defaultValue={device.name}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSaveDeviceName(device.macAddress, inputRef.current?.value || "");
                }
                if (e.key === "Escape") {
                  // Cancel edit
                  handleSaveDeviceName(device.macAddress, device.name);
                }
              }}
              onBlur={() => handleSaveDeviceName(device.macAddress, inputRef.current?.value || "")}
              className="px-2 py-1"
            />
          </div>
        ) : (
          <div className="">
            <span className="font-semibold" title={device.name}>
              {device.name}
            </span>
            <button
              className="cursor-pointer text-(--text-light)"
              onClick={() => handleStartEditName(device.id)}
              title="Edit name"
            >
              ✎
            </button>
          </div>
        )}
        <div className="text-(--text-lighter)">
          {device.isConnected
            ? `MAC: ${convertNumberToMacAddress(device.macAddress)}`
            : `Last seen: ${formatLastConnected(device.lastConnected)}`}
        </div>
      </div>

      <div className="mr-5 ml-auto flex h-10 flex-row gap-5">
        <ToolkitButton
          disabled={!device.isConnected}
          type="button"
          className={"text-sm"}
          shape="circle"
          color="white"
          onClick={() => handleIdentifyClick(device)}
        >
          ID
        </ToolkitButton>
        {/* Feature not available for now.
        <ToolkitButton
          disabled={!device.isConnected}
          type="button"
          className={"text-sm"}
          shape="circle"
          color="white"
          onClick={() => handleCalibrationClick(device)}
        >
          Calibrate
        </ToolkitButton>
        */}
        {!isSelected ? (
          <ToolkitButton
            type="button"
            color="blue"
            onClick={() => handleSelectDeviceForSession(device.macAddress)}
            disabled={cannotConnect}
          >
            Connect
          </ToolkitButton>
        ) : (
          <ToolkitButton type="button" color="red" onClick={() => handleUnselectDevice(device.macAddress)}>
            Disconnect
          </ToolkitButton>
        )}
      </div>
    </div>
  );
}
