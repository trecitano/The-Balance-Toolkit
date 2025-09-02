import { useEffect, useLayoutEffect, useRef, useState } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import { BoardBuffer, SessionState } from "@/store/sessionDataStore.tsx";
import { ProcessedSessionData } from "@/types.ts";
import { StoreApi } from "zustand";

interface MetricConfig {
  key: keyof ProcessedSessionData;
  label: string;
  color: string;
  enabled: boolean;
}

const WINDOW_SEC = 10;
const PAD_SEC = 1.5;

export function MultiMetricPlot({
                                  title,
                                  macAddress,
                                  store,
                                }: {
  title: string;
  macAddress: number;
  store: StoreApi<SessionState>;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const plotRef = useRef<uPlot | null>(null);

  // State for which metrics to show
  const [metrics, setMetrics] = useState<MetricConfig[]>([
    { key: "mlsi", label: "MLSI", color: "#ef4444", enabled: true }, // red
    { key: "apsi", label: "APSI", color: "#3b82f6", enabled: true }, // blue
    { key: "vsi", label: "VSI", color: "#10b981", enabled: true },  // green
    { key: "dpsi", label: "DPSI", color: "#f59e0b", enabled: true }, // orange
  ]);

  // Toggle metric visibility
  const toggleMetric = (index: number) => {
    setMetrics(prev => prev.map((m, i) =>
      i === index ? { ...m, enabled: !m.enabled } : m
    ));
  };

  // Create uPlot options based on enabled metrics
  const createOptions = (): uPlot.Options => {
    const series: uPlot.Series[] = [{}]; // time series

    metrics.forEach(metric => {
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
      cursor: {
        show: true,
        points: {
          size: 8,
          width: 2,
        }
      },
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
            const pad = (max - min) * 0.1;
            return [min - pad, max + pad];
          },
        },
      },
      axes: [
        {
          scale: "x",
          values: () => [],
          grid: { show: true, stroke: "#e5e7eb", width: 1 },
          ticks: { show: false },
          border: { show: true, stroke: "#000", width: 2 },
          size: 0,
        },
        {
          scale: "y",
          grid: { show: true, stroke: "#e5e7eb", width: 1 },
          ticks: { show: true },
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
    const initialData = [[], [], [], [], []];

    plotRef.current = new uPlot(
      { ...opts, width: rect.width, height: rect.height },
      initialData,
      hostRef.current
    );

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
      { equalityFn: (a, b) => a === b }
    );

    return () => unsub();
  }, [store, macAddress]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <p className="font-medium">{title}</p>
        <div className="flex gap-3">
          {metrics.map((metric, i) => (
            <label key={metric.key} className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={metric.enabled}
                onChange={() => toggleMetric(i)}
                className="h-3 w-3"
              />
              <span
                className="text-sm font-medium"
                style={{ color: metric.enabled ? metric.color : '#9ca3af' }}
              >
                {metric.label}
              </span>
            </label>
          ))}
        </div>
      </div>
      <div ref={hostRef} className="flex-1" />
    </div>
  );
}