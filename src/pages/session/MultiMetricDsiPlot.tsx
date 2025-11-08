import { useEffect, useLayoutEffect, useRef, useState } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import { BoardBuffer, SessionStore } from "@/store/sessionDataStore.tsx";
import { ProcessedSessionData } from "@/types.ts";
import { Tooltip } from "@/components/Tooltip.tsx";
import { BLUE_COLOUR, GREEN_COLOUR, RED_COLOUR, YELLOW_COLOUR } from "@/pages/session/UPlot.tsx";

interface MetricConfig {
  key: keyof ProcessedSessionData;
  label: string;
  color: string;
  enabled: boolean;
  tooltipId: string;
}

const WINDOW_SEC = 10;
const PAD_SEC = 1.5;

export function MultiMetricPlot({
  title,
  tooltipText,
  macAddress,
  store,
}: {
  title: string;
  tooltipText?: string;
  macAddress: number;
  store: SessionStore;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const plotRef = useRef<uPlot | null>(null);

  // State for which metrics to show
  const [metrics, setMetrics] = useState<MetricConfig[]>([
    { key: "mlsi", label: "MLSI", color: BLUE_COLOUR, enabled: true, tooltipId: "session_mlsi" },
    { key: "apsi", label: "APSI", color: RED_COLOUR, enabled: true, tooltipId: "session_apsi" },
    { key: "vsi", label: "VSI", color: YELLOW_COLOUR, enabled: true, tooltipId: "session_vsi" },
    { key: "dpsi", label: "DPSI", color: GREEN_COLOUR, enabled: true, tooltipId: "session_dpsi" },
  ]);

  // Toggle metric visibility
  const toggleMetric = (index: number) => {
    setMetrics((prev) => prev.map((m, i) => (i === index ? { ...m, enabled: !m.enabled } : m)));
  };

  // Create uPlot options based on enabled metrics
  const createOptions = (): uPlot.Options => {
    const series: uPlot.Series[] = [{}]; // time series

    metrics.forEach((metric) => {
      series.push({
        label: metric.label,
        stroke: metric.color,
        width: 2,
        show: metric.enabled,
      });
    });

    return {
      width: 0,
      height: 0,
      legend: { show: false },
      cursor: { show: false },
      scales: {
        x: {
          range: (_u, _min, max) => {
            const now = max || 0;
            return [now - WINDOW_SEC, now + PAD_SEC];
          },
        },
        y: {
          range: (_u, min, max) => {
            if (!Number.isFinite(min) || !Number.isFinite(max)) {
              return [0, 1];
            }
            if (min === max) {
              return [min - 0.1, max + 0.1];
            }
            const pad = (max - min) * 0.1;
            return [min - pad, max + pad];
          },
        },
      },
      axes: [
        {
          scale: "x",
          values: () => [],
          grid: { show: false },
          ticks: { show: false },
          border: { show: true, stroke: "#000", width: 2 },
          size: 0,
        },
        {
          scale: "y",
          grid: { show: false },
          ticks: { show: true, size: 6, stroke: "#b2b2b2" },
          border: { show: true, stroke: "#000", width: 2 },
          size: 40,
        },
      ],
      series,
      hooks: {
        draw: [
          (u) => {
            // Draw circles for the last point of each visible series
            metrics.forEach((metric, i) => {
              if (!metric.enabled) return;

              const seriesIdx = i + 1; // +1 because series[0] is time
              const dataSeries = u.data[seriesIdx] as number[];
              const timeSeries = u.data[0] as number[];

              if (!dataSeries || !dataSeries.length) return;

              const lastIdx = dataSeries.length - 1;
              const xVal = timeSeries[lastIdx];
              const yVal = dataSeries[lastIdx];

              if (!Number.isFinite(yVal)) return;

              const cx = u.valToPos(xVal, "x", true);
              const cy = u.valToPos(yVal, "y", true);

              const ctx = u.ctx;
              ctx.save();
              ctx.beginPath();
              ctx.arc(cx, cy, 6, 0, Math.PI * 2);
              ctx.fillStyle = metric.color;
              ctx.fill();
              ctx.strokeStyle = "#fff";
              ctx.lineWidth = 2;
              ctx.stroke();
              ctx.restore();
            });
          },
        ],
      },
    };
  };

  // Initialize plot
  useLayoutEffect(() => {
    if (!hostRef.current || plotRef.current) return;

    const rect = hostRef.current.getBoundingClientRect();
    const opts = createOptions();

    // Initialize with empty data arrays (time + 4 metrics)
    const initialData: uPlot.AlignedData = [[], [], [], [], []];

    plotRef.current = new uPlot({ ...opts, width: rect.width, height: rect.height }, initialData, hostRef.current);

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
  }, []);

  // Update plot options when metrics change
  useEffect(() => {
    if (!plotRef.current) return;

    // Update series visibility
    metrics.forEach((metric, i) => {
      plotRef.current!.setSeries(i + 1, { show: metric.enabled });
    });
  }, [metrics]);

  // Subscribe to data updates
  useEffect(() => {
    const unsub = store.subscribe(
      (state) => state.processedSessionData[macAddress],
      (buffer: BoardBuffer<ProcessedSessionData> | undefined) => {
        if (!plotRef.current || !buffer) return;

        // Extract data for all metrics
        const t: number[] = [];
        const mlsi: number[] = [];
        const apsi: number[] = [];
        const vsi: number[] = [];
        const dpsi: number[] = [];

        let t0: number | null = null;

        for (let i = 0; i < buffer.len; i++) {
          const idx = (buffer.head - (buffer.len - 1 - i) + buffer.frames.length) % buffer.frames.length;
          const frame = buffer.frames[idx];

          if (frame) {
            const ts = frame.timestamp / 1000;
            if (t0 === null) t0 = ts;

            t.push(ts - t0);
            mlsi.push(frame.mlsi ?? 0);
            apsi.push(frame.apsi ?? 0);
            vsi.push(frame.vsi ?? 0);
            dpsi.push(frame.dpsi ?? 0);
          }
        }

        plotRef.current.setData([t, mlsi, apsi, vsi, dpsi]);
      },
      { equalityFn: (a, b) => a === b },
    );

    return () => unsub();
  }, [store, macAddress]);

  return (
    <div className="h-full w-full">
      <div className={"relative flex h-1/10 items-center justify-center"}>
        <div className={"relative font-semibold"}>
          {title}
          {tooltipText && (
            <div className="absolute top-1/2 left-full ml-2.5 -translate-y-1/2">
              <Tooltip tooltipId={"session_user"} />
            </div>
          )}
        </div>
      </div>
      <div ref={hostRef} className="h-78/100 w-full" />
      <div className="mb-2 flex h-1/10 items-center justify-between">
        <div className="ml-auto flex gap-2">
          {metrics.map((metric, i) => (
            <label key={metric.key} className="flex cursor-pointer items-center gap-1">
              <input type="checkbox" checked={metric.enabled} onChange={() => toggleMetric(i)} className="size-3" />
              <span className="text-xs font-medium" style={{ color: metric.enabled ? metric.color : "#9ca3af" }}>
                {metric.label}
              </span>
              <Tooltip tooltipId={metric.tooltipId} />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
