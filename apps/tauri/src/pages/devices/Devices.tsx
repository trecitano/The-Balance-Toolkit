import { useState, useEffect, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { events } from "@/bindings";
import bluetoothDisconnectedIcon from "@/assets/bluetooth-disconnected-icon.svg";
import DeviceRow from "./DeviceRow";
import { Device } from "@/types";
import { commands } from "@/utils/requests.ts";
import DeviceSessionList from "@/pages/devices/DeviceSessionList.tsx";
import { ToolkitButton } from "@/components/ToolkitButton.tsx";
import PageTitle from "@/components/PageTitle.tsx";
import ToolkitContainer from "@/components/ToolkitContainer.tsx";
import IdentifyDeviceModal from "@/pages/devices/IdentifyDeviceModal.tsx";
import ScanningModal from "@/pages/devices/ScanningModal.tsx";
import CalibrationModal from "@/pages/devices/CalibrationModal.tsx";
import { DEVICES_QUERY_KEY, DevicesQuery } from "@/pages/devices/devicesQuery.ts";

export default function Devices() {
  const [foundDevicesCount, setFoundDevicesCount] = useState(0);
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Boards found while scanning, and boards that stopped answering. One listener each per
  // mount, removed on unmount.
  useEffect(() => {
    const refetch = () => queryClient.invalidateQueries({ queryKey: DEVICES_QUERY_KEY });
    const unlistenPromises = [
      events.newBoard.listen(() => {
        setFoundDevicesCount((prev) => prev + 1);
        refetch();
      }),
      events.boardDisconnected.listen(refetch),
    ];
    return () => {
      unlistenPromises.forEach((promise) => promise.then((unlisten) => unlisten()));
    };
  }, [queryClient]);
  const [showIdentifyModal, setShowIdentifyModal] = useState<Device | null>(null);
  const [showCalibrationModal, setShowCalibrationModal] = useState<Device | null>(null);

  const { data } = useQuery(DevicesQuery);

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
    onSuccess: () => {
      setFoundDevicesCount(0);
      queryClient.invalidateQueries({ queryKey: DEVICES_QUERY_KEY });
    },
    onError: (error) => console.error("Failed to start device scan:", error),
  });

  const cancelScanMutation = useMutation({
    mutationFn: commands.devices.cancelScanDevices,
    onSuccess: () => {
      setFoundDevicesCount(0);
      queryClient.invalidateQueries({ queryKey: DEVICES_QUERY_KEY });
    },
    onError: (error) => console.error("Failed to cancel device scan:", error),
  });

  const handleStartEditName = (deviceId: string) => {
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

  const handleGradientDevicesScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const maxFade = 100;

    const topOpacity = Math.min(scrollTop / maxFade, 1);
    const scrollBottom = scrollHeight - clientHeight - scrollTop;
    const bottomOpacity = Math.min(scrollBottom / maxFade, 1);

    e.currentTarget.style.setProperty("--top-opacity", String(topOpacity));
    e.currentTarget.style.setProperty("--bottom-opacity", String(bottomOpacity));
  }, []);

  const sortDevices = (devices: Device[]): Device[] => {
    if (!Array.isArray(devices)) return [];
    const connected = devices.filter((d) => d.isConnected);
    const disconnected = devices.filter((d) => !d.isConnected);

    // A board that has never been seen disconnected has no timestamp; sort it first.
    const lastConnected = (d: Device) => (d.lastConnected ? new Date(d.lastConnected).getTime() : 0);
    connected.sort((a, b) => lastConnected(a) - lastConnected(b));
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
    <div className={"flex h-full flex-col"}>
      <header className="mb-5 grid grid-cols-7">
        <PageTitle className={"flex-shrink-0"}>Devices</PageTitle>

        <ToolkitButton
          type="button"
          color="grey"
          className={"max-w-35"}
          onClick={handleScanDevices}
          disabled={scanDevicesMutation.isPending || isScanning}
        >
          <span>{scanDevicesMutation.isPending || isScanning ? "Scanning..." : "Scan for devices"}</span>
        </ToolkitButton>
      </header>

      <div className="flex h-full min-h-0 gap-5">
        <ToolkitContainer className="h-full grow p-10">
          <div
            className={"mask-vertical-scroll flex h-full flex-col gap-4 overflow-y-auto"}
            onScroll={handleGradientDevicesScroll}
          >
            {noDevices && (
              <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                <img src={bluetoothDisconnectedIcon} alt="No devices found" className="mb-6 h-20 w-20 opacity-50" />
                <p className="text-xl text-gray-600">No devices found.</p>
                <p className="mb-5 text-base text-gray-400">
                  {`Click the "Scan for Devices" button to search for nearby devices.`}
                </p>
                <ToolkitButton
                  type="button"
                  color="grey"
                  onClick={handleScanDevices}
                  disabled={scanDevicesMutation.isPending || isScanning}
                >
                  <span>{scanDevicesMutation.isPending || isScanning ? "Scanning..." : "Scan for devices"}</span>
                </ToolkitButton>
              </div>
            )}
            {sortedDevices.map((device) => (
              <DeviceRow
                key={device.id}
                device={device}
                isEditing={editingDeviceId === device.id}
                isSelected={selectedDevices.some((d) => d.macAddress === device.macAddress)}
                cannotConnect={!device.isConnected || selectedDevices.length >= 2}
                handleStartEditName={handleStartEditName}
                handleSaveDeviceName={handleSaveDeviceName}
                handleIdentifyClick={(device) => {
                  setShowIdentifyModal(device);
                  identifyDeviceMutation.mutate(device.macAddress);
                }}
                handleCalibrationClick={(device) => {
                  setShowCalibrationModal(device);
                }}
                handleUnselectDevice={(macAddress) => unselectDeviceForSessionMutation.mutate(macAddress)}
                handleRemoveDevice={(macAddress) => removeDeviceMutation.mutate(macAddress)}
                handleSelectDeviceForSession={(macAddress) => selectDeviceForSessionMutation.mutate(macAddress)}
              />
            ))}
          </div>
        </ToolkitContainer>

        <DeviceSessionList
          connectedDevices={selectedDevices}
          handleUnselectDevice={(macAddress) => unselectDeviceForSessionMutation.mutate(macAddress)}
        />
      </div>

      <ScanningModal open={isScanning} onClose={handleCancelScan} foundDevicesCount={foundDevicesCount} />
      <IdentifyDeviceModal device={showIdentifyModal} onClose={() => setShowIdentifyModal(null)} />
      <CalibrationModal device={showCalibrationModal} onClose={() => setShowCalibrationModal(null)} />
    </div>
  );
}
