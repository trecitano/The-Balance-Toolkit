import { NintendoDevice } from "@/types";
import bluetoothIcon from "@/assets/bluetooth-connected-icon.svg";
import rippleIcon from "@/assets/ripple-icon.svg";
import wbbIconBlue from "@/assets/wbb-top-blue.png";
import { ToolkitButton } from "@/components/ToolkitButton.tsx";
import { convertNumberToMacAddress } from "@/utils/macAddress.ts";
import ToolkitContainer from "@/components/ToolkitContainer.tsx";
import { sessionIcon } from "@/assets/icons";

interface DeviceSessionListProps {
  /** Boards selected for the next session, at most two. */
  sessionDevices: NintendoDevice[];
  onLeaveSession: (macAddress: number) => void;
}

export default function DeviceSessionList({ sessionDevices, onLeaveSession }: DeviceSessionListProps) {
  return (
    <div className="flex w-90 flex-col gap-6">
      {[0, 1].map((index) => {
        const device = sessionDevices[index];

        return (
          <ToolkitContainer
            className="flex min-h-0 flex-1 flex-col justify-between gap-5 p-8"
            key={`side-panel-${index}`}
          >
            {device ? (
              <>
                <div className="flex items-center gap-2">
                  <img alt="" src={bluetoothIcon} className="size-6" />
                  <div>
                    <p className="font-medium break-words">{device.name}</p>
                    <p>{convertNumberToMacAddress(device.macAddress)}</p>
                  </div>
                </div>

                {/* The board fits the space left by the name and buttons, so a long name can't push it over them. */}
                <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
                  <img alt="" src={rippleIcon} className="absolute inset-0 h-full w-full object-contain opacity-10" />
                  <img alt="" src={wbbIconBlue} className="relative max-h-full w-4/5 object-contain" />
                </div>

                <div className="flex justify-end gap-(--space-sm)">
                  <ToolkitButton type="button" color="red" onClick={() => onLeaveSession(device.macAddress)}>
                    Disconnect
                  </ToolkitButton>
                  <ToolkitButton to="/session" color="blue" iconUrl={sessionIcon}>
                    <span className="inline-flex items-center gap-1.5">
                      Session
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 16 16"
                        className="size-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 8h10M9 4l4 4-4 4" />
                      </svg>
                    </span>
                  </ToolkitButton>
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center">
                <span className="font-medium text-gray-500">Session slot available</span>
              </div>
            )}
          </ToolkitContainer>
        );
      })}
    </div>
  );
}
