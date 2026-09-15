import { useState } from "react";
import { Channel } from "@tauri-apps/api/core";
import { Modal } from "@/components/Modal.tsx";
import { ToolkitButton } from "@/components/ToolkitButton.tsx";
import { InputPrimitive } from "@/components/InputPrimitive.tsx";
import { Device, CalibrationReading } from "@/types";
import { commands } from "@/utils/requests.ts";
import wbbTopdown from "@/assets/wbb-topdown.svg";

interface CalibrationModalProps {
  device: Device | null;
  onClose: () => void;
}

type CalibrationPosition = "top_left" | "top_right" | "bottom_left" | "bottom_right" | "center";

interface PositionConfig {
  id: CalibrationPosition;
  label: string;
  x: number;
  y: number;
}

const CALIBRATION_POSITIONS: PositionConfig[] = [
  { id: "top_left", label: "Top-Left Corner", x: 15, y: 20 },
  { id: "top_right", label: "Top-Right Corner", x: 85, y: 20 },
  { id: "bottom_left", label: "Bottom-Left Corner", x: 15, y: 80 },
  { id: "bottom_right", label: "Bottom-Right Corner", x: 85, y: 80 },
  { id: "center", label: "Center", x: 50, y: 50 },
];

interface CapturedReading {
  position: CalibrationPosition;
  reading: CalibrationReading;
}

interface SensorDisplayProps {
  reading: CalibrationReading | null;
}

