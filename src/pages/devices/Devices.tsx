import React, { useState, useCallback, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import bluetoothDisconnectedIcon from "@/assets/bluetooth-disconnected-icon.svg";
import DeviceRow from "./DeviceRow";
import { Device } from "@/types";
import { commands } from "@/utils/requests.ts";
import DeviceSessionList from "@/pages/devices/DeviceSessionList.tsx";
import "./Devices.css";
import { ToolkitButton } from "@/components/ToolkitButton.tsx";
import Heading from "@/components/PageTitle.tsx";
import { Modal } from "@/components/Modal.tsx";
import ToolkitContainer from "@/components/ToolkitContainer.tsx";

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

export const convertNumberToMacAddress = (number: number): string => {
  return number
    .toString(16)
    .toUpperCase()
    .padStart(12, "0")
    .match(/.{1,2}/g)!
    .join(":");
};

export default function Devices() {
  const [foundDevicesCount, setFoundDevicesCount] = useState(0);
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
  const unlistenRef = useRef<(() => void) | null>(null);
  const queryClient = useQueryClient();
  const [showIdentifyModal, setShowIdentifyModal] = useState<Device | null>(null);

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
    onSuccess: async () => {
      unlistenRef.current = await listen<Device>("new_board", (_) => {
        setFoundDevicesCount((prev) => prev + 1);
        queryClient.invalidateQueries({ queryKey: DEVICES_QUERY_KEY });
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

  const handleGradientDevicesScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const maxFade = 100;

    const topOpacity = Math.min(scrollTop / maxFade, 1);
    const scrollBottom = scrollHeight - clientHeight - scrollTop;
    const bottomOpacity = Math.min(scrollBottom / maxFade, 1);

    e.currentTarget.style.setProperty("--top-opacity", topOpacity);
    e.currentTarget.style.setProperty("--bottom-opacity", bottomOpacity);
  }, []);

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

  console.log("isScanning", isScanning);
  const sortedDevices = sortDevices(devices);
  const noDevices = sortedDevices.length === 0;
  const selectedDevices = devices!.filter((d) => selectedDevicesMacAddress!.includes(d.macAddress));

  return (
    <>
      <header className="mb-5 grid grid-cols-8">
        <Heading className={"flex-shrink-0"}>Devices</Heading>

        <ToolkitButton
          type="button"
          variant="grey"
          onClick={handleScanDevices}
          disabled={scanDevicesMutation.isPending || isScanning}
        >
          <span>{scanDevicesMutation.isPending || isScanning ? "Scanning..." : "Scan for Devices"}</span>
        </ToolkitButton>
      </header>

      <div className="flex h-[75dvh] flex-1 gap-5">
        <ToolkitContainer className="flex flex-1 flex-col p-10">
          <div
            className={"devices-list flex h-full flex-col gap-4 overflow-y-auto"}
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
                  variant="grey"
                  onClick={handleScanDevices}
                  disabled={scanDevicesMutation.isPending || isScanning}
                >
                  <span>{scanDevicesMutation.isPending || isScanning ? "Scanning..." : "Scan for Devices"}</span>
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

      <Modal open={isScanning} onClose={handleCancelScan}>
        <div className="flex flex-col gap-6">
          <div>
            <span className="spinner" />
          </div>
          <span className="text-2xl font-semibold text-(--primary)">Scanning...</span>

          <p className="text-lg">{`Found ${foundDevicesCount} devices so far...`}</p>

          <ToolkitButton type="button" variant="blue" onClick={handleCancelScan}>
            Cancel
          </ToolkitButton>
        </div>
      </Modal>

      <Modal open={!!showIdentifyModal} onClose={() => setShowIdentifyModal(null)}>
        <h4 className="mb-4 text-lg font-bold">Identifying {showIdentifyModal?.name}</h4>
        <p className="mb-6 text-base leading-relaxed text-gray-700">
          A flashing sequence will appear on the LED of the board.
        </p>
        <div className="flex justify-center gap-6">
          <ToolkitButton type="button" variant="grey" onClick={() => setShowIdentifyModal(null)}>
            Close
          </ToolkitButton>
        </div>
      </Modal>
    </>
  );
}
