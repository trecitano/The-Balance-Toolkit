import { useRef, useState, useEffect } from "react";
import "./Devices.css";
import wbbIcon from "../../assets/wbb-icon-line.svg";
import wbbIconBlue from "../../assets/wbb-icon-line-blue.svg";
import temperatureIcon from "../../assets/temperature.svg";
import bluetoothIcon from "../../assets/bluetooth-connected-icon.svg";
import signalIcon from "../../assets/bluetooth-connected-icon.svg";
import battery0Icon from '../../assets/battery-0-icon.svg';
import battery25Icon from '../../assets/battery-25-icon.svg';
import battery50Icon from '../../assets/battery-50-icon.svg';
import battery75Icon from '../../assets/battery-75-icon.svg';
import battery100Icon from '../../assets/battery-100-icon.svg';

/**
 * Devices page component.
 * Displays and manages a list of devices, including scanning, connecting, disconnecting, and identifying devices.
 * @returns The rendered Devices page.
 */
export default function Devices() {
  const [devices, setDevices] = useState<any[]>([]);
  const [topFadeOpacity, setTopFadeOpacity] = useState(0);
  const [bottomFadeOpacity, setBottomFadeOpacity] = useState(1); // Added for bottom fade
  const [showIdentifyPopup, setShowIdentifyPopup] = useState(false);
  const [identifyDeviceName, setIdentifyDeviceName] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [devicesFound, setDevicesFound] = useState<number | null>(null);
  const [disconnectingDeviceIds, setDisconnectingDeviceIds] = useState<number[]>([]);
  const [connectingDeviceIds, setConnectingDeviceIds] = useState<number[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Returns the appropriate battery icon based on the battery percentage.
   * @param batteryLevel - The current battery level (0-100).
   * @returns The imported SVG icon.
   */
  const getBatteryIcon = (batteryLevel: number) => {
    if (batteryLevel <= 12) return battery0Icon;
    if (batteryLevel <= 37) return battery25Icon; // Midpoint between 0-25 and 25-50
    if (batteryLevel <= 62) return battery50Icon; // Midpoint between 25-50 and 50-75
    if (batteryLevel <= 87) return battery75Icon; // Midpoint between 50-75 and 75-100
    return battery100Icon;
  };

  /**
   * Loads the initial list of devices from a mock backend when the component mounts.
   * @remarks
   * Sets the `devices` state with a static array of device objects.
   */
  useEffect(() => {
    const fetchDevices = async () => {
      const backendDevices = [
        { id: 1, name: "Device 1", lastConnected: "2025-05-20 09:15", status: "Connected", mac: "00:1A:7D:DA:71:13", battery: 85, temperature: 22, firmware: "v1.2.3" },
        { id: 2, name: "Device 2", lastConnected: "2025-05-26 18:45", status: "Connected", mac: "00:1A:7D:DA:71:14", battery: 26, temperature: 23, firmware: "v1.2.4" },
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
      const { scrollTop, scrollHeight, clientHeight } = listRef.current;
      const maxFade = 100;

      // Top fade
      const topOpacity = Math.min(scrollTop / maxFade, 1);
      setTopFadeOpacity(topOpacity);

      // Bottom fade
      const scrollBottom = scrollHeight - clientHeight - scrollTop;
      // Ensure opacity is between 0 and 1
      const bottomOpacity = Math.max(0, Math.min(scrollBottom / maxFade, 1));
      setBottomFadeOpacity(bottomOpacity);
    };
    const list = listRef.current;
    if (list) {
      list.addEventListener("scroll", handleScroll);
      handleScroll(); // Call to set initial state based on content
    }
    return () => {
      if (list) list.removeEventListener("scroll", handleScroll);
    };
  }, [devices]); // Add devices to the dependency array

  /**
   * Simulates a backend call to identify a device (e.g., blink LED).
   * @param deviceName - The name of the device to identify.
   * @returns A promise that resolves after a short delay.
   */
  const backendIdentifyDevice = async (_deviceName: string) => {
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
  // const handleAddDevice = () => {
  //   setDevices(prev => [
  //     ...prev,
  //     { id: 9, name: "Device 9", lastConnected: "2024-04-28", status: "Active", mac: "00:1A:7D:DA:71:1A", battery: 70, temperature: 21, firmware: "v1.2.3" }
  //   ]);
  // };

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
  const backendDisconnectDevice = async (_deviceId: number) => {
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
  const backendConnectDevice = async (_deviceId: number) => {
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

  const connectedDevicesCount = devices.filter(d => d.status === "Connected").length;
  const connectedDevicesForPanel = devices.filter(d => d.status === "Connected");

  return (
    <div className="devices-page">
      <div className="devices-header">
        <span className="page-title">Devices</span> {/* Added page title */}
        {isScanning ? (
          <button onClick={handleCancelScan} className="scan-btn">
            Cancel Scan
          </button>
        ) : (
          <button onClick={handleScanDevices} className="scan-btn" disabled={isScanning}>
            Scan for Devices
          </button>
        )}
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
          {getSortedDevices().map((device) => {
            const isConnectButtonDisabled = isScanning || 
                                          disconnectingDeviceIds.includes(device.id) || 
                                          connectingDeviceIds.includes(device.id) ||
                                          (connectedDevicesCount >= 2 && device.status !== "Connected") ||
                                          device.status === "Disconnected"; // Added condition
            const connectButtonTooltip = (connectedDevicesCount >= 2 && device.status !== "Connected") 
                                          ? "You can only have two boards connected at a time" 
                                          : device.status === "Disconnected" ? "Device is disconnected" : "";

            return (
              <div className={`device-row`} key={device.id}>
                <div className={`device-container${device.status === "Disconnected" ? " disconnected" : ""}`}>
                  <button onClick={() => handleRemoveDevice(device.id)} className="remove-device-btn">✕</button>
                  <div className="device-image-status">
                    <img
                      src={device.status === "Connected" ? wbbIconBlue : wbbIcon}
                      alt="Device"
                      className={`device-image ${
                        device.status === "Connected" ? "device-image-blue" : device.status === "Active" ? "device-image-active" : ""
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
                      {disconnectingDeviceIds.includes(device.id) || connectingDeviceIds.includes(device.id)
                        ? "..."
                        : device.status}
                    </div>
                  </div>
                  <div className="device-info">
                    <div className="device-name">{device.name}</div>
                    <div className="device-last-connected">
                      {device.status !== "Disconnected" ? `MAC: ${device.mac}` : `Last seen: ${formatLastConnected(device.lastConnected)}`}
                    </div>
                    {device.status !== "Disconnected" && <div className="device-mac">Firmware: {device.firmware}</div>}
                  </div>
                  <div className="device-actions">
                    <button
                      onClick={() => handleIdentifyClick(device.name)}
                      className="device-action-btn"
                      disabled={isScanning || disconnectingDeviceIds.includes(device.id) || connectingDeviceIds.includes(device.id) || device.status === "Disconnected"}
                      title={device.status === "Disconnected" ? "Device is disconnected" : "Identify Device"}
                    >
                      ID
                    </button>
                    {device.status === "Connected" ? (
                      <button
                        onClick={() => handleDisconnect(device.id)}
                        className="device-action-btn disconnect"
                        disabled={isScanning || disconnectingDeviceIds.includes(device.id) || connectingDeviceIds.includes(device.id)}
                      >
                        {disconnectingDeviceIds.includes(device.id) ? "Wait..." : "Disconnect"}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleConnect(device.id)}
                        className="device-action-btn connect"
                        disabled={isConnectButtonDisabled}
                        title={connectButtonTooltip}
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
            const isPanelButtonDisabled = isScanning || 
                                          (device && disconnectingDeviceIds.includes(device.id)) || 
                                          (device && connectingDeviceIds.includes(device.id));

            return (
              <div className="side-panel-square" key={`side-panel-${index}`}>
                {device ? (
                  <>
                    <div className="side-panel-header">
                      <img src={bluetoothIcon} alt="Bluetooth" className="side-panel-bt-icon" />
                      <div className="side-panel-header-info">
                        <span className="side-panel-device-name">{device.name}</span>
                        <span className="side-panel-device-mac">{device.mac}</span>
                      </div>
                    </div>
                    <img src={wbbIconBlue} alt={`${device.name} icon`} className="side-panel-device-image" />
                    <div className="side-panel-info-squares">
                      <div className="info-square">
                        <span className="info-square-value">{device.firmware}</span> {/* Using firmware for connectivity example */}
                        <div className="info-square-label">
                          <img src={signalIcon} alt="Connectivity" />
                          <span>Firmware</span> {/* Changed label to Firmware */}
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
                        onClick={() => handleDisconnect(device.id)}
                        className="side-panel-btn disconnect"
                        disabled={isPanelButtonDisabled}
                      >
                        {disconnectingDeviceIds.includes(device.id) ? "Wait..." : "Disconnect"}
                      </button>
                      <button className="side-panel-btn go-to-session" disabled={isPanelButtonDisabled}>
                        Go to Session &rarr;
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="side-panel-empty">
                    {/* Optional: Add an icon or text for empty slot */}
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
