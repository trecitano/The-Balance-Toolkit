import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import { Tooltip } from "@/components/Tooltip.tsx";
import { BLACK_COLOUR, BLUE_COLOUR, RED_COLOUR, YELLOW_COLOUR } from "@/pages/session/UPlot.tsx";
import { AmplitudeSpectrum } from "@/types.ts";
import { SessionStore } from "@/store/sessionDataStore.tsx";

type InitialAxes = "x" | "y" | "xy" | "all";

interface Props {
  title: string;
  tooltipId?: string;
  macAddress: number;
  store: SessionStore; // Replace with your StoreApi<SessionState> if desired
  initialAxes?: InitialAxes; // default visibility preset
}

interface MetricConfig {
  key: "x" | "y" | "xy";
  label: string;
  color: string;
  enabled: boolean;
}

const MAX_FREQ = 2.0;

export function FFTAmplitudePlot({ title, tooltipId, macAddress, store }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const plotRef = useRef<uPlot | null>(null);

  // Toggle state for which amplitude series to show
  const [metrics, setMetrics] = useState<MetricConfig[]>([
    { key: "x", label: "X", color: BLUE_COLOUR, enabled: false },
    { key: "y", label: "Y", color: RED_COLOUR, enabled: false },
    { key: "xy", label: "Combined", color: BLACK_COLOUR, enabled: true },
  ]);

  const toggleMetric = (index: number) => {
    setMetrics((prev) => prev.map((m, i) => (i === index ? { ...m, enabled: !m.enabled } : m)));
  };

  const createOptions = (rect: DOMRect): uPlot.Options => {
    return {
      width: rect.width,
      height: rect.height,
      legend: { show: false },
      cursor: { show: false },
      scales: {
        x: { time: false, range: [0, MAX_FREQ] },
        y: { range: [0, 1] },
      },
      axes: [
        {
          scale: "x",
          //label: "Frequency (Hz)",
          //labelSize: 20,
          grid: { show: false },
          ticks: { show: false },
          border: { show: true, stroke: BLACK_COLOUR, width: 2 },
          size: 20,
        },
        {
          scale: "y",
          //label: "Amplitude",
          grid: { show: false },
          ticks: { show: false },
          border: { show: true, stroke: BLACK_COLOUR, width: 2 },
          //labelSize: 20,
          size: 40,
        },
      ],
      series: [
        {}, // x-axis values (freqs)
        {
          label: "X amplitude",
          stroke: BLUE_COLOUR,
          width: 2,
          show: metrics.find((m) => m.key === "x")?.enabled ?? true,
        },
        {
          label: "Y amplitude",
          stroke: RED_COLOUR,
          width: 2,
          show: metrics.find((m) => m.key === "y")?.enabled ?? true,
        },
        {
          label: "Combined",
          stroke: YELLOW_COLOUR,
          width: 3,
          fill: "rgba(59, 130, 246, 0.1)",
          show: metrics.find((m) => m.key === "xy")?.enabled ?? true,
        },
      ],
    };
  };

  // Mount plot once
  useLayoutEffect(() => {
    if (!hostRef.current) return;

    // Destroy existing instance if any (safety)
    plotRef.current?.destroy();
    plotRef.current = null;

    const rect = hostRef.current.getBoundingClientRect();
    const opts = createOptions(rect);

    // Initial data shape: [freqs, ax, ay, axy]
    const initialData: uPlot.AlignedData = [[], [], [], []];
    plotRef.current = new uPlot(opts, initialData, hostRef.current);

    const resizeObserver = new ResizeObserver(() => {
      if (!hostRef.current || !plotRef.current) return;
      const r = hostRef.current.getBoundingClientRect();
      plotRef.current.setSize({ width: r.width, height: r.height });
    });

    resizeObserver.observe(hostRef.current);

    return () => {
      resizeObserver.disconnect();
      plotRef.current?.destroy();
      plotRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount once

  // Apply toggle visibility to series when metrics change
  useEffect(() => {
    if (!plotRef.current) return;
    // Series indexes: 1 -> X, 2 -> Y, 3 -> Combined
    const order: ("x" | "y" | "xy")[] = ["x", "y", "xy"];
    order.forEach((key, i) => {
      const m = metrics.find((mm) => mm.key === key);
      if (m) {
        plotRef.current!.setSeries(i + 1, { show: m.enabled });
      }
    });
  }, [metrics]);

  // Subscribe to amplitude spectrum updates
  useEffect(() => {
    const unsub = store.subscribe(
      (state: any) => {
        const frameData = state.processedSingleFrameSessionData?.[macAddress];
        return {
          amplitude: frameData?.amplitudeSpectrum as AmplitudeSpectrum | undefined,
        };
      },
      (spec: { amplitude?: AmplitudeSpectrum }) => {
        if (!plotRef.current) return;
        const s = spec.amplitude;
        if (!s) return;

        const idx = s.freqs_hz.findIndex((f) => f > MAX_FREQ);
        const endIdx = idx === -1 ? s.freqs_hz.length : idx;

        const freqs = s.freqs_hz.slice(0, endIdx);
        const ax = s.amplitude_x.slice(0, endIdx);
        const ay = s.amplitude_y.slice(0, endIdx);
        const axy = s.amplitude_xy.slice(0, endIdx);

        plotRef.current.setData([freqs, ax, ay, axy]);
      },
      {
        equalityFn: (a: any, b: any) => a?.amplitude === b?.amplitude,
      },
    );

    return () => unsub();
  }, [store, macAddress]);

  const toggles = useMemo(() => {
    return (
      <div className="ml-auto flex gap-3">
        {metrics.map((metric, i) => (
          <label key={metric.key} className="flex cursor-pointer items-center gap-1">
            <input type="checkbox" checked={metric.enabled} onChange={() => toggleMetric(i)} className="size-3" />
            <span className="text-xs font-medium" style={{ color: metric.enabled ? metric.color : "#9ca3af" }}>
              {metric.label}
            </span>
          </label>
        ))}
      </div>
    );
  }, [metrics]);

  return (
    <div className="h-full w-full">
      <div className={"relative flex h-1/10 items-center justify-center"}>
        <div className={"relative font-semibold"}>
          {title}
          {tooltipId && (
            <div className="absolute top-1/2 left-full ml-2.5 -translate-y-1/2">
              <Tooltip tooltipId={tooltipId} />
            </div>
          )}
        </div>
      </div>
      <div ref={hostRef} className="h-78/100 w-full" />
      <div className="mb-2 flex h-1/10 items-center justify-between">{toggles}</div>
    </div>
  );
}
