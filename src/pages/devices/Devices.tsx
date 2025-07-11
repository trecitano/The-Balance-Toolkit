import React, {
  useRef,
  useState,
  useEffect
} from "react";
import bluetoothDisconnectedIcon from "@/assets/bluetooth-disconnected-icon.svg";
import battery0Icon from "@/assets/battery-0-icon.svg";
import battery25Icon from "@/assets/battery-25-icon.svg";
import battery50Icon from "@/assets/battery-50-icon.svg";
import battery75Icon from "@/assets/battery-75-icon.svg";
import battery100Icon from "@/assets/battery-100-icon.svg";
import DeviceRow from "./DeviceRow";
import { Device } from "@/types";
import { commands } from "@/utils/requests.ts";
import { listen } from '@tauri-apps/api/event';
import DeviceSessionList from "@/pages/devices/DeviceSessionList.tsx";

interface DevicesProps {
  devices: Device[];
  setDevices: React.Dispatch < React.SetStateAction < Device[] >> ;
  editingDeviceId: number | null;
  setEditingDeviceId: (id: number | null) => void;
  editingDeviceName: string;
  setEditingDeviceName: (name: string) => void;
  connectingDeviceMacAddresses: number[];
  setConnectingDeviceMacAddresses: (ids: number[]) => void;
  disconnectingDeviceIds: number[];
  setDisconnectingDeviceIds: (ids: number[]) => void;
  onConnectDevice: (deviceId: string) => Promise < void > ;
  onDisconnectDevice: (deviceId: number) => Promise < void > ;
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
  connectingDeviceMacAddresses,
  setConnectingDeviceMacAddresses,
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
  const [identifyDeviceName, setIdentifyDeviceName] = useState < string | null > (null);
  const [devicesFoundCount, setDevicesFoundCount] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [devicesFound, setDevicesFound] = useState < number | null > (null);
  const listRef = useRef < HTMLDivElement > (null);


  const getBatteryIcon = (batteryLevel: number) => {
    if (batteryLevel <= 12) return battery0Icon;
    if (batteryLevel <= 37) return battery25Icon;
    if (batteryLevel <= 62) return battery50Icon;
    if (batteryLevel <= 87) return battery75Icon;
    return battery100Icon;
  };

  useEffect(() => {
    let unlisten;

    // We need an async function to handle the promise returned by `listen`
    async function setupListener() {
      unlisten = await listen < Device > ("new_ board", (event) => {
        setDevicesFoundCount(devicesFoundCount + 1);
        console.log("REACT: Received device-discovered event", event.payload);
        setDevices([event.payload]);
      });
    }

    if (isScanning) {
      setupListener();
    }

    return () => {
      if (unlisten) {
        unlisten(); // This detaches the event listener
      }
    };
  }, [isScanning]); // Re-run the effect whenever `isScanning` changes

  useEffect(() => {
    const handleScroll = () => {
      if (!listRef.current) return;
      const {
        scrollTop,
        scrollHeight,
        clientHeight
      } = listRef.current;
      const maxFade = 100;
      const topOpacity = Math.min(scrollTop / maxFade, 1);
      setTopFadeOpacity(topOpacity);
      const scrollBottom = scrollHeight - clientHeight - scrollTop;
      const bottomOpacity = Math.max(0, Math.min(scrollBottom / maxFade, 1));
      setBottomFadeOpacity(bottomOpacity);
    };
    const list = listRef.current;
    console.log(list);
    if (list) {
      list.addEventListener("scroll", handleScroll);
      handleScroll();
    }
    return () => {
      if (list) list.removeEventListener("scroll", handleScroll);
    };
  }, [devices]);

  const backendIdentifyDevice = async (_deviceName: string) => {
    return new Promise < void > ((resolve) => setTimeout(resolve, 50));
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
    setDevicesFoundCount(0)
    await commands.devices.scanDevices();
    //onScanResults(foundDevicesFromScan);
    //setDevicesFound(foundDevicesFromScan.length);
  };

  const handleCancelScan = async () => {
    await commands.devices.cancelScanDevices();
    setIsScanning(false);
    setDevicesFound(null);
  };

  const handleStartEditName = (deviceId: number, currentName: string) => {
    setEditingDeviceId(deviceId);
    setEditingDeviceName(currentName);
  };

