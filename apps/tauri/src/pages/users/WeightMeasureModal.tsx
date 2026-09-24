import { useEffect, useRef, useState } from "react";
import { Channel } from "@tauri-apps/api/core";
import { Modal } from "@/components/Modal";
import { ToolkitButton } from "@/components/ToolkitButton";
import { SelectPrimitive } from "@/components/SelectPrimitive";
import { QueryStatus, errorMessage } from "@/components/QueryStatus";
import { commands } from "@/utils/requests";
import { kgToUnit } from "@/utils/weight";

type Measurement = { id: string; started: Promise<unknown>; frame: number | null };
export default function WeightMeasureModal({
  onClose,
  onSave,
  weightMetric,
  sessionDevices,
}: {
  onClose: () => void;
  /** Receives the measured weight in kilograms regardless of the display unit. */
  onSave: (weightKg: number) => void;
  weightMetric: string;
  sessionDevices: Array<{ name: string; macAddress: number }>;
}) {
  const [device, setDevice] = useState<number | undefined>(sessionDevices[0]?.macAddress);
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [measuring, setMeasuring] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const measurement = useRef<Measurement | null>(null);

  useEffect(
    () => () => {
      const current = measurement.current;
      measurement.current = null;
      if (!current) return;
      if (current.frame !== null) cancelAnimationFrame(current.frame);
      void current.started
        .catch(() => {})
        .then(() => commands.users.stopMeasureWeight(current.id))
        .catch((failure) => console.error("Could not stop weight measurement", failure));
    },
    [],
  );

  const start = async () => {
    if (device === undefined || measurement.current || busy) return;
    setBusy(true);
    setError(null);
    setWeightKg(null);
    const channel = new Channel<number>();
    const id = crypto.randomUUID();
    const current: Measurement = { id, started: commands.users.startMeasureWeight(channel, device, id), frame: null };
    measurement.current = current;
    let latest = 0;
    channel.onmessage = (value) => {
      if (measurement.current !== current || !Number.isFinite(value)) return;
      latest = value;
      if (current.frame !== null) return;
      current.frame = requestAnimationFrame(() => {
        current.frame = null;
        if (measurement.current === current) setWeightKg(latest);
      });
    };
    try {
      await current.started;
      if (measurement.current === current) setMeasuring(true);
    } catch (failure) {
      if (measurement.current === current) {
        measurement.current = null;
        setError(errorMessage(failure));
      }
    } finally {
      setBusy(false);
    }
  };
  const stop = async () => {
    const current = measurement.current;
    if (!current) return;
    await current.started.catch(() => {});
    try {
      await commands.users.stopMeasureWeight(current.id);
    } finally {
      // Release the run even when the stop command fails, so a new measurement can start.
      if (current.frame !== null) cancelAnimationFrame(current.frame);
      if (measurement.current === current) measurement.current = null;
      setMeasuring(false);
    }
  };
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  };
  const weight = weightKg === null ? null : kgToUnit(weightKg, weightMetric);
  const close = () => {
    if (!busy)
      void run(async () => {
        await stop();
        onClose();
      });
  };
  return (
    <Modal open label="Measure weight" onClose={close} className="min-w-lg">
      <h2 className="mb-4 text-lg font-bold">Measure weight</h2>
      <p className="text-gray-500">Live reading</p>
      <p className="mb-6 text-4xl tabular-nums">
        {weight?.toFixed(2) ?? "--"} <span className="text-2xl">{weightMetric}</span>
      </p>
      <QueryStatus error={error} />
      {sessionDevices.length ? (
        <>
          <SelectPrimitive
            value={device}
            noneOption="Choose a device"
            aria-label="Measurement device"
            options={sessionDevices.map((board) => ({ label: board.name, value: board.macAddress }))}
            onChange={(next) => {
              setDevice(next);
              setWeightKg(null);
            }}
            disabled={measuring || busy}
          />
          <div className="mt-6 flex justify-center gap-4">
            <ToolkitButton
              disabled={device === undefined || busy}
              color="grey"
              onClick={() =>
                void run(async () => {
                  if (device !== undefined) await commands.devices.tareDevice(device);
                  setWeightKg(null);
                })
              }
            >
              Tare
            </ToolkitButton>
            <ToolkitButton
              disabled={device === undefined || busy}
              color="grey"
              onClick={() => (measuring ? void run(stop) : void start())}
            >
              {measuring ? "Stop" : "Start"}
            </ToolkitButton>
            <ToolkitButton
              disabled={weight === null || weight <= 0 || busy}
              color="blue"
              onClick={() =>
                void run(async () => {
                  await stop();
                  if (weightKg !== null && weight !== null) onSave(Number(weightKg.toFixed(2)));
                })
              }
            >
              Use weight
            </ToolkitButton>
          </div>
        </>
      ) : (
        <p>Connect and select a board on the Devices page to measure weight.</p>
      )}
      <ToolkitButton className="mt-6" disabled={busy} color="grey" onClick={close}>
        Close
      </ToolkitButton>
    </Modal>
  );
}
