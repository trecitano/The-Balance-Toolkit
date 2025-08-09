import { useState, useCallback, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import bluetoothDisconnectedIcon from "@/assets/bluetooth-disconnected-icon.svg";
import DeviceRow from "./DeviceRow";
import { Device } from "@/types";
import { commands } from "@/utils/requests.ts";
import DeviceSessionList from "@/pages/devices/DeviceSessionList.tsx";
import "./Devices.css";
import DeviceScanner from "@/pages/devices/DeviceScanner.tsx";

const DEVICES_QUERY_KEY = ["devices"];
export const DevicesQuery = {
  queryKey: DEVICES_QUERY_KEY,
  queryFn: async () => {
    const [devices, selectedDeviceIds, isScanning] = await Promise.all([
      commands.devices.fetchDevices(),
      commands.devices.selectedDevices(),
      commands.devices.isScanning(),
    ]);
    return { devices, selectedDeviceIds, isScanning };
  },
  staleTime: 10000,
};

export default function Devices() {
  const [showIdentifyPopup, setShowIdentifyPopup] = useState(false);
  const [identifyDeviceName, setIdentifyDeviceName] = useState<string | null>(null);
  const [foundDevicesCount, setFoundDevicesCount] = useState(0);
  const unlistenRef = useRef<(() => void) | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery(DevicesQuery);

  const identifyDeviceMutation = useMutation({
    mutationFn: (deviceId: string) => commands.devices.identifyDevice(deviceId),
    onError: (error) => console.error("Failed to identify device:", error),
  });

  const updateDeviceNameMutation = useMutation({
    mutationFn: ({ deviceId, deviceName }: { deviceId: string; deviceName: string }) =>
      commands.devices.updateDeviceName(deviceId, deviceName),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DEVICES_QUERY_KEY }),
    onError: (error) => console.error("Failed to update device name:", error),
  });

  const removeDeviceMutation = useMutation({
    mutationFn: (deviceId: string) => commands.devices.removeDevice(deviceId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DEVICES_QUERY_KEY }),
    onError: (error) => console.error("Failed to remove device:", error),
  });

  const selectDeviceForSessionMutation = useMutation({
    mutationFn: (deviceId: string) => commands.devices.selectDevice(deviceId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DEVICES_QUERY_KEY }),
    onError: (error) => console.error("Failed to connect device:", error),
  });

  const unselectDeviceForSessionMutation = useMutation({
    mutationFn: (deviceId: string) => commands.devices.unselectDevice(deviceId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DEVICES_QUERY_KEY }),
    onError: (error) => console.error("Failed to disconnect device:", error),
  });

  const scanDevicesMutation = useMutation({
    mutationFn: commands.devices.scanDevices,
    onSuccess: async () => {
      unlistenRef.current = await listen<Device>("new_board", (event) => {
        setFoundDevicesCount((prev) => prev + 1);
        console.log("REACT: Received device-discovered event", event.payload);
      });
      queryClient.invalidateQueries({ queryKey: DEVICES_QUERY_KEY });
    },
    onError: (error) => console.error("Failed to start device scan:", error),
  });

  const cancelScanMutation = useMutation({
    mutationFn: commands.devices.cancelScanDevices,
    onSuccess: () => {
      unlistenRef.current?.();
      setFoundDevicesCount(0);
      queryClient.invalidateQueries({ queryKey: DEVICES_QUERY_KEY });
    },
    onError: (error) => console.error("Failed to cancel device scan:", error),
  });

  // Handlers that need parameter transformation or additional logic
  const handleSaveDeviceName = (deviceId: string, deviceName: string) => {
    updateDeviceNameMutation.mutate({ deviceId, deviceName });
  };

  const handleScanDevices = () => {
    scanDevicesMutation.mutate();
  };

  const handleCancelScan = () => {
    cancelScanMutation.mutate();
  };

  const handleGradientDevicesScroll = useCallback((e: any) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const maxFade = 100;

    const topOpacity = Math.min(scrollTop / maxFade, 1);
    const scrollBottom = scrollHeight - clientHeight - scrollTop;
    const bottomOpacity = Math.min(scrollBottom / maxFade, 1);

    e.currentTarget.style.setProperty("--top-opacity", topOpacity);
    e.currentTarget.style.setProperty("--bottom-opacity", bottomOpacity);
  }, []);

  const handleClosePopup = () => {
    setShowIdentifyPopup(false);
    setIdentifyDeviceName(null);
  };

  if (isLoading) {
    return <div className="inside-page"></div>;
  }

  if (error) {
    return (
      <div className="inside-page">
        <div className="page-header">
          <span className="page-title">Devices</span>
        </div>
        <div className="main-content">
          <div className="flex items-center justify-center p-8">
            <p className="text-red-600">Failed to load devices: {error.message}</p>
          </div>
        </div>
      </div>
    );
  }

  const sortDevices = (devices: Device[]): Device[] => {
    if (!Array.isArray(devices)) return [];
    const connected = devices.filter((d) => d.isConnected);
    const disconnected = devices.filter((d) => !d.isConnected);

    connected.sort(
      (a, b) => new Date(a.lastConnected).getTime() - new Date(b.lastConnected).getTime(),
    );
    disconnected.sort((a, b) => a.name.localeCompare(b.name));

    return [...connected, ...disconnected];
  };

  const { devices, selectedDeviceIds, isScanning } = data ?? {
    devices: [],
    selectedDeviceIds: [],
    isScanning: false,
  };

  const sortedDevices = sortDevices(devices);
  const noDevices = sortedDevices.length === 0;
  const selectedDevices = devices!.filter((d) => selectedDeviceIds.includes(d.id));

  return (
    <div className="inside-page">
      <div className="page-header">
        <span className="page-title">Devices</span>
        <button
          onClick={handleScanDevices}
          className="scan-btn"
          disabled={scanDevicesMutation.isPending || isScanning}
        >
          {scanDevicesMutation.isPending || isScanning ? "Scanning..." : "Scan for Devices"}
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
              <p className="text-xl text-gray-600">No devices found.</p>
              <p className="text-base text-gray-400">
                Click the "Scan for Devices" button to search for nearby devices.
              </p>
            </div>
          )}
          {sortedDevices.map((device) => (
            <DeviceRow
              key={device.id}
              device={device}
              handleIdentifyClick={(deviceId) => identifyDeviceMutation.mutate(deviceId)}
              handleSaveDeviceName={handleSaveDeviceName}
              handleRemoveDevice={(deviceId) => removeDeviceMutation.mutate(deviceId)}
              handleDisconnectDevice={(deviceId) => disconnectDeviceMutation.mutate(deviceId)}
              handleSelectDeviceForSession={(deviceId) =>
                selectDeviceForSessionMutation.mutate(deviceId)
              }
            />
          ))}
        </div>

        <DeviceSessionList
          connectedDevices={selectedDevices}
          handleUnselectDevice={(deviceId) => unselectDeviceForSessionMutation.mutate(deviceId)}
        />
      </div>

      {isScanning && (
        <DeviceScanner foundDevicesCount={foundDevicesCount} handleCancelScan={handleCancelScan} />
      )}

      {showIdentifyPopup && (
        <div className="identify-popup-overlay" onClick={handleClosePopup}>
          <div className="identify-popup" onClick={(e) => e.stopPropagation()}>
            <p>
              The LED in <b>{identifyDeviceName}</b> should be blinking
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
