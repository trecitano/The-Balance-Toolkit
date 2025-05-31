import React, { useRef, useState, useEffect } from "react";
import "./Devices.css";
import wbbIcon from "../../assets/wbb-icon-line.svg";
import wbbIconBlue from "../../assets/wbb-icon-line-blue.svg";
import batteryIcon from "../../assets/battery.svg";
import temperatureIcon from "../../assets/temperature.svg";

/**
 * Devices page component.
 * Displays and manages a list of devices, including scanning, connecting, disconnecting, and identifying devices.
 * @returns The rendered Devices page.
 */
export default function Devices() {
  const [devices, setDevices] = useState<any[]>([]);
  const [topFadeOpacity, setTopFadeOpacity] = useState(0);
  const [showIdentifyPopup, setShowIdentifyPopup] = useState(false);
  const [identifyDeviceName, setIdentifyDeviceName] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [devicesFound, setDevicesFound] = useState<number | null>(null);
  const [disconnectingDeviceIds, setDisconnectingDeviceIds] = useState<number[]>([]);
  const [connectingDeviceIds, setConnectingDeviceIds] = useState<number[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Loads the initial list of devices from a mock backend when the component mounts.
   * @remarks
   * Sets the `devices` state with a static array of device objects.
   */
  useEffect(() => {
    const fetchDevices = async () => {
      const backendDevices = [
        { id: 1, name: "Device 1", lastConnected: "2025-05-20 09:15", status: "Connected", mac: "00:1A:7D:DA:71:13", battery: 85, temperature: 22, firmware: "v1.2.3" },
        { id: 2, name: "Device 2", lastConnected: "2025-05-26 18:45", status: "Connected", mac: "00:1A:7D:DA:71:14", battery: 76, temperature: 23, firmware: "v1.2.4" },
        { id: 3, name: "Device 3", lastConnected: "2025-05-25 22:10", status: "Disconnected", mac: "00:1A:7D:DA:71:15", battery: 90, temperature: 21, firmware: "v1.2.3" },
        { id: 4, name: "Device 4", lastConnected: "2025-05-19 07:30", status: "Disconnected", mac: "00:1A:7D:DA:71:16", battery: 60, temperature: 24, firmware: "v1.2.2" },
        { id: 5, name: "Device 5", lastConnected: "2025-05-13 16:00", status: "Disconnected", mac: "00:1A:7D:DA:71:17", battery: 50, temperature: 22, firmware: "v1.2.1" },
        { id: 6, name: "Device 6", lastConnected: "2025-04-27 11:20", status: "Disconnected", mac: "00:1A:7D:DA:71:18", battery: 95, temperature: 23, firmware: "v1.2.3" },
        { id: 7, name: "Device 7", lastConnected: "2025-04-20 14:55", status: "Disconnected", mac: "00:1A:7D:DA:71:19", battery: 80, temperature: 22, firmware: "v1.2.0" },
        { id: 8, name: "Device 8", lastConnected: "2024-12-15 08:05", status: "Disconnected", mac: "00:1A:7D:DA:71:1A", battery: 70, temperature: 21, firmware: "v1.2.3" }
      ];
      setDevices(backendDevices);
    };

    fetchDevices();
  }, []);

  /**
   * Sets up a scroll event listener on the device list to update the top fade opacity.
   * @remarks
   * Updates the `topFadeOpacity` state based on the scroll position of the device list.
   */
  useEffect(() => {
    const handleScroll = () => {
      if (!listRef.current) return;
      const scrollTop = listRef.current.scrollTop;
      const maxFade = 100;
      const opacity = Math.min(scrollTop / maxFade, 1);
      setTopFadeOpacity(opacity);
    };
    const list = listRef.current;
    if (list) {
      list.addEventListener("scroll", handleScroll);
      handleScroll();
    }
    return () => {
      if (list) list.removeEventListener("scroll", handleScroll);
    };
  }, []);

  /**
   * Simulates a backend call to identify a device (e.g., blink LED).
   * @param deviceName - The name of the device to identify.
   * @returns A promise that resolves after a short delay.
   */
  const backendIdentifyDevice = async (deviceName: string) => {
    return new Promise<void>(resolve => {
      setTimeout(() => {
        resolve();
      }, 50);
    });
  };

  /**
   * Handles the "Identify" action for a device.
   * Opens the identify popup and triggers the backend identify simulation.
   * @param deviceName - The name of the device to identify.
   * @returns A promise that resolves when the identify action is complete.
   */
  const handleIdentifyClick = async (deviceName: string) => {
    await backendIdentifyDevice(deviceName);
    setIdentifyDeviceName(deviceName);
    setShowIdentifyPopup(true);
  };

  /**
   * Closes the identify popup and clears the selected device name.
   */
  const handleClosePopup = () => {
    setShowIdentifyPopup(false);
    setIdentifyDeviceName(null);
  };

  /**
   * Simulates a backend scan for devices, returning a list of found devices and their statuses.
   * @returns A promise resolving to an array of found device objects.
   */
  const mockScanBackend = async (): Promise<{ id: number; status: "Connected" | "Active" }[]> => {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve([
          { id: 1, status: "Connected" },
          { id: 2, status: "Active" }
        ]);
      }, 5000);
    });
  };

  /**
   * Initiates a scan for devices, updates their statuses, and updates the UI.
   * @returns A promise that resolves when the scan is complete.
   */
  const handleScanDevices = async () => {
    setIsScanning(true);
    setDevicesFound(null);

    const foundDevices = await mockScanBackend();

    setDevices(prev => {
      const foundMap = new Map<number, "Connected" | "Active">();
      foundDevices.forEach(d => foundMap.set(d.id, d.status));

      return prev.map(device => {
        if (foundMap.has(device.id)) {
          const foundStatus = foundMap.get(device.id);
          if (foundStatus === "Connected") {
            return { ...device, status: "Connected" };
          }
          if (foundStatus === "Active") {
            return { ...device, status: "Active" };
          }
        }
        if (
          (device.status === "Connected" || device.status === "Active") &&
          !foundMap.has(device.id)
        ) {
          return { ...device, status: "Disconnected" };
        }
        return device;
      });
    });

    setIsScanning(false);
    setDevicesFound(foundDevices.length);
  };

  /**
   * Cancels an ongoing scan for devices.
   * Clears the scan timeout and resets scanning state.
   */
  const handleCancelScan = () => {
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    setIsScanning(false);
    setDevicesFound(null);
  };

  /**
   * Adds a new mock device to the device list.
   * This function is kept for backend mocking purposes, but is not used in the UI.
   */
  const handleAddDevice = () => {
    setDevices(prev => [
      ...prev,
      { id: 9, name: "Device 9", lastConnected: "2024-04-28", status: "Active", mac: "00:1A:7D:DA:71:1A", battery: 70, temperature: 21, firmware: "v1.2.3" }
    ]);
  };

  /**
   * Removes a device from the device list by its ID.
   * @param id - The ID of the device to remove.
   */
  const handleRemoveDevice = (id: number) => {
    setDevices(prev => prev.filter(device => device.id !== id));
  };

  /**
   * Simulates a backend call to disconnect a device.
   * @param deviceId - The ID of the device to disconnect.
   * @returns A promise that resolves after a short delay.
   */
  const backendDisconnectDevice = async (deviceId: number) => {
    return new Promise<void>((resolve) => setTimeout(resolve, 1000));
  };

  /**
   * Disconnects a device by its ID, simulating a delay and backend call, and updates device status.
   * @param deviceId - The ID of the device to disconnect.
   * @returns A promise that resolves when the disconnect is complete.
   */
  const handleDisconnect = async (deviceId: number) => {
    setDisconnectingDeviceIds(prev => [...prev, deviceId]);
    setTimeout(async () => {
      await backendDisconnectDevice(deviceId);
      setDevices((prev) =>
        prev.map((device) =>
          device.id === deviceId ? { ...device, status: "Active" } : device
        )
      );
      setDisconnectingDeviceIds(prev => prev.filter(id => id !== deviceId));
    }, 3000);
  };

  /**
   * Simulates a backend call to connect a device.
   * @param deviceId - The ID of the device to connect.
   * @returns A promise that resolves after a short delay.
   */
  const backendConnectDevice = async (deviceId: number) => {
    return new Promise<void>((resolve) => setTimeout(resolve, 1000));
  };

  /**
   * Connects a device by its ID, simulating a delay and backend call, and updates device status and lastConnected.
   * @param deviceId - The ID of the device to connect.
   * @returns A promise that resolves when the connect is complete.
   */
  const handleConnect = async (deviceId: number) => {
    setConnectingDeviceIds(prev => [...prev, deviceId]);
    setTimeout(async () => {
      await backendConnectDevice(deviceId);
      setDevices((prev) =>
        prev.map((device) =>
          device.id === deviceId
            ? {
                ...device,
                status: "Connected",
                lastConnected: new Date().toISOString().slice(0, 16).replace("T", " ")
              }
            : device
        )
      );
      setConnectingDeviceIds(prev => prev.filter(id => id !== deviceId));
    }, 3000);
  };

  /**
   * Returns the devices sorted by status and then by last connected date or name.
   * Connected devices are sorted by lastConnected (oldest first), active and disconnected alphabetically.
   * @returns An array of sorted device objects.
   */
  const getSortedDevices = () => {
    const connected = devices.filter(d => d.status === "Connected");
    const active = devices.filter(d => d.status === "Active");
    const disconnected = devices.filter(d => d.status === "Disconnected");

    connected.sort((a, b) => {
      const dateA = new Date(a.lastConnected).getTime();
      const dateB = new Date(b.lastConnected).getTime();
      return dateA - dateB;
    });

    active.sort((a, b) => a.name.localeCompare(b.name));
    disconnected.sort((a, b) => a.name.localeCompare(b.name));

    return [...connected, ...active, ...disconnected];
  };

  /**
   * Formats a date string for the last connected time into a human-readable format.
   * @param dateString - The date string to format.
   * @returns A formatted string such as "Today 14:00", "Yesterday 13:00", "3 days ago", etc.
   */
  function formatLastConnected(dateString: string) {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = now.getMonth() - date.getMonth() + 12 * (now.getFullYear() - date.getFullYear());

    const pad = (n: number) => n.toString().padStart(2, "0");
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());

    if (diffDays === 0) {
      return `Today ${hours}:${minutes}`;
    } else if (diffDays === 1) {
      return `Yesterday ${hours}:${minutes}`;
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else if (diffWeeks === 1) {
      return `1 week ago`;
    } else if (diffWeeks < 5) {
      return `${diffWeeks} weeks ago`;
    } else if (diffMonths === 1) {
      return `1 month ago`;
    } else {
      return date.toISOString().slice(0, 10);
    }
  }

  return (
    <div className="devices-page">
      {/* Overlay during scanning */}
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
      <div className="devices-title">Devices</div>
      <div className="devices-header">
        <button className="scan-btn" onClick={handleScanDevices} disabled={isScanning}>
          Scan Devices
        </button>
        {devicesFound !== null && (
          <span className="devices-found-text">Found {devicesFound} devices!</span>
        )}
      </div>
      <div className="devices-list-wrapper">
        <div
          className="devices-list-fade-top"
          style={{ opacity: topFadeOpacity, pointerEvents: "none" }}
        />
        <div className="devices-list" ref={listRef}>
          {getSortedDevices().map((device) => (
            <div className={`device-row`} key={device.id}>
              <div className={`device-container${device.status === "Disconnected" ? " disconnected" : ""}`}>
                {/* Remove Device Cross Button */}
                <button
                  className="remove-device-btn"
                  onClick={() => handleRemoveDevice(device.id)}
                  title="Remove device"
                >
                  ×
                </button>
                <div className="device-image-status">
                  <img
                    className={
                      device.status === "Connected"
                        ? "device-image device-image-blue"
                        : device.status === "Active"
                        ? "device-image device-image-active"
                        : "device-image"
                    }
                    src={device.status === "Connected" ? wbbIconBlue : wbbIcon}
                    alt={device.name}
                  />
                  <span
                    className={
                      device.status === "Connected"
                        ? "device-status device-status-connected"
                        : device.status === "Disconnected"
                        ? "device-status device-status-disconnected"
                        : "device-status"
                    }
                  >
                    {device.status}
                  </span>
                </div>
                <div className="device-info">
                  <span className="device-name">{device.name}</span>
                  <span className="device-last-connected">
                    Last connected: {formatLastConnected(device.lastConnected)}
                  </span>
                  <span className="device-mac">
                    MAC: {device.mac}
                  </span>
                </div>
                {device.status !== "Disconnected" && (
                  <div className="device-actions">
                    <button
                      className="device-action-btn"
                      onClick={() => handleIdentifyClick(device.name)}
                    >
                      Identify
                    </button>
                    {device.status === "Connected" ? (
                      disconnectingDeviceIds.includes(device.id) ? (
                        <button className="device-action-btn disconnect" disabled>
                          <span className="spinner" style={{ marginRight: 8 }} />
                          Disconnecting...
                        </button>
                      ) : (
                        <button
                          className="device-action-btn disconnect"
                          onClick={() => handleDisconnect(device.id)}
                        >
                          Disconnect
                        </button>
                      )
                    ) : (
                      connectingDeviceIds.includes(device.id) ? (
                        <button className="device-action-btn connect" disabled>
                          <span className="spinner" style={{ marginRight: 8 }} />
                          Connecting...
                        </button>
                      ) : (
                        <button
                          className="device-action-btn connect"
                          onClick={() => handleConnect(device.id)}
                        >
                          Connect
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
              {/* Only show internal info for connected devices */}
              {device.status === "Connected" && (
                <div className="device-internal-info">
                  <div className="device-internal-info-icons">
                    <div className="device-internal-info-item">
                      <img src={batteryIcon} alt="Battery" className="device-internal-icon" />
                      <div className="device-internal-value">{device.battery}%</div>
                    </div>
                    <div className="device-internal-info-item">
                      <img src={temperatureIcon} alt="Temperature" className="device-internal-icon" />
                      <div className="device-internal-value">{device.temperature}°C</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
          <div className="device-container device-container-faux" />
        </div>
        <div className="devices-list-fade" />
      </div>
      {/* Popup */}
      {showIdentifyPopup && (
        <div className="identify-popup-overlay">
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
