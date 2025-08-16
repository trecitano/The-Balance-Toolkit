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
import { ToolkitButton } from "@/components/ToolkitButton.tsx";

export const DEVICES_QUERY_KEY = ["devices"];
export const DevicesQuery = {
  queryKey: DEVICES_QUERY_KEY,
  queryFn: async () => {
    const [devices, selectedDevicesMacAddress, isScanning] = await Promise.all([
      commands.devices.fetchDevices(),
      commands.devices.selectedDevices(),
      commands.devices.isScanning(),
    ]);
    return { devices, selectedDevicesMacAddress, isScanning };
  },
};

export default function Devices() {
  const [showIdentifyPopup, setShowIdentifyPopup] = useState(false);
  const [identifyDeviceName, setIdentifyDeviceName] = useState<string | null>(null);
  const [foundDevicesCount, setFoundDevicesCount] = useState(0);
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
  const unlistenRef = useRef<(() => void) | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery(DevicesQuery);

  const identifyDeviceMutation = useMutation({
    mutationFn: (macAddress: number) => commands.devices.identifyDevice(macAddress),
    onError: (error) => console.error("Failed to identify device:", error),
  });

  const updateDeviceNameMutation = useMutation({
    mutationFn: ({ macAddress, deviceName }: { macAddress: number; deviceName: string }) =>
      commands.devices.updateDeviceName(macAddress, deviceName),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DEVICES_QUERY_KEY }),
    onError: (error) => console.error("Failed to update device name:", error),
  });

  const removeDeviceMutation = useMutation({
    mutationFn: (macAddress: number) => commands.devices.removeDevice(macAddress),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DEVICES_QUERY_KEY }),
    onError: (error) => console.error("Failed to remove device:", error),
  });

  const selectDeviceForSessionMutation = useMutation({
    mutationFn: (macAddress: number) => commands.devices.selectDevice(macAddress),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DEVICES_QUERY_KEY }),
    onError: (error) => console.error("Failed to connect device:", error),
  });

  const unselectDeviceForSessionMutation = useMutation({
    mutationFn: (macAddress: number) => commands.devices.unselectDevice(macAddress),
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

  const handleStartEditName = (deviceId: string) => {
    console.log("Starting edit for device:", deviceId);
    setEditingDeviceId(deviceId);
  };

  // Handlers that need parameter transformation or additional logic
  const handleSaveDeviceName = (macAddress: number, deviceName: string) => {
    updateDeviceNameMutation.mutate({ macAddress, deviceName });
    setEditingDeviceId(null);
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

    connected.sort((a, b) => new Date(a.lastConnected).getTime() - new Date(b.lastConnected).getTime());
    disconnected.sort((a, b) => a.name.localeCompare(b.name));

    return [...connected, ...disconnected];
  };

  const { devices, selectedDevicesMacAddress, isScanning } = data ?? {
    devices: [] as Device[],
    selectedDevicesMacAddress: [] as number[],
    isScanning: false,
  };

  const sortedDevices = sortDevices(devices);
  const noDevices = sortedDevices.length === 0;
  const selectedDevices = devices!.filter((d) => selectedDevicesMacAddress!.includes(d.macAddress));

  return (
    <div className="inside-page">
      <div className="page-header">
        <span className="page-title">Devices</span>
        <ToolkitButton
          type="button"
          variant="grey"
          onClick={handleScanDevices}
          disabled={scanDevicesMutation.isPending || isScanning}
        >
          {scanDevicesMutation.isPending || isScanning ? "Scanning..." : "Scan for Devices"}
        </ToolkitButton>
      </div>

      <div className="main-content">
        <div className="devices-list" onScroll={handleGradientDevicesScroll}>
          {noDevices && (
            <div className="mt-8 flex h-full flex-col items-center justify-center rounded-lg bg-gray-100 p-8 text-center shadow-inner">
              <img src={bluetoothDisconnectedIcon} alt="No devices found" className="mb-6 h-20 w-20 opacity-50" />
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
              isEditing={editingDeviceId === device.id}
              handleStartEditName={handleStartEditName}
              handleSaveDeviceName={handleSaveDeviceName}
              handleIdentifyClick={(macAddress) => identifyDeviceMutation.mutate(macAddress)}
              handleRemoveDevice={(macAddress) => removeDeviceMutation.mutate(macAddress)}
              handleSelectDeviceForSession={(macAddress) => selectDeviceForSessionMutation.mutate(macAddress)}
            />
          ))}
        </div>

        <DeviceSessionList
          connectedDevices={selectedDevices}
          handleUnselectDevice={(macAddress) => unselectDeviceForSessionMutation.mutate(macAddress)}
        />
      </div>

      {isScanning && <DeviceScanner foundDevicesCount={foundDevicesCount} handleCancelScan={handleCancelScan} />}

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
