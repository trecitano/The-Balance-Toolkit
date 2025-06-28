import bluetoothDisconnectedIcon from "@/assets/bluetooth-disconnected-icon.svg";
import { useRef, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import "./Devices.css";
import wbbIcon from "@/assets/wbb-icon-line.svg";
import wbbIconBlue from "@/assets/wbb-icon-line-blue.svg";
import temperatureIcon from "@/assets/temperature.svg";
import bluetoothIcon from "@/assets/bluetooth-connected-icon.svg";
import signalIcon from "@/assets/bluetooth-connected-icon.svg";
import battery0Icon from '@/assets/battery-0-icon.svg';
import battery25Icon from '@/assets/battery-25-icon.svg';
import battery50Icon from '@/assets/battery-50-icon.svg';
import battery75Icon from '@/assets/battery-75-icon.svg';
import battery100Icon from '@/assets/battery-100-icon.svg';
import rippleIcon from '@/assets/ripple-icon.svg';
import { Device } from "@/types";
import {commands} from "@/utils/requests.ts";

interface DevicesProps {
  devices: Device[];
  setDevices: React.Dispatch<React.SetStateAction<Device[]>>;
  editingDeviceId: number | null;
  setEditingDeviceId: (id: number | null) => void;
  editingDeviceName: string;
  setEditingDeviceName: (name: string) => void;
  connectingDeviceIds: number[];
  setConnectingDeviceIds: (ids: number[]) => void;
  disconnectingDeviceIds: number[];
  setDisconnectingDeviceIds: (ids: number[]) => void;
  onConnectDevice: (deviceId: number) => Promise<void>;
  onDisconnectDevice: (deviceId: number) => Promise<void>;
  onSaveDeviceName: (deviceId: number, newName: string) => void;
  onRemoveDevice: (deviceId: number) => void;
  onScanResults: (scannedDevices: Device[]) => void;
}

export default function Devices({
  devices,
  setDevices,
  editingDeviceId,
  setEditingDeviceId,
  editingDeviceName,
  setEditingDeviceName,
  connectingDeviceIds,
  setConnectingDeviceIds,
  disconnectingDeviceIds,
  setDisconnectingDeviceIds,
  onConnectDevice,
  onDisconnectDevice,
  onSaveDeviceName,
  onRemoveDevice,
  onScanResults,
}: DevicesProps) {
  const [topFadeOpacity, setTopFadeOpacity] = useState(0);
  const [bottomFadeOpacity, setBottomFadeOpacity] = useState(1);
  const [showIdentifyPopup, setShowIdentifyPopup] = useState(false);
  const [identifyDeviceName, setIdentifyDeviceName] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [devicesFound, setDevicesFound] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getBatteryIcon = (batteryLevel: number) => {
    if (batteryLevel <= 12) return battery0Icon;
    if (batteryLevel <= 37) return battery25Icon;
    if (batteryLevel <= 62) return battery50Icon;
    if (batteryLevel <= 87) return battery75Icon;
    return battery100Icon;
  };

  useEffect(() => {
    const handleScroll = () => {
      if (!listRef.current) return;
      const { scrollTop, scrollHeight, clientHeight } = listRef.current;
      const maxFade = 100;
      const topOpacity = Math.min(scrollTop / maxFade, 1);
      setTopFadeOpacity(topOpacity);
      const scrollBottom = scrollHeight - clientHeight - scrollTop;
      const bottomOpacity = Math.max(0, Math.min(scrollBottom / maxFade, 1));
      setBottomFadeOpacity(bottomOpacity);
    };
    const list = listRef.current;
    if (list) {
      list.addEventListener("scroll", handleScroll);
      handleScroll();
    }
    return () => {
      if (list) list.removeEventListener("scroll", handleScroll);
    };
  }, [devices]);

  const backendIdentifyDevice = async (_deviceName: string) => {
    return new Promise<void>(resolve => setTimeout(resolve, 50));
  };

  const handleIdentifyClick = async (deviceName: string) => {
    await backendIdentifyDevice(deviceName);
    setIdentifyDeviceName(deviceName);
    setShowIdentifyPopup(true);
  };

  const handleClosePopup = () => {
    setShowIdentifyPopup(false);
    setIdentifyDeviceName(null);
  };

  const handleScanDevices = async () => {
    setIsScanning(true);
    setDevicesFound(null);
    await commands.devices.scanDevices();
    const foundDevicesFromScan = await commands.devices.scanDevices();
    //onScanResults(foundDevicesFromScan);
    setIsScanning(true);
    //setDevicesFound(foundDevicesFromScan.length);
  };

  const handleCancelScan = () => {
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    setIsScanning(false);
    setDevicesFound(null);
  };

  const handleStartEditName = (deviceId: number, currentName: string) => {
    setEditingDeviceId(deviceId);
    setEditingDeviceName(currentName);
  };

  const handleNameInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setEditingDeviceName(event.target.value);
  };

  const handleSaveName = () => {
    if (editingDeviceId === null) return;
    onSaveDeviceName(editingDeviceId, editingDeviceName);
  };

  const handleCancelEditName = () => {
    setEditingDeviceId(null);
    setEditingDeviceName("");
  };

  const getSortedDevices = () => {
    if (!Array.isArray(devices)) return [];
    const connected = devices.filter(d => d.status === "Connected");
    const active = devices.filter(d => d.status === "Active");
    const disconnected = devices.filter(d => d.status === "Disconnected");

    connected.sort((a, b) => new Date(a.lastConnected).getTime() - new Date(b.lastConnected).getTime());
    active.sort((a, b) => a.name.localeCompare(b.name));
    disconnected.sort((a, b) => a.name.localeCompare(b.name));

    return [...connected, ...active, ...disconnected];
  };

  function formatLastConnected(dateString: string | undefined) {
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
  }

  const isDeviceDisabled = (device: Device) => {
    return isScanning ||
           disconnectingDeviceIds.includes(device.id) ||
           connectingDeviceIds.includes(device.id);
  };

  const isConnectButtonDisabled = (device: Device, connectedCount: number) => {
    return isDeviceDisabled(device) ||
           (connectedCount >= 2 && device.status !== "Connected") ||
           device.status === "Disconnected";
  };

  const getConnectButtonTooltip = (device: Device, connectedCount: number) => {
    if (connectedCount >= 2 && device.status !== "Connected") {
      return "You can only have two boards connected at a time";
    }
    if (device.status === "Disconnected") {
      return "Device is disconnected";
    }
    return "";
  };

  const sortedDevices = getSortedDevices();
  const connectedDevicesCount = devices.filter(d => d.status === "Connected").length;
  const connectedDevicesForPanel = sortedDevices.filter(d => d.status === "Connected");
  const noDevices = sortedDevices.length === 0;

  return (
    <div className="devices-page">
      <div className="devices-header">
        <span className="page-title">Devices</span>
        <button 
          onClick={isScanning ? handleCancelScan : handleScanDevices} 
          className={`scan-btn ${noDevices ? 'scan-button-highlight' : ''}`}
          disabled={false}
        >
          {isScanning ? "Cancel Scan" : "Scan for Devices"}
        </button>
        {isScanning && <div className="spinner"></div>}
        {devicesFound !== null && !isScanning && (
          <div className="devices-found-text">
            {devicesFound} {devicesFound === 1 ? "device" : "devices"} found
          </div>
        )}
      </div>

      <div className="devices-list-wrapper">
        <div className="devices-list-fade-top" style={{ opacity: topFadeOpacity }} />
        <div className="devices-list" ref={listRef}>
          {noDevices && (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 mt-8 bg-gray-100 rounded-lg shadow-inner">
              <img src={bluetoothDisconnectedIcon} alt="No devices found" className="w-20 h-20 mb-6 opacity-50" />
              <p className="text-xl text-gray-600">No devices found.</p>
              <p className="text-base text-gray-400">Click the "Scan for Devices" button to search for nearby devices.</p>
            </div>
          )}
          {sortedDevices.map((device) => {
            const isConnectDisabled = isConnectButtonDisabled(device, connectedDevicesCount);
            const connectTooltip = getConnectButtonTooltip(device, connectedDevicesCount);
            const canEdit = (device.status === "Connected" || device.status === "Active") && 
                           !isDeviceDisabled(device);

            return (
              <div className="device-row" key={device.id}>
                <div className={`device-container${device.status === "Disconnected" ? " disconnected" : ""}`}>
                  <button 
                    onClick={() => onRemoveDevice(device.id)} 
                    className="remove-device-btn"
                  >
                    ✕
                  </button>
                  
                  <div className="device-image-status">
                    <img
                      src={device.status === "Connected" ? wbbIconBlue : wbbIcon}
                      alt="Device"
                      className={`device-image ${
                        device.status === "Connected" ? "device-image-blue" : 
                        device.status === "Active" ? "device-image-active" : ""
                      }`}
                    />
                    <div
                      className={`device-status ${
                        device.status === "Connected" ? "device-status-connected" :
                        device.status === "Disconnected" ? "device-status-disconnected" : ""
                      }`}
                    >
                      {isDeviceDisabled(device) ? "..." : device.status}
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
                            if (e.key === 'Enter') handleSaveName();
                            if (e.key === 'Escape') handleCancelEditName();
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
                            onClick={() => handleStartEditName(device.id, device.name)}
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
                        ? `MAC: ${device.mac}` 
                        : `Last seen: ${formatLastConnected(device.lastConnected)}`
                      }
                    </div>
                    {device.status !== "Disconnected" && (
                      <div className="device-mac">Firmware: {device.firmware}</div>
                    )}
                  </div>
                  
                  <div className="device-actions">
                    <button
                      onClick={() => handleIdentifyClick(device.name)}
                      className="device-action-btn btn-circle"
                      disabled={isDeviceDisabled(device) || device.status === "Disconnected"}
                      title={device.status === "Disconnected" ? "Device is disconnected" : "Identify Device"}
                    >
                      ID
                    </button>
                    {device.status === "Connected" ? (
                      <button
                        onClick={() => onDisconnectDevice(device.id)}
                        className="device-action-btn disconnect"
                        disabled={isDeviceDisabled(device)}
                      >
                        {disconnectingDeviceIds.includes(device.id) ? "Wait..." : "Disconnect"}
                      </button>
                    ) : (
                      <button
                        onClick={() => onConnectDevice(device.id)}
                        className="device-action-btn connect"
                        disabled={isConnectDisabled}
                        title={connectTooltip}
                      >
                        {connectingDeviceIds.includes(device.id) ? "Wait..." : "Connect"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div className="device-container device-container-faux" />
        </div>
        <div className="devices-list-fade" style={{ opacity: bottomFadeOpacity }} />
        
        <div className="static-side-panel">
          {[0, 1].map(index => {
            const device = connectedDevicesForPanel[index];
            const isPanelDisabled = device && isDeviceDisabled(device);

            return (
              <div className="side-panel-square" key={`side-panel-${index}`}>
                {device ? (
                  <>
                    <div className="side-panel-header">
                      <img src={bluetoothIcon} alt="Bluetooth" className="side-panel-bt-icon" />
                      <div className="side-panel-header-info">
                        {editingDeviceId === device.id ? (
                          <div className="device-name-edit-container">
                            <input
                              type="text"
                              value={editingDeviceName}
                              onChange={handleNameInputChange}
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveName();
                                if (e.key === 'Escape') handleCancelEditName();
                              }}
                              className="device-name-edit-input side-panel-name-edit-input"
                            />
                          </div>
                        ) : (
                          <div className="side-panel-device-name-container">
                            <span className="side-panel-device-name-text" title={device.name}>
                              {device.name}
                            </span>
                            {!isPanelDisabled && (
                              <button
                                onClick={() => handleStartEditName(device.id, device.name)}
                                className="device-edit-name-btn side-panel-edit-btn"
                                title="Edit name"
                              >
                                ✎
                              </button>
                            )}
                          </div>
                        )}
                        <span className="side-panel-device-mac">{device.mac}</span>
                      </div>
                    </div>
                    
                    <div className="side-panel-icon-container">
                      <img src={rippleIcon} alt="Ripple effect" className="side-panel-ripple-icon" />
                      <img src={wbbIconBlue} alt={`${device.name} icon`} className="side-panel-device-image" />
                    </div>
                    
                    <div className="side-panel-info-squares">
                      <div className="info-square">
                        <span className="info-square-value">{device.firmware}</span>
                        <div className="info-square-label">
                          <img src={signalIcon} alt="Connectivity" />
                          <span>Firmware</span>
                        </div>
                      </div>
                      <div className="info-square">
                        <span className="info-square-value">{device.battery}%</span>
                        <div className="info-square-label">
                          <img src={getBatteryIcon(device.battery)} alt="Battery" />
                          <span>Battery</span>
                        </div>
                      </div>
                      <div className="info-square">
                        <span className="info-square-value">{device.temperature}°C</span>
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
                        disabled={isPanelDisabled}
                      >
                        {disconnectingDeviceIds.includes(device.id) ? "Wait..." : "Disconnect"}
                      </button>
                      <Link
                        to="/session"
                        state={{ initialSelectedBoard: device.name }}
                        className={`side-panel-btn go-to-session ${isPanelDisabled ? 'disabled-link' : ''}`}
                        onClick={(e) => { if (isPanelDisabled) e.preventDefault(); }}
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
      </div>

      {isScanning && (
        <div className="scan-overlay">
          <div className="scan-overlay-spinner">
            <span className="spinner" />
            <span className="scan-overlay-text">Scanning...</span>
            <button
              className="scan-btn"
              style={{ marginTop: 24, minWidth: 120 }}
              onClick={handleCancelScan}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showIdentifyPopup && (
        <div className="identify-popup-overlay" onClick={handleClosePopup}>
          <div className="identify-popup" onClick={e => e.stopPropagation()}>
            <p>
              The LED in <b>{identifyDeviceName}</b> should be blinking
            </p>
            <button className="popup-close-btn" onClick={handleClosePopup}>OK</button>
          </div>
        </div>
      )}
    </div>
  );
}