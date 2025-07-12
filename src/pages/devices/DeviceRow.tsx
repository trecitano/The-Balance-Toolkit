import React, { useRef } from "react";
import { Device } from "@/types";
import wbbIcon from "@/assets/wbb-icon-line.svg";
import wbbIconBlue from "@/assets/wbb-icon-line-blue.svg";
import "./DeviceRow.css";

interface DeviceRowProps {
  device: Device;
  handleIdentifyClick: (macAddress: string) => Promise<void>;
  handleSaveDeviceName: (
    macAddress: string,
    deviceName: string,
  ) => Promise<void>;
  handleRemoveDevice: (macAddress: string) => Promise<void>;
  handleDisconnectDevice: (macAddress: string) => Promise<void>;
  handleConnectDevice: (macAddress: string) => Promise<void>;
}

export default function DeviceRow({
  device,
  handleIdentifyClick,
  handleSaveDeviceName,
  handleRemoveDevice,
  handleDisconnectDevice,
  handleConnectDevice,
}: DeviceRowProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const connectTooltip =
    device.status === "Disconnected" ? "Device is disconnected" : "";

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
    <div className="device-row">
      <div
        className={`device-container${device.status === "Disconnected" ? " disconnected" : ""}`}
      >
        <button
          onClick={() => handleRemoveDevice(device.macAddress)}
          className="remove-device-btn"
        >
          ✕
        </button>

        <div className="device-image-status">
          <img
            src={device.status === "Connected" ? wbbIconBlue : wbbIcon}
            alt="Device"
            className={`device-image ${
              device.status === "Connected"
                ? "device-image-blue"
                : device.status === "Active"
                  ? "device-image-active"
                  : ""
            }`}
          />
          <div
            className={`device-status ${device.status === "Connected" ? "device-status-connected" : "device-status-disconnected"}`}
          >
            {device.status}
          </div>
        </div>

        <div className="device-info">
          {"editingDeviceId" === device.id ? (
            <div className="device-name-edit-container">
              <input
                ref={inputRef}
                type="text"
                defaultValue={device.name}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter")
                    handleSaveDeviceName(
                      device.macAddress,
                      inputRef.current?.value || "",
                    );
                  if (e.key === "Escape") handleAction("cancel");
                }}
                onBlur={() =>
                  handleSaveDeviceName(
                    device.macAddress,
                    inputRef.current?.value || "",
                  )
                }
                className="device-name-edit-input"
              />
            </div>
          ) : (
            <div className="device-name-container">
              <span className="device-name-text" title={device.name}>
                {device.name}
              </span>
              <button
                onClick={
                  () => ""
                  //handleStartEditName(device.id, device.name)
                }
                className="device-edit-name-btn"
                title="Edit name"
              >
                ✎
              </button>
            </div>
          )}
          <div className="device-last-connected">
            {device.status !== "Disconnected"
              ? `MAC: ${device.macAddress}`
              : `Last seen: ${formatLastConnected(device.lastConnected)}`}
          </div>
        </div>

        <div className="device-actions">
          <button
            onClick={() => handleIdentifyClick(device.macAddress)}
            className="device-action-btn btn-circle"
            disabled={device.status === "Disconnected"}
            title={
              device.status === "Disconnected"
                ? "Device is disconnected"
                : "Identify Device"
            }
          >
            ID
          </button>
          {device.status === "Connected" ? (
            <button
              onClick={() => handleDisconnectDevice(device.macAddress)}
              className="device-action-btn disconnect"
            >
              Disconnect
            </button>
          ) : (
            <button
              onClick={() => handleConnectDevice(device.macAddress)}
              className="device-action-btn connect"
              title={connectTooltip}
            >
              Connect
              {/* TODO: Original code was below
              {connectingDeviceMacAddresses.includes(device.id)
                ? "Wait..."
                : "Connect"} */}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
