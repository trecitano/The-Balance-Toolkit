import React from 'react';
import { Link } from 'react-router-dom';
import { Device } from '@/types';
import bluetoothIcon from "@/assets/bluetooth-connected-icon.svg";
import rippleIcon from "@/assets/ripple-icon.svg";
import wbbIconBlue from "@/assets/wbb-icon-line-blue.svg";
import signalIcon from "@/assets/bluetooth-connected-icon.svg";
import temperatureIcon from "@/assets/temperature.svg";
import "./Devices.css";

interface DeviceSessionListProps {
  connectedDevicesForPanel: Device[];
  editingDeviceId: number | null;
  editingDeviceName: string;
  isScanning: boolean;
  disconnectingDeviceIds: number[];
  connectingDeviceMacAddresses: number[];
  handleNameInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleSaveName: () => void;
  handleCancelEditName: () => void;
  handleStartEditName: (deviceId: number, currentName: string) => void;
  onDisconnectDevice: (deviceId: number) => Promise<void>;
  getBatteryIcon: (batteryLevel: number) => string;
}

export default function DeviceSessionList({
                                            connectedDevicesForPanel,
                                            editingDeviceId,
                                            editingDeviceName,
                                            isScanning,
                                            disconnectingDeviceIds,
                                            connectingDeviceMacAddresses,
                                            handleNameInputChange,
                                            handleSaveName,
                                            handleCancelEditName,
                                            handleStartEditName,
                                            onDisconnectDevice,
                                            getBatteryIcon,
                                          }: DeviceSessionListProps) {
  return (
    <div className="static-side-panel">
      {[0, 1].map((index) => {
        const device = connectedDevicesForPanel[index];
        const isPanelDisabled = device && (
          isScanning ||
          disconnectingDeviceIds.includes(device.id) ||
          connectingDeviceMacAddresses.includes(device.id)
        );

        return (
          <div className="side-panel-square" key={`side-panel-${index}`}>
            {device ? (
              <>
                <div className="side-panel-header">
                  <img
                    src={bluetoothIcon}
                    alt="Bluetooth"
                    className="side-panel-bt-icon"
                  />
                  <div className="side-panel-header-info">
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
                          className="device-name-edit-input side-panel-name-edit-input"
                        />
                      </div>
                    ) : (
                      <div className="side-panel-device-name-container">
                                                <span
                                                  className="side-panel-device-name-text"
                                                  title={device.name}
                                                >
                                                    {device.name}
                                                </span>
                        {!isPanelDisabled && (
                          <button
                            onClick={() =>
                              handleStartEditName(device.id, device.name)
                            }
                            className="device-edit-name-btn side-panel-edit-btn"
                            title="Edit name"
                          >
                            ✎
                          </button>
                        )}
                      </div>
                    )}
                    <span className="side-panel-device-mac">
                                            {device.macAddress}
                                        </span>
                  </div>
                </div>

                <div className="side-panel-icon-container">
                  <img
                    src={rippleIcon}
                    alt="Ripple effect"
                    className="side-panel-ripple-icon"
                  />
                  <img
                    src={wbbIconBlue}
                    alt={`${device.name} icon`}
                    className="side-panel-device-image"
                  />
                </div>

                <div className="side-panel-info-squares">
                  <div className="info-square">
                                        <span className="info-square-value">
                                            {device.firmware}
                                        </span>
                    <div className="info-square-label">
                      <img src={signalIcon} alt="Connectivity" />
                      <span>Firmware</span>
                    </div>
                  </div>
                  <div className="info-square">
                                        <span className="info-square-value">
                                            {device.battery}%
                                        </span>
                    <div className="info-square-label">
                      <img
                        src={getBatteryIcon(device.battery)}
                        alt="Battery"
                      />
                      <span>Battery</span>
                    </div>
                  </div>
                  <div className="info-square">
                                        <span className="info-square-value">
                                            {device.temperature}°C
                                        </span>
                    <div className="info-square-label">
                      <img src={temperatureIcon} alt="Temperature" />
                      <span>Temp</span>
                    </div>
                  </div>
                </div>

                <div className="side-panel-actions">
                  <button
                    onClick={() => onDisconnectDevice(device.id)}
                    className="side-panel-btn disconnect"
                    disabled={!!isPanelDisabled}
                  >
                    {disconnectingDeviceIds.includes(device.id)
                      ? "Wait..."
                      : "Disconnect"}
                  </button>
                  <Link
                    to="/session"
                    state={{ initialSelectedBoard: device.name }}
                    className={`side-panel-btn go-to-session ${isPanelDisabled ? "disabled-link" : ""}`}
                    onClick={(e) => {
                      if (isPanelDisabled) e.preventDefault();
                    }}
                    aria-disabled={isPanelDisabled}
                    tabIndex={isPanelDisabled ? -1 : undefined}
                  >
                    Go to Session &rarr;
                  </Link>
                </div>
              </>
            ) : (
              <div className="side-panel-empty">
                <span>Device slot available</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
