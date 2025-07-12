import React, {useState, useCallback, useRef} from "react";
import bluetoothDisconnectedIcon from "@/assets/bluetooth-disconnected-icon.svg";
import DeviceRow from "./DeviceRow";
import { Device } from "@/types";
import { commands } from "@/utils/requests.ts";
import DeviceSessionList from "@/pages/devices/DeviceSessionList.tsx";
import "./Devices.css";
import DeviceScanner from "@/pages/devices/DeviceScanner.tsx";
import {listen} from "@tauri-apps/api/event";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";

const DEVICES_QUERY_KEY = ["devices"];

export default function Devices() {
  const [showIdentifyPopup, setShowIdentifyPopup] = useState(false);
  const [identifyDeviceName, setIdentifyDeviceName] = useState<string | null>(
    null,
  );
  const [foundDevicesCount, setFoundDevicesCount] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const unlistenRef = useRef<(() => void) | null>(null);
  const queryClient = useQueryClient();

  const {
    data: devices = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: DEVICES_QUERY_KEY,
    queryFn: commands.devices.fetchDevices,
    staleTime: 10000,
  });

  const handleIdentifyClick = async (macAddress: string) => {
    await commands.devices.identifyDevice(macAddress);
  };

  const updateDeviceNameMutation = useMutation({
    mutationFn: ({ macAddress, deviceName }: { macAddress: string; deviceName: string }) =>
      commands.devices.updateDeviceName(macAddress, deviceName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DEVICES_QUERY_KEY });
    },
    onError: (error) => {
      console.error("Failed to update device name:", error);
    },
  });

  const removeDeviceMutation = useMutation({
    mutationFn: (macAddress: string) => commands.devices.removeDevice(macAddress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DEVICES_QUERY_KEY });
    },
    onError: (error) => {
      console.error("Failed to remove device:", error);
    },
  });

  const disconnectDeviceMutation = useMutation({
    mutationFn: (macAddress: string) => commands.devices.disconnectDevice(macAddress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DEVICES_QUERY_KEY });
    },
    onError: (error) => {
      console.error("Failed to disconnect device:", error);
    },
  });

  const connectDeviceMutation = useMutation({
    mutationFn: (macAddress: string) => commands.devices.connectDevice(macAddress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DEVICES_QUERY_KEY });
    },
    onError: (error) => {
      console.error("Failed to connect device:", error);
    },
  });

  const scanDevicesMutation = useMutation({
    mutationFn: commands.devices.scanDevices,
    onSuccess: async () => {
      setIsScanning(true);
      unlistenRef.current = await listen<Device>("new_board", (event) => {
        setFoundDevicesCount((prev) => prev + 1);
        console.log("REACT: Received device-discovered event", event.payload);
        queryClient.invalidateQueries({ queryKey: DEVICES_QUERY_KEY });
      });
    },
    onError: (error) => {
      console.error("Failed to start device scan:", error);
    },
  });

  const cancelScanMutation = useMutation({
    mutationFn: commands.devices.cancelScanDevices,
    onSuccess: () => {
      unlistenRef.current?.();
      setIsScanning(false);
      setFoundDevicesCount(0);
    },
    onError: (error) => {
      console.error("Failed to cancel device scan:", error);
    },
  });

  const handleSaveDeviceName = (macAddress: string, deviceName: string) => {
    updateDeviceNameMutation.mutate(macAddress, deviceName);
  };

  const handleRemoveDevice = async (macAddress: string) => {
    await commands.devices.removeDevice(macAddress);

    const devices = await commands.devices.fetchDevices();
    setDevices(devices);
  };

  const handleDisconnectDevice = async (macAddress: string) => {
    await commands.devices.disconnectDevice(macAddress);

    const devices = await commands.devices.fetchDevices();
    setDevices(devices);
  };

  const handleConnectDevice = async (macAddress: string) => {
    await commands.devices.connectDevice(macAddress);

    const devices = await commands.devices.fetchDevices();
    setDevices(devices);
  };

  const handleDeviceFound = async () => {
    const devices = await commands.devices.fetchDevices();
    setDevices(devices);
  };

  const handleGradientDevicesScroll = useCallback((e: any) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const maxFade = 100;

    // Only show top gradient if scrolled down
    const topOpacity = Math.min(scrollTop / maxFade, 1);

    // Only show bottom gradient if not at bottom
    const scrollBottom = scrollHeight - clientHeight - scrollTop;
    const bottomOpacity = Math.min(scrollBottom / maxFade, 1);

    e.currentTarget.style.setProperty("--top-opacity", topOpacity);
    e.currentTarget.style.setProperty("--bottom-opacity", bottomOpacity);
  }, []);

  const handleClosePopup = () => {
    setShowIdentifyPopup(false);
    setIdentifyDeviceName(null);
  };

  const handleScanDevices = async () => {
    setIsScanning(true);
    await commands.devices.scanDevices();

    unlistenRef.current = await listen<Device>("new_board", (event) => {
      setFoundDevicesCount(foundDevicesCount + 1);
      console.log("REACT: Received device-discovered event", event.payload);
      handleDeviceFound();
    });
  };

  const handleCancelScan = async () => {
    await commands.devices.cancelScanDevices();
    unlistenRef.current?.();

    setIsScanning(false);
    setFoundDevicesCount(0);
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

  const sortedDevices = getSortedDevices();
  const connectedDevices = sortedDevices.filter(
    (d) => d.status === "Connected",
  );
  const noDevices = sortedDevices.length === 0;

  if (isLoading) {
    return (
      <div className="inside-page">
        <div className="page-header">
          <span className="page-title">Devices</span>
        </div>
        <div className="main-content">
          <div className="flex items-center justify-center p-8">
            <p className="text-gray-600">Loading devices...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="inside-page">
        <div className="page-header">
          <span className="page-title">Devices</span>
        </div>
        <div className="main-content">
          <div className="flex items-center justify-center p-8">
            <p className="text-red-600">
              Failed to load devices: {error.message}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="inside-page">
      <div className="page-header">
        <span className="page-title">Devices</span>
        <button onClick={handleScanDevices} className="scan-btn">
          {"Scan for Devices"}
        </button>
      </div>

      <div className="main-content">
        <div className="devices-list" onScroll={handleGradientDevicesScroll}>
          {noDevices && (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 mt-8 bg-gray-100 rounded-lg shadow-inner">
              <img
                src={bluetoothDisconnectedIcon}
                alt="No devices found"
                className="w-20 h-20 mb-6 opacity-50"
              />
              <p className="text-xl text-gray-600"> No devices found. </p>
              <p className="text-base text-gray-400">
                Click the "Scan for Devices" button to search for nearby
                devices.
              </p>
            </div>
          )}{" "}
          {sortedDevices.map((device) => {
            return (
              <DeviceRow
                key={device.id}
                device={device}
                handleIdentifyClick={handleIdentifyClick}
                handleSaveDeviceName={handleSaveDeviceName}
                handleRemoveDevice={handleRemoveDevice}
                handleDisconnectDevice={handleDisconnectDevice}
                handleConnectDevice={handleConnectDevice}
              />
            );
          })}
        </div>

        <DeviceSessionList
          connectedDevices={connectedDevices}
          handleDisconnectDevice={handleDisconnectDevice}
        />
      </div>

      {/* DeviceScanner component - only renders when scanning */}
      {isScanning && (
        <DeviceScanner
          foundDevicesCount={foundDevicesCount}
          handleCancelScan={handleCancelScan}
        />
      )}

      {showIdentifyPopup && (
        <div className="identify-popup-overlay" onClick={handleClosePopup}>
          <div className="identify-popup" onClick={(e) => e.stopPropagation()}>
            <p>
              The LED in <b> {identifyDeviceName} </b> should be blinking
            </p>
            <button className="popup-close-btn" onClick={handleClosePopup}>
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
