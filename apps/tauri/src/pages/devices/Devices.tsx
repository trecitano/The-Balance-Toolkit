import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { events } from "@/bindings";
import bluetoothDisconnectedIcon from "@/assets/bluetooth-disconnected-icon.svg";
import DeviceRow from "./DeviceRow";
import { NintendoDevice } from "@/types";
import { commands } from "@/utils/requests.ts";
import DeviceSessionList from "@/pages/devices/DeviceSessionList.tsx";
import { ToolkitButton } from "@/components/ToolkitButton.tsx";
import PageTitle from "@/components/PageTitle.tsx";
import ToolkitContainer from "@/components/ToolkitContainer.tsx";
import IdentifyDeviceModal from "@/pages/devices/IdentifyDeviceModal.tsx";
import ScanningModal from "@/pages/devices/ScanningModal.tsx";
import CalibrationModal from "@/pages/devices/CalibrationModal.tsx";
import { DevicesQuery, refreshDevices } from "@/queries/toolkit";
import { useTauriEvent } from "@/hooks/useTauriEvent";
import { useAction } from "@/hooks/useAction";
import { useConfirm } from "@/hooks/useConfirm";
import { QueryStatus } from "@/components/QueryStatus";
import { sortDevices } from "@/utils/devices.ts";
import ZoomToFill from "@/components/ZoomToFill.tsx";

export default function Devices() {
  const [foundDevicesCount, setFoundDevicesCount] = useState(0);
  // The board being renamed and the name typed so far, shown wherever the board appears.
  const [rename, setRename] = useState<{ id: string; name: string } | null>(null);
  const [identifying, setIdentifying] = useState<NintendoDevice | null>(null);
  const [calibrating, setCalibrating] = useState<NintendoDevice | null>(null);
  const queryClient = useQueryClient();
  const query = useQuery(DevicesQuery);
  const action = useAction(() => refreshDevices(queryClient));
  const { confirm, ConfirmDialog } = useConfirm();

  useTauriEvent(events.newBoard, () => setFoundDevicesCount((previous) => previous + 1));

  const scan = () =>
    action.run(async () => {
      setFoundDevicesCount(0);
      await commands.devices.scanDevices();
    });

  const handleGradientDevicesScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const maxFade = 100;

    const topOpacity = Math.min(scrollTop / maxFade, 1);
    const scrollBottom = scrollHeight - clientHeight - scrollTop;
    const bottomOpacity = Math.min(scrollBottom / maxFade, 1);

    e.currentTarget.style.setProperty("--top-opacity", String(topOpacity));
    e.currentTarget.style.setProperty("--bottom-opacity", String(bottomOpacity));
  }, []);

  if (query.isPending || !query.data)
    return <QueryStatus pending={query.isPending} error={query.error} onRetry={() => void query.refetch()} />;

  const { devices, selectedDevicesMacAddress, isScanning } = query.data;
  const sortedDevices = sortDevices(devices);
  const withTypedName = (device: NintendoDevice) =>
    rename?.id === device.id ? { ...device, name: rename.name.trim() || device.name } : device;
  const sessionDevices = devices.filter((d) => selectedDevicesMacAddress.includes(d.macAddress)).map(withTypedName);
  const scanDisabled = action.isPending || isScanning;
  const scanLabel = isScanning ? "Scanning..." : "Scan for devices";

  return (
    <ZoomToFill className="flex h-full flex-col">
      <QueryStatus error={action.error || query.error} />
      <header className="mb-5 grid grid-cols-7">
        <PageTitle className="flex-shrink-0">Devices</PageTitle>

        <ToolkitButton type="button" color="grey" className="max-w-35" onClick={scan} disabled={scanDisabled}>
          {scanLabel}
        </ToolkitButton>
      </header>

      <div className="flex h-full min-h-0 gap-5">
        <ToolkitContainer className="h-full grow p-10">
          <div
            className="mask-vertical-scroll flex h-full flex-col gap-4 overflow-y-auto"
            onScroll={handleGradientDevicesScroll}
          >
            {sortedDevices.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                <img src={bluetoothDisconnectedIcon} alt="No devices found" className="mb-6 h-20 w-20 opacity-50" />
                <p className="text-xl text-gray-600">No devices found.</p>
                <p className="mb-5 text-base text-gray-400">
                  {`Click the "Scan for Devices" button to search for nearby devices.`}
                </p>
                <ToolkitButton type="button" color="grey" onClick={scan} disabled={scanDisabled}>
                  {scanLabel}
                </ToolkitButton>
              </div>
            )}
            {sortedDevices.map((device) => {
              const inSession = selectedDevicesMacAddress.includes(device.macAddress);
              return (
                <DeviceRow
                  key={device.id}
                  device={device}
                  typedName={rename?.id === device.id ? rename.name : null}
                  inSession={inSession}
                  cannotJoin={!device.isConnected || sessionDevices.length >= 2}
                  busy={action.isPending}
                  onStartRename={() => setRename({ id: device.id, name: device.name })}
                  onTypeName={(name) => setRename({ id: device.id, name })}
                  onCancelRename={() => setRename(null)}
                  onSaveName={(name) =>
                    action.run(async () => {
                      await commands.devices.updateDeviceName(device.macAddress, name);
                      setRename(null);
                    })
                  }
                  onIdentify={() => {
                    setIdentifying(device);
                    action.run(() => commands.devices.identifyDevice(device.macAddress));
                  }}
                  onCalibrate={() => setCalibrating(device)}
                  onJoinSession={() => action.run(() => commands.devices.selectDevice(device.macAddress))}
                  onLeaveSession={() => action.run(() => commands.devices.unselectDevice(device.macAddress))}
                  onRemove={async () => {
                    const forget = await confirm({
                      title: "Forget this board?",
                      message: (
                        <>
                          <strong className="font-semibold text-gray-900">{device.name}</strong> will be removed from
                          this computer{inSession && " and from the session"}. To use it again, you'll need to scan for
                          it again.
                        </>
                      ),
                      confirmText: "Forget board",
                      destructive: true,
                    });
                    if (forget) action.run(() => commands.devices.removeDevice(device.macAddress));
                  }}
                />
              );
            })}
          </div>
        </ToolkitContainer>

        <DeviceSessionList
          sessionDevices={sessionDevices}
          onLeaveSession={(macAddress) => action.run(() => commands.devices.unselectDevice(macAddress))}
        />
      </div>

      <ScanningModal
        open={isScanning}
        onClose={() => action.run(commands.devices.cancelScanDevices)}
        foundDevicesCount={foundDevicesCount}
      />
      <IdentifyDeviceModal device={identifying} onClose={() => setIdentifying(null)} />
      <CalibrationModal device={calibrating} onClose={() => setCalibrating(null)} />
      {ConfirmDialog}
    </ZoomToFill>
  );
}
