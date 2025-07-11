import React from 'react';
import { Device } from '@/types';
import wbbIcon from "@/assets/wbb-icon-line.svg";
import wbbIconBlue from "@/assets/wbb-icon-line-blue.svg";
import "./Devices.css";

interface DeviceRowProps {
    device: Device;
    editingDeviceId: number | null;
    editingDeviceName: string;
    isDeviceDisabled: boolean;
    isConnectDisabled: boolean;
    connectTooltip: string;
    canEdit: boolean;
    disconnectingDeviceIds: number[];
    connectingDeviceMacAddresses: number[];
    onRemoveDevice: (deviceId: number) => void;
    handleStartEditName: (deviceId: number, currentName: string) => void;
    handleNameInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    handleSaveName: () => void;
    handleCancelEditName: () => void;
    handleIdentifyClick: (deviceName: string) => void;
    onDisconnectDevice: (deviceId: number) => Promise<void>;
    onConnectDevice: (deviceId: string) => Promise<void>;
    formatLastConnected: (dateString: string | undefined) => string;
}

export default function DeviceRow({
    device,
    editingDeviceId,
    editingDeviceName,
    isDeviceDisabled,
    isConnectDisabled,
    connectTooltip,
    canEdit,
    disconnectingDeviceIds,
    connectingDeviceMacAddresses,
    onRemoveDevice,
    handleStartEditName,
    handleNameInputChange,
    handleSaveName,
    handleCancelEditName,
    handleIdentifyClick,
    onDisconnectDevice,
    onConnectDevice,
    formatLastConnected,
}: DeviceRowProps) {
    return (
        <div className="device-row" key={device.id}>
            <div
              className={`device-container${device.status === "Disconnected" ? " disconnected" : ""}`}
            >
              <button
                onClick={() => onRemoveDevice(device.id)}
                className="remove-device-btn"
              >
                ✕
              </button>

              <div className="device-image-status">
                <img
                  src={
                    device.status === "Connected" ? wbbIconBlue : wbbIcon
                  }
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
                  className={`device-status ${
                    device.status === "Connected"
                      ? "device-status-connected"
                      : device.status === "Disconnected"
                        ? "device-status-disconnected"
                        : ""
                  }`}
                >
                  {isDeviceDisabled ? "..." : device.status}
                </div>
              </div>

              <div className="device-info">
                {editingDeviceId === device.id ? (
                  <div className="device-name-edit-container">
                    <input
                      type="text"
                      value={editingDeviceName}
                      onChange={handleNameInputChange}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveName();
                        if (e.key === "Escape") handleCancelEditName();
                      }}
                      className="device-name-edit-input"
                    />
                  </div>
                ) : (
                  <div className="device-name-container">
                    <span className="device-name-text" title={device.name}>
                      {device.name}
                    </span>
                    {canEdit && (
                      <button
                        onClick={() =>
                          handleStartEditName(device.id, device.name)
                        }
                        className="device-edit-name-btn"
                        title="Edit name"
                      >
                        ✎
                      </button>
                    )}
                  </div>
                )}
                <div className="device-last-connected">
                  {device.status !== "Disconnected"
                    ? `MAC: ${device.macAddress}`
                    : `Last seen: ${formatLastConnected(device.lastConnected)}`}
                </div>
                {device.status !== "Disconnected" && (
                  <div className="device-mac">
                    Firmware: {device.firmware}
                  </div>
                )}
              </div>

              <div className="device-actions">
                <button
                  onClick={() => handleIdentifyClick(device.name)}
                  className="device-action-btn btn-circle"
                  disabled={
                    isDeviceDisabled ||
                    device.status === "Disconnected"
                  }
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
                    onClick={() => onDisconnectDevice(device.id)}
                    className="device-action-btn disconnect"
                    disabled={isDeviceDisabled}
                  >
                    {disconnectingDeviceIds.includes(device.id)
                      ? "Wait..."
                      : "Disconnect"}
                  </button>
                ) : (
                  <button
                    onClick={() => onConnectDevice(device.macAddress)}
                    className="device-action-btn connect"
                    disabled={isConnectDisabled}
                    title={connectTooltip}
                  >
                    {connectingDeviceMacAddresses.includes(device.id)
                      ? "Wait..."
                      : "Connect"}
                  </button>
                )}
              </div>
            </div>
        </div>
    );
}
