import { Modal } from "@/components/Modal";
import { ToolkitButton } from "@/components/ToolkitButton";
import { SingleColumn } from "@/components/SingleColumn";
import { SelectPrimitive } from "@/components/SelectPrimitive";

import devicesIcon from "@/assets/icons/devices.svg";

interface WeightMeasureModalProps {
  open: boolean;
  onClose: () => void;
  onStartMeasurement: (macAddress: number) => Promise<void>;
  onStopMeasurement: () => Promise<void>;
  onSave: (weight: number) => void;
  sessionDevices: Array<{ name: string; macAddress: number }>;
  selectedDeviceMac: number | null;
  setSelectedDeviceMac: (mac: number) => void;
  isMeasuringWeight: boolean;
  liveWeight: number | null;
  editingUserData?: { weightMetric?: string };
  selectedUserData?: { weightMetric?: string };
  commands: {
    devices: {
      tareDevice: (mac: number) => void;
    };
  };
}

export default function WeightMeasureModal({
  open,
  onClose,
  onStartMeasurement,
  onStopMeasurement,
  onSave,
  sessionDevices,
  selectedDeviceMac,
  setSelectedDeviceMac,
  isMeasuringWeight,
  liveWeight,
  editingUserData,
  selectedUserData,
  commands,
}: WeightMeasureModalProps) {
  const metric = editingUserData?.weightMetric ?? selectedUserData?.weightMetric ?? "kg";

  return (
    <Modal
      open={open}
      onOpen={async () => {
        if (selectedDeviceMac) {
          await onStartMeasurement(selectedDeviceMac);
        }
      }}
      onClose={async () => {
        await onStopMeasurement();
        onClose();
      }}
      className="min-w-lg"
    >
      <h4 className="mb-4 text-lg font-bold">Weight Measure</h4>

      <div className="mb-3 flex flex-col items-center">
        <div className="mb-1 text-lg text-gray-500">Live reading</div>
        <div className="text-4xl font-semibold tabular-nums">
          {liveWeight !== null ? liveWeight.toFixed(2) : "--"}
          <span className="ml-2 text-2xl font-normal">{metric}</span>
        </div>
      </div>

      {sessionDevices.length === 0 ? (
        <div>
          <p className="mb-7 text-lg text-gray-400">Connect to a board in the Devices page!</p>
          <ToolkitButton to="/devices" color="blue" iconUrl={devicesIcon}>
            Devices →
          </ToolkitButton>
        </div>
      ) : (
        <>
          <SingleColumn className="mb-10 items-center" label="Select a Device" backgroundType="transparent">
            <SelectPrimitive<number>
              value={selectedDeviceMac ?? 0}
              onChange={async (macAddress) => {
                setSelectedDeviceMac(macAddress);
                await onStartMeasurement(macAddress);
              }}
              options={sessionDevices.map((device) => ({
                label: device.name,
                value: device.macAddress,
              }))}
              disabled={isMeasuringWeight}
            />
          </SingleColumn>

          <div className="flex justify-center gap-6">
            <ToolkitButton
              disabled={!selectedDeviceMac}
              color="grey"
              onClick={() => commands.devices.tareDevice(Number(selectedDeviceMac))}
            >
              Tare
            </ToolkitButton>

            {!isMeasuringWeight ? (
              <ToolkitButton
                disabled={!selectedDeviceMac}
                color="grey"
                onClick={async () => {
                  if (selectedDeviceMac) await onStartMeasurement(selectedDeviceMac);
                }}
              >
                Start
              </ToolkitButton>
            ) : (
              <ToolkitButton disabled={!selectedDeviceMac} color="grey" onClick={onStopMeasurement}>
                Stop
              </ToolkitButton>
            )}

            <ToolkitButton
              disabled={!selectedDeviceMac || isMeasuringWeight}
              color="blue"
              onClick={async () => {
                if (liveWeight !== null) {
                  onSave(Number(liveWeight.toFixed(2)));
                }
                await onStopMeasurement();
                onClose();
              }}
            >
              Save
            </ToolkitButton>
          </div>
        </>
      )}
    </Modal>
  );
}
