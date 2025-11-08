import { Device } from "@/types";
import bluetoothIcon from "@/assets/bluetooth-connected-icon.svg";
import rippleIcon from "@/assets/ripple-icon.svg";
import wbbIconBlue from "@/assets/wbb-top-blue.svg";
import { ToolkitButton } from "@/components/ToolkitButton.tsx";
import { convertNumberToMacAddress } from "@/pages/devices/Devices.tsx";
import ToolkitContainer from "@/components/ToolkitContainer.tsx";
import { sessionIcon } from "@/components/navigation/Navigation.tsx";

interface DeviceSessionListProps {
  connectedDevices: Device[];
  handleUnselectDevice: (macAddress: number) => void;
}

export default function DeviceSessionList({ connectedDevices, handleUnselectDevice }: DeviceSessionListProps) {
  return (
    <div className="flex w-90 flex-col gap-6">
      {[0, 1].map((index) => {
        const device = connectedDevices[index];

        return (
          <ToolkitContainer
            className="flex min-h-89 flex-1 flex-col justify-between gap-5 p-8"
            key={`side-panel-${index}`}
          >
            {device ? (
              <>
                <div className="flex items-center gap-2">
                  <img src={bluetoothIcon} className="size-6" />
                  <div>
                    <p className="font-medium"> {device.name} </p>
                    <p> {convertNumberToMacAddress(device.macAddress)} </p>
                  </div>
                </div>

                <div className="relative flex min-h-0 flex-1 items-center justify-center">
                  <img src={wbbIconBlue} className="absolute z-10 w-4/5" />
                  <img src={rippleIcon} className="absolute inset-0 h-full w-4/5 w-full opacity-10" />
                </div>

                <div className="flex justify-end gap-(--space-sm)">
                  <ToolkitButton type={"button"} color="red" onClick={() => handleUnselectDevice(device.macAddress)}>
                    Disconnect
                  </ToolkitButton>
                  <ToolkitButton to="/session" color="blue" iconUrl={sessionIcon}>
                    Session →
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
