import { Device } from "@/types";
import bluetoothIcon from "@/assets/bluetooth-connected-icon.svg";
import rippleIcon from "@/assets/ripple-icon.svg";
import wbbIconBlue from "@/assets/wbb-icon-line-blue.svg";
import { ToolkitButton } from "@/components/ToolkitButton.tsx";
import { convertNumberToMacAddress } from "@/pages/devices/Devices.tsx";
import ToolkitContainer from "@/components/ToolkitContainer.tsx";

interface DeviceSessionListProps {
  connectedDevices: Device[];
  handleUnselectDevice: (macAddress: number) => void;
}

export default function DeviceSessionList({ connectedDevices, handleUnselectDevice }: DeviceSessionListProps) {
  return (
    <div className="flex h-full basis-120 flex-col gap-6">
      {[0, 1].map((index) => {
        const device = connectedDevices[index];

        return (
          <ToolkitContainer className="flex w-full flex-1 flex-col justify-between p-8" key={`side-panel-${index}`}>
            {device ? (
              <>
                <div className="mb-5 flex items-center gap-[var(--space-sm)]">
                  <img
                    src={bluetoothIcon}
                    alt="Bluetooth"
                    className="h-[var(--icon-size-md)] w-[var(--icon-size-md)]"
                  />
                  <div className="flex min-w-0 flex-1 flex-col items-start">
                    <div className="flex max-w-full min-w-0 items-center gap-[0.4vw]">
                      <span
                        className="max-w-[20vw] min-w-0 shrink overflow-hidden font-medium text-ellipsis whitespace-nowrap text-[var(--text-lg)]"
                        title={device.name}
                      >
                        {device.name}
                      </span>
                    </div>
                    <span className="text-[var(--text-light)] text-[var(--text-md)]">
                      {convertNumberToMacAddress(device.macAddress)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-center">
                  <div className="relative flex min-h-60 max-w-70 items-center justify-center">
                    <img src={rippleIcon} className="absolute inset-0 h-full w-full opacity-10" />
                    <img src={wbbIconBlue} className="z-10 h-4/5 w-4/5" />
                  </div>
                </div>

                <div className="mt-auto flex justify-end gap-(--space-sm)">
                  <ToolkitButton type={"button"} variant="red" onClick={() => handleUnselectDevice(device.macAddress)}>
                    Disconnect
                  </ToolkitButton>
                  <ToolkitButton to="/session" variant="blue">
                    Go to Session →
                  </ToolkitButton>
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center">
                <span className="font-medium text-gray-500">Device slot available</span>
              </div>
            )}
          </ToolkitContainer>
        );
      })}
    </div>
  );
}
