import { Device } from "@/types";
import bluetoothIcon from "@/assets/bluetooth-connected-icon.svg";
import rippleIcon from "@/assets/ripple-icon.svg";
import wbbIconBlue from "@/assets/wbb-icon-line-blue.svg";
import battery0Icon from "@/assets/battery-0-icon.svg";
import battery25Icon from "@/assets/battery-25-icon.svg";
import battery50Icon from "@/assets/battery-50-icon.svg";
import battery75Icon from "@/assets/battery-75-icon.svg";
import battery100Icon from "@/assets/battery-100-icon.svg";
import { ToolkitButton } from "@/components/ToolkitButton.tsx";
import { convertNumberToMacAddress } from "@/pages/devices/Devices.tsx";

interface DeviceSessionListProps {
  connectedDevices: Device[];
  handleUnselectDevice: (macAddress: number) => void;
}

export default function DeviceSessionList({ connectedDevices, handleUnselectDevice }: DeviceSessionListProps) {
  const getBatteryIcon = (batteryLevel: number) => {
    if (batteryLevel <= 12) return battery0Icon;
    if (batteryLevel <= 37) return battery25Icon;
    if (batteryLevel <= 62) return battery50Icon;
    if (batteryLevel <= 87) return battery75Icon;
    return battery100Icon;
  };

  return (
    <div className="h-full flex flex-col justify-center gap-6 basis-120 overflow-y-hidden">
      {[0, 1].map((index) => {
        const device = connectedDevices[index];

        return (
          <div
            className="box-border flex w-full flex-1 flex-col justify-between rounded-xl bg-[var(--bg-secondary)]"
            key={`side-panel-${index}`}
          >
            {device ? (
              <div className="flex flex-col p-5 h-full rounded-xl shadow-[var(--shadow-light)]">
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

                <div className=" flex items-center justify-center">
                  <div className="relative flex min-h-80 max-w-70 items-center justify-center">
                    <img src={rippleIcon} className="absolute inset-0 h-full w-full opacity-50" />
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
              </div>
            ) : (
              <div className="flex h-full items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-white shadow-sm hover:border-grey-400 hover:bg-gray-50 transition-colors">
                <span className="text-gray-500 font-medium">Device slot available</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
