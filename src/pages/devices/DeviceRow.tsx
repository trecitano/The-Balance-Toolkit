import { useRef } from "react";
import { Device } from "@/types";
import wbbIcon from "@/assets/wbb-icon-line.svg";
import wbbIconBlue from "@/assets/wbb-icon-line-blue.svg";
import "./DeviceRow.css";
import { ToolkitButton } from "@/components/ToolkitButton.tsx";

interface DeviceRowProps {
  device: Device;
  isEditing: boolean;
  handleStartEditName: (deviceId: string) => void;
  handleSaveDeviceName: (macAddress: number, deviceName: string) => void;
  handleIdentifyClick: (macAddress: number) => void;
  handleRemoveDevice: (macAddress: number) => void;
  handleSelectDeviceForSession: (macAddress: number) => void;
}

export default function DeviceRow({
  device,
  isEditing,
  handleStartEditName,
  handleSaveDeviceName,
  handleIdentifyClick,
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

  const convertNumberToMacAddress = (number: number): string => {
    return number
      .toString(16)
      .toUpperCase()
      .padStart(12, "0")
      .match(/.{1,2}/g)!
      .join(":");
  };

  return (
    <div className="device-row">
      <div className={`device-container ${device.isConnected ? "" : "disconnected"}`}>
        <button onClick={() => handleRemoveDevice(device.macAddress)} className="remove-device-btn">
          ✕
        </button>

        <div className="device-image-status">
          <img
            src={device.isConnected ? wbbIconBlue : wbbIcon}
            alt="Device"
            className={`device-image ${device.isConnected ? "device-image-blue" : ""}`}
          />
          <div
            className={`device-status ${device.isConnected ? "device-status-connected" : "device-status-disconnected"}`}
          >
            {device.isConnected ? "Connected" : "Disconnected"}
          </div>
        </div>

        <div className="device-info">
          {isEditing ? (
            <div className="device-name-edit-container">
              <input
                ref={inputRef}
                type="text"
                defaultValue={device.name}
                autoFocus
                onKeyDown={(e) => {
                  console.log("Key down:", e.key);
                  if (e.key === "Enter") {
                    handleSaveDeviceName(device.macAddress, inputRef.current?.value || "");
                  }
                  if (e.key === "Escape") {
                    // Cancel edit
                    handleSaveDeviceName(device.macAddress, device.name);
                  }
                }}
                onBlur={() => handleSaveDeviceName(device.macAddress, inputRef.current?.value || "")}
                className="device-name-edit-input"
              />
            </div>
          ) : (
            <div className="device-name-container">
              <span className="device-name-text" title={device.name}>
                {device.name}
              </span>
              <button onClick={() => handleStartEditName(device.id)} className="device-edit-name-btn" title="Edit name">
                ✎
              </button>
            </div>
          )}
          <div className="device-last-connected">
            {device.isConnected
              ? `MAC: ${convertNumberToMacAddress(device.macAddress)}`
              : `Last seen: ${formatLastConnected(device.lastConnected)}`}
          </div>
        </div>

        <div className="device-actions">
          <button
            onClick={() => handleIdentifyClick(device.macAddress)}
            className="device-action-btn btn-circle"
            disabled={!device.isConnected}
            title={device.isConnected ? "Identify Device" : "Device is disconnected"}
          >
            ID
          </button>
          {device.isConnected ? (
            <ToolkitButton type="button" variant="blue" onClick={() => handleSelectDeviceForSession(device.macAddress)}>
              Connect
            </ToolkitButton>
          ) : (
            <ToolkitButton type="button" variant="blue" disabled={true}>
              Connect
            </ToolkitButton>
          )}
        </div>
      </div>
    </div>
  );
}
