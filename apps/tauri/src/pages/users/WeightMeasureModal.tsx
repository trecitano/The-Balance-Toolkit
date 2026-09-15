import { Modal } from "@/components/Modal";
import { ToolkitButton } from "@/components/ToolkitButton";
import { SingleColumn } from "@/components/SingleColumn";
import { SelectPrimitive } from "@/components/SelectPrimitive";

import { devicesIcon } from "@/components/navigation/Navigation.tsx";
interface WeightMeasureModalProps {
  open: boolean;
  onClose: () => void;
  liveWeight: number | null;
  weightMetric: string;
  sessionDevices: Array<{ name: string; macAddress: number }>;
  selectedDeviceMac: number | null;
  isMeasuring: boolean;
  onDeviceSelect: (mac: number) => void;
  onTare: () => void;
  onStart: () => void;
  onStop: () => void;
  onSave: () => void;
}

export default function WeightMeasureModal({
  open,
  onClose,
  liveWeight,
  weightMetric,
  sessionDevices,
  selectedDeviceMac,
  isMeasuring,
  onDeviceSelect,
  onTare,
  onStart,
  onStop,
  onSave,
}: WeightMeasureModalProps) {
  const hasDevices = sessionDevices.length > 0;
  const hasSelectedDevice = !!selectedDeviceMac;

  return (
    <Modal open={open} onClose={onClose} className="min-w-lg">
      <h4 className="mb-4 text-lg font-bold">Weight Measure</h4>

      <div className="mb-3 flex flex-col items-center">
        <div className="mb-1 text-lg text-gray-500">Live reading</div>
        <div className="text-4xl font-semibold tabular-nums">
          {liveWeight !== null ? liveWeight.toFixed(2) : "--"}
          <span className="ml-2 text-2xl font-normal">{weightMetric}</span>
        </div>
      </div>

      {!hasDevices ? (
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
              onChange={onDeviceSelect}
              options={sessionDevices.map((device) => ({
                label: device.name,
                value: device.macAddress,
              }))}
              disabled={isMeasuring}
            />
          </SingleColumn>

          <div className="flex justify-center gap-6">
            <ToolkitButton disabled={!hasSelectedDevice} color="grey" onClick={onTare}>
              Tare
            </ToolkitButton>

            <ToolkitButton disabled={!hasSelectedDevice} color="grey" onClick={isMeasuring ? onStop : onStart}>
              {isMeasuring ? "Stop" : "Start"}
            </ToolkitButton>

            <ToolkitButton disabled={!hasSelectedDevice || isMeasuring} color="blue" onClick={onSave}>
              Save
            </ToolkitButton>
          </div>
        </>
      )}
    </Modal>
  );
}