function CapturedReadingsTable({ readings }: { readings: CapturedReading[] }) {
  const readingsMap = new Map(readings.map((r) => [r.position, r.reading]));

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <h4 className="mb-2 text-xs font-semibold text-gray-600 uppercase">Captured Readings</h4>
      <table className="w-full table-fixed text-xs">
        <thead>
          <tr className="border-b border-gray-200 text-gray-500">
            <th className="w-[40%] pr-2 pb-1 text-left font-medium">Position</th>
            <th className="w-[12%] px-1 pb-1 text-right font-medium">TL</th>
            <th className="w-[12%] px-1 pb-1 text-right font-medium">TR</th>
            <th className="w-[12%] px-1 pb-1 text-right font-medium">BL</th>
            <th className="w-[12%] px-1 pb-1 text-right font-medium">BR</th>
            <th className="w-[12%] pb-1 pl-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {CALIBRATION_POSITIONS.map((pos) => {
            const reading = readingsMap.get(pos.id);
            return (
              <tr key={pos.id} className={reading ? "text-gray-700" : "text-gray-300"}>
                <td className="py-1 pr-2 font-medium">{pos.label}</td>
                <td className="px-1 py-1 text-right tabular-nums">{reading ? reading.topLeft.toFixed(1) : "-"}</td>
                <td className="px-1 py-1 text-right tabular-nums">{reading ? reading.topRight.toFixed(1) : "-"}</td>
                <td className="px-1 py-1 text-right tabular-nums">{reading ? reading.bottomLeft.toFixed(1) : "-"}</td>
                <td className="px-1 py-1 text-right tabular-nums">{reading ? reading.bottomRight.toFixed(1) : "-"}</td>
                <td className="py-1 pl-2 text-right font-medium tabular-nums">
                  {reading ? reading.totalWeight.toFixed(1) : "-"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SensorDisplay({ reading }: SensorDisplayProps) {
  if (!reading) {
    return (
      <div className="grid grid-cols-2 gap-2 rounded-lg bg-gray-100 p-3">
        <div className="text-center text-sm text-gray-400">Waiting for data...</div>
      </div>
    );
  }

  const sensors = [
    { label: "Top Left", value: reading.topLeft, position: "TL" },
    { label: "Top Right", value: reading.topRight, position: "TR" },
    { label: "Bottom Left", value: reading.bottomLeft, position: "BL" },
    { label: "Bottom Right", value: reading.bottomRight, position: "BR" },
  ];

  const maxValue = Math.max(...sensors.map((s) => s.value), 0.1);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {sensors.map((sensor) => (
          <div key={sensor.position} className="rounded-lg bg-gray-100 p-2">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium text-gray-600">{sensor.label}</span>
              <span className="text-gray-800 tabular-nums">{sensor.value.toFixed(2)} kg</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-150"
                style={{ width: `${(sensor.value / maxValue) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="text-center text-sm">
        <span className="text-gray-500">Total: </span>
        <span className="font-semibold tabular-nums">{reading.totalWeight.toFixed(2)} kg</span>
      </div>
    </div>
  );
}

export default function CalibrationModal({ device, onClose }: CalibrationModalProps) {
  const isOpen = !!device;

  const [calibrationWeight, setCalibrationWeight] = useState<string>("");
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sensorReading, setSensorReading] = useState<CalibrationReading | null>(null);
  const [capturedReadings, setCapturedReadings] = useState<CapturedReading[]>([]);
  const [streamActive, setStreamActive] = useState(false);

  const stopStream = async (macAddress: number) => {
    if (streamActive) {
      await commands.devices.stopCalibrationStream(macAddress).catch(console.error);
      setStreamActive(false);
    }
    setSensorReading(null);
  };

  const startStream = async (macAddress: number) => {
    const channel = new Channel<CalibrationReading>();
    channel.onmessage = (reading) => {
      setSensorReading(reading);
    };

    try {
      await commands.devices.startCalibrationStream(channel, macAddress);
      setStreamActive(true);
    } catch (err) {
      console.error("Failed to start calibration stream:", err);
      setError("Failed to start sensor stream");
    }
  };

  const resetState = () => {
    setCalibrationWeight("");
    setCurrentStep(-1);
    setIsSubmitting(false);
    setError(null);
    setSensorReading(null);
    setCapturedReadings([]);
  };

  const handleClose = async () => {
    if (device) {
      await stopStream(device.macAddress);
    }
    resetState();
    onClose();
  };

  const handleStartCalibration = async () => {
    if (!device) return;

    const weight = parseFloat(calibrationWeight);
    if (isNaN(weight) || weight <= 0) {
      setError("Please enter a valid weight greater than 0");
      return;
    }

    setError(null);
    setCapturedReadings([]);
    await startStream(device.macAddress);
    setCurrentStep(0);
  };

  const handleConfirmPosition = async () => {
    if (!device) return;

    const currentPosition = CALIBRATION_POSITIONS[currentStep];

    if (!sensorReading) {
      setError("No sensor data available. Please wait for readings.");
      return;
    }

    setError(null);

    const newReading: CapturedReading = {
      position: currentPosition.id,
      reading: sensorReading,
    };

    const nextStep = currentStep + 1;
    const allReadings = [...capturedReadings, newReading];
    setCapturedReadings(allReadings);

    if (nextStep >= CALIBRATION_POSITIONS.length) {
      // Go to review step (step 5) instead of auto-submitting
      await stopStream(device.macAddress);
      setCurrentStep(5);
    } else {
      setCurrentStep(nextStep);
    }
  };

  const handleSubmitCalibration = async () => {
    if (!device) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const weight = parseFloat(calibrationWeight);
      await commands.devices.submitCalibration(device.macAddress, weight, capturedReadings);
      setCurrentStep(6); // Go to complete state
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit calibration");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = async () => {
    if (!device) return;

    if (currentStep === 5) {
      // Going back from review step - restart stream and go to last position
      setCapturedReadings(capturedReadings.slice(0, -1));
      await startStream(device.macAddress);
      setCurrentStep(4);
    } else if (currentStep > 0) {
      setCapturedReadings(capturedReadings.slice(0, -1));
      setCurrentStep(currentStep - 1);
    } else if (currentStep === 0) {
      await stopStream(device.macAddress);
      setCapturedReadings([]);
      setCurrentStep(-1);
    }
  };

  // Weight input step
  if (currentStep === -1) {
    return (
      <Modal className="w-[32rem]" open={isOpen} onClose={handleClose}>
        <div className="flex flex-col gap-6">
          <h2 className="text-2xl font-semibold text-(--primary)">Calibrate Device</h2>
          <p className="text-(--text-light)">
            Calibrating: <span className="font-medium">{device?.name}</span>
          </p>

          <div className="flex flex-col gap-2">
            <label htmlFor="calibration-weight" className="text-left text-sm font-medium">
              Calibration Weight (kg)
            </label>
            <InputPrimitive
              id="calibration-weight"
              type="number"
              step="0.1"
              min="0"
              placeholder="Enter weight in kg"
              value={calibrationWeight}
              onChange={(e) => setCalibrationWeight(e.target.value)}
              className="w-full"
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>

          <p className="text-sm text-(--text-lighter)">
            You will place this weight at 5 different positions on the board.
          </p>

          <div className="flex justify-center gap-4">
            <ToolkitButton type="button" color="grey" onClick={handleClose}>
              Cancel
            </ToolkitButton>
            <ToolkitButton type="button" color="blue" onClick={handleStartCalibration}>
              Start Calibration
            </ToolkitButton>
          </div>
        </div>
      </Modal>
    );
  }

  // Review step - show all captured data before submission
  if (currentStep === 5) {
    return (
      <Modal className="w-[32rem]" open={isOpen} onClose={handleClose}>
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-(--primary)">Review Calibration</h2>
            <p className="text-sm text-(--text-lighter)">Using {calibrationWeight} kg weight</p>
          </div>

          <CapturedReadingsTable readings={capturedReadings} />

          <p className="text-sm text-(--text-light)">
            Review the captured readings above. If everything looks correct, click Submit to save the calibration.
          </p>

          {error && <p className="text-center text-sm text-red-500">{error}</p>}

          <div className="flex justify-center gap-4">
            <ToolkitButton type="button" color="grey" onClick={handleBack} disabled={isSubmitting}>
              Back
            </ToolkitButton>
            <ToolkitButton type="button" color="blue" onClick={handleSubmitCalibration} disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit Calibration"}
            </ToolkitButton>
          </div>
        </div>
      </Modal>
    );
  }

  // Complete state
  if (currentStep === 6) {
    return (
      <Modal className="w-[32rem]" open={isOpen} onClose={handleClose}>
        <div className="flex flex-col items-center gap-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <span className="text-3xl text-green-600">✓</span>
          </div>
          <h2 className="text-2xl font-semibold text-(--primary)">Calibration Complete</h2>
          <p className="text-(--text-light)">
            Successfully calibrated <span className="font-medium">{device?.name}</span> with {calibrationWeight} kg
            weight.
          </p>
          <ToolkitButton type="button" color="blue" onClick={handleClose}>
            Done
          </ToolkitButton>
        </div>
      </Modal>
    );
  }

  // Position calibration steps
  const currentPosition = CALIBRATION_POSITIONS[currentStep];

  return (
    <Modal className="w-[32rem]" open={isOpen} onClose={handleClose}>
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-(--primary)">Calibrate Device</h2>
          <p className="text-sm text-(--text-lighter)">Using {calibrationWeight} kg weight</p>
        </div>

        <div className="flex items-center justify-center gap-2">
          {CALIBRATION_POSITIONS.map((_, index) => (
            <div
              key={index}
              className={`h-2 w-8 rounded-full transition-colors ${
                index < currentStep ? "bg-green-500" : index === currentStep ? "bg-blue-500" : "bg-gray-200"
              }`}
            />
          ))}
        </div>

        <p className="text-lg font-medium">
          Step {currentStep + 1} of {CALIBRATION_POSITIONS.length}: {currentPosition.label}
        </p>

        <div className="relative mx-auto w-56">
          <img src={wbbTopdown} alt="Balance Board" className="w-full" />
          {CALIBRATION_POSITIONS.map((pos, index) => (
            <div
              key={pos.id}
              className={`absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-all ${
                index < currentStep
                  ? "border-green-500 bg-green-500/30"
                  : index === currentStep
                    ? "animate-pulse border-blue-500 bg-blue-500/50"
                    : "border-gray-300 bg-gray-200/50"
              }`}
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            >
              {index < currentStep && (
                <span className="flex h-full items-center justify-center text-xs text-green-700">✓</span>
              )}
            </div>
          ))}
        </div>

        <SensorDisplay reading={sensorReading} />

        <CapturedReadingsTable readings={capturedReadings} />

        <p className="text-sm text-(--text-light)">
          Place the weight on the <span className="font-semibold">{currentPosition.label.toLowerCase()}</span> of the
          board, then press Confirm.
        </p>

        {error && <p className="text-center text-sm text-red-500">{error}</p>}

        <div className="flex justify-center gap-4">
          <ToolkitButton type="button" color="grey" onClick={handleBack} disabled={isSubmitting}>
            Back
          </ToolkitButton>
          <ToolkitButton
            type="button"
            color="blue"
            onClick={handleConfirmPosition}
            disabled={isSubmitting || !sensorReading}
          >
            {isSubmitting
              ? "Submitting..."
              : currentStep === CALIBRATION_POSITIONS.length - 1
                ? "Complete Calibration"
                : "Confirm"}
          </ToolkitButton>
        </div>
      </div>
    </Modal>
  );
}