  const handleNameInputChange = (
    event: React.ChangeEvent < HTMLInputElement > ,
  ) => {
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
    const connected = devices.filter((d) => d.status === "Connected");
    const active = devices.filter((d) => d.status === "Active");
    const disconnected = devices.filter((d) => d.status === "Disconnected");

    connected.sort(
      (a, b) =>
      new Date(a.lastConnected).getTime() -
      new Date(b.lastConnected).getTime(),
    );
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

  const sortedDevices = getSortedDevices();
  const connectedDevicesCount = devices.filter(
    (d) => d.status === "Connected",
  ).length;
  const connectedDevicesForPanel = sortedDevices.filter(
    (d) => d.status === "Connected",
  );
  const noDevices = sortedDevices.length === 0;

  return (
    <div className = "inside-page" >
      <div className = "page-header" >
        <span className = "page-title" > Devices </span>
        <button
          onClick = {
            isScanning ? handleCancelScan : handleScanDevices
          }
          className = {
            `scan-btn ${noDevices ? "scan-button-highlight" : ""}`
          }
          disabled = {
            isScanning
          } >
          {
            isScanning ? "Cancel Scan" : "Scan for Devices"
          }
        </button>
        {
          isScanning && < div className = "spinner" > </div>}
        {
          devicesFound !== null && !isScanning && (
            <div className = "devices-found-text" > {
              devicesFound
            } {
              devicesFound === 1 ? "device" : "devices"
            }
            found
            </div>
          )
        }
      </div>

      <div className = "main-content" >
        <div
          className = "devices-list-fade-top"
          style = {
            {
              opacity: topFadeOpacity
            }
          }
        />
        <div className = "devices-list"
        ref = {
            listRef
          } >
          {
            noDevices && (
              <div className = "h-full flex flex-col items-center justify-center text-center p-8 mt-8 bg-gray-100 rounded-lg shadow-inner" >
                <img
                  src = {
                    bluetoothDisconnectedIcon
                  }
                  alt = "No devices found"
                  className = "w-20 h-20 mb-6 opacity-50"
                />
                <p className = "text-xl text-gray-600" > No devices found. </p>
                <p className = "text-base text-gray-400" >
                  Click the "Scan for Devices"
                  button to search
                  for nearby
                  devices.
                </p>
              </div>
            )
          } {
            sortedDevices.map((device) => {
              const isDeviceDisabled =
                isScanning ||
                disconnectingDeviceIds.includes(device.id) ||
                connectingDeviceMacAddresses.includes(device.id);

              const isConnectDisabled =
                isDeviceDisabled ||
                (connectedDevicesCount >= 2 && device.status !== "Connected") ||
                device.status === "Disconnected";

              const connectTooltip =
                connectedDevicesCount >= 2 && device.status !== "Connected" ?
                "You can only have two boards connected at a time" :
                device.status === "Disconnected" ?
                "Device is disconnected" :
                "";

              const canEdit =
                (device.status === "Connected" || device.status === "Active") &&
                !isDeviceDisabled;

              return (
                <DeviceRow
                  key = {
                    device.id
                  }
                  device = {
                    device
                  }
                  editingDeviceId = {
                    editingDeviceId
                  }
                  editingDeviceName = {
                    editingDeviceName
                  }
                  isDeviceDisabled = {
                    isDeviceDisabled
                  }
                  isConnectDisabled = {
                    isConnectDisabled
                  }
                  connectTooltip = {
                    connectTooltip
                  }
                  canEdit = {
                    canEdit
                  }
                  disconnectingDeviceIds = {
                    disconnectingDeviceIds
                  }
                  connectingDeviceMacAddresses = {
                    connectingDeviceMacAddresses
                  }
                  onRemoveDevice = {
                    onRemoveDevice
                  }
                  handleStartEditName = {
                    handleStartEditName
                  }
                  handleNameInputChange = {
                    handleNameInputChange
                  }
                  handleSaveName = {
                    handleSaveName
                  }
                  handleCancelEditName = {
                    handleCancelEditName
                  }
                  handleIdentifyClick = {
                    handleIdentifyClick
                  }
                  onDisconnectDevice = {
                    onDisconnectDevice
                  }
                  onConnectDevice = {
                    onConnectDevice
                  }
                  formatLastConnected = {
                    formatLastConnected
                  }
                />
              );
            })
          }
          <div className = "device-container device-container-faux" />
          </div>
        <div
          className = "devices-list-fade"
          style = {
            {
              opacity: bottomFadeOpacity
            }
          }
        />

        <DeviceSessionList
          connectedDevicesForPanel = {
            connectedDevicesForPanel
          }
          editingDeviceId = {
            editingDeviceId
          }
          editingDeviceName = {
            editingDeviceName
          }
          isScanning = {
            isScanning
          }
          disconnectingDeviceIds = {
            disconnectingDeviceIds
          }
          connectingDeviceMacAddresses = {
            connectingDeviceMacAddresses
          }
          handleNameInputChange = {
            handleNameInputChange
          }
          handleSaveName = {
            handleSaveName
          }
          handleCancelEditName = {
            handleCancelEditName
          }
          handleStartEditName = {
            handleStartEditName
          }
          onDisconnectDevice = {
            onDisconnectDevice
          }
          getBatteryIcon = {
            getBatteryIcon
          }
        />
      </div>

      {
        isScanning && (
          <div className = "scan-overlay" >
            <div className = "scan-overlay-spinner" >
              <span className = "spinner" />
              <span className = "scan-overlay-text" > Scanning... </span>

              {
                devicesFoundCount > 0 && (
                  <p className = "scan-overlay-count" > {
                    `Found ${devicesFoundCount} devices so far...`
                  } </p>
                )
              }

              <button
                className = "scan-btn"
                style = {
                  {
                    marginTop: 24,
                    minWidth: 120
                  }
                }
                onClick = {
                  handleCancelScan
                } >
                Cancel
              </button>
            </div>
          </div>
        )
      }

      {
        showIdentifyPopup && (
          <div className = "identify-popup-overlay"
          onClick = {
            handleClosePopup
          } >
            <div className = "identify-popup"
            onClick = {
              (e) => e.stopPropagation()
            } >
              <p>
                The LED in < b > {
                  identifyDeviceName
                } </b> should be blinking
              </p>
              <button className = "popup-close-btn"
              onClick = {
                handleClosePopup
              } >
                OK
              </button>
            </div>
          </div>
        )
      }
    </div>
  );
}
