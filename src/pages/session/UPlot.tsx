import { useEffect, useLayoutEffect, useRef } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import { BoardBuffer, SessionState, SessionStore } from "@/store/sessionDataStore.tsx";
import { RawBalanceBoardEvent } from "@/types.ts";
import { Tooltip } from "@/components/Tooltip.tsx";

type DataSelector<T> = (state: SessionState) => BoardBuffer<T> | undefined;
type DataMapper<T> = (buf: BoardBuffer<T>) => { t: number[]; y: number[] };

export const RED_COLOUR = "#ef4444";
export const BLACK_COLOUR = "#000";
export const BLUE_COLOUR = "#3b82f6";
export const YELLOW_COLOUR = "#f59e0b";
export const GREEN_COLOUR = "#10b981";

export function UPlot<T>({
  title,
  tooltipText,
  uPlotOptions,
  dataSelector,
  dataMapper,
  store,
}: {
  title: string;
  tooltipText?: string;
  uPlotOptions: uPlot.Options;
  dataSelector: DataSelector<T>;
  dataMapper: DataMapper<T>;
  store: SessionStore;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const plotRef = useRef<uPlot | null>(null);

  // Mount uPlot once
  useLayoutEffect(() => {
    if (!hostRef.current || plotRef.current) return;

    const rect = hostRef.current.getBoundingClientRect();

    plotRef.current = new uPlot({ ...uPlotOptions, width: rect.width, height: rect.height }, [[], []], hostRef.current);

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

  // Subscribe directly to Zustand for updates
  useEffect(() => {
    // Subscribe for future updates
    const unsub = store.subscribe(
      (state) => dataSelector(state),
      (buffer) => {
        if (!plotRef || !plotRef.current || buffer === undefined) {
          return;
        }

        const { t, y } = dataMapper(buffer);
        plotRef.current.setData([t, y]);
      },
      {
        equalityFn: (a, b) => {
          return a === b; // Try simple reference equality first
        },
      },
    );

    return () => unsub();
  }, [store]);

  return (
    <div className="h-full w-full">
      <div className={"relative flex h-1/10 items-center justify-center"}>
        <div className={"relative font-semibold"}>
          {title}
          {tooltipText && (
            <div className="absolute top-1/2 left-full ml-2.5 -translate-y-1/2">
              <Tooltip tooltipText={tooltipText} />
            </div>
          )}
        </div>
      </div>
      <div ref={hostRef} className="h-9/10 w-full" />
    </div>
  );
}

export function copYPlotSettings(macAddress: number) {
  const color = RED_COLOUR;

  const uPlotOptions: uPlot.Options = {
    width: 0,
    height: 0,
    legend: { show: false },
    cursor: { show: false },
    padding: [20, 30, 20, 15], // top, right, bottom, left
    scales: {
      x: {
        range: (_u, _min, max) => {
          const now = max || 0;
          const pad = 1.5; // padding to avoid cropping latest point
          return [now - 10, now + pad];
        },
      },
      y: { range: [-1, 1] },
    },
    axes: [
      {
        scale: "x",
        grid: { show: false },
        values: () => [],
        ticks: { show: false },
        size: 0,
      },
      {
        scale: "y",
        grid: { show: false },
        border: { show: true, stroke: BLACK_COLOUR, width: 2 },
        font: "10px sans-serif",
        stroke: "#3d3d3d",
        values: (_, splits) => {
          return splits.map((_, i) => {
            if (i === 0) return "Back (-1)"; // bottom tick
            if (i === splits.length - 1) return "Front (1)"; // top tick
            return ""; // hide all other labels
          });
        },
        ticks: {
          show: true,
          size: 6,
          stroke: "#b2b2b2",
          filter: (_, splits) => {
            return splits.map((v, i) => {
              return i === 0 || i === splits.length - 1 ? v : null;
            });
          },
        },
      },
    ],
    series: [{}, { stroke: color, width: 2 }],
    hooks: {
      draw: [
        (u) => {
          drawHorizontalAxis(u, BLACK_COLOUR);
          drawPlotLastPointAsCircle(u, color);
        },
      ],
    },
  };

  const dataSelector = (state: SessionState) => state.rawSessionData[macAddress];
  const dataMapper = makeDataMapper<RawBalanceBoardEvent>((d) => d.copY);

  return {
    uPlotOptions,
    dataSelector,
    dataMapper,
  };
}

export function copXPlotSettings(macAddress: number) {
  const color = BLUE_COLOUR;

  // Horizontal domain (CoP-X)
  const X_MIN = -1;
  const X_MAX = 1;

  // Vertical domain (time window)
  const WINDOW_SEC = 10;
  const PAD_SEC = 1.5;

  const uPlotOptions: uPlot.Options = {
    width: 0,
    height: 0,
    legend: { show: false },
    cursor: { show: false },
    padding: [0, 30, 20, 30], // top, right, bottom, left

    // Keep uPlot's native orientation (time on x, value on y),
    // but hide built-in axes, and draw everything transposed in hooks.
    scales: {
      x: {
        range: (_u, _min, max) => {
          const now = max || 0;
          return [now - WINDOW_SEC, now + PAD_SEC];
        },
        ori: 1,
        dir: -1,
      },
      y: { range: [X_MIN, X_MAX], ori: 0 },
    },

    axes: [
      {
        scale: "x",
        side: 0,
        size: 20,
        values: () => [],
        grid: { show: false },
        ticks: { show: false },
        border: { show: true, stroke: BLACK_COLOUR, width: 2 },
      },
      { scale: "y", show: false },
    ],

    // Hide default series drawing; we’ll render our own transposed line.
    series: [{}, { stroke: color, width: 2 }],

    hooks: {
      draw: [
        (u) => {
          drawVerticalZeroAxis(u, BLACK_COLOUR, X_MIN, X_MAX);
          drawTopAxisLabels(u);
          drawPlotLastPointAsCircle(u, color, true);
        },
      ],
    },
  };

  const dataSelector = (state: SessionState) => state.rawSessionData[macAddress];
  const dataMapper = makeDataMapper<RawBalanceBoardEvent>((d) => d.copX);

  return {
    uPlotOptions,
    dataSelector,
    dataMapper,
  };
}

export function standardPlot(color: string) {
  const WINDOW_SEC = 10;
  const PAD_SEC = 1.5;

  const uPlotOptions: uPlot.Options = {
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
        range: (_, min, max) => {
          if (!Number.isFinite(min) || !Number.isFinite(max)) {
            return [0, 1];
          }
          if (min === max) {
            return [0, max + 0.1];
          }
          return [0, Number((max + 0.1).toFixed(1))];
        },
      },
    },
    axes: [
      {
        scale: "x",
        values: () => [],
        grid: { show: false },
        ticks: { show: false },
        border: { show: true, stroke: BLACK_COLOUR, width: 2 },
        size: 0,
      },
      {
        scale: "y",
        grid: { show: false },
        ticks: { show: true, size: 6, stroke: "#b2b2b2" },
        border: { show: true, stroke: BLACK_COLOUR, width: 2 },
        size: 35,
      },
    ],
    series: [{}, { stroke: color, width: 2 }],

    hooks: {
      draw: [
        (u) => {
          drawPlotLastPointAsCircle(u, color);
        },
      ],
    },
  };

  return uPlotOptions;
}

// Helper Functions

export function makeDataMapper<T extends { timestamp: number }>(selector: (data: T) => number) {
  return (buf: BoardBuffer<T>) => {
    const t: number[] = [];
    const y: number[] = [];
    let t0: number | null = null;

    for (let i = 0; i < buf.len; i++) {
      const idx = (buf.head - (buf.len - 1 - i) + buf.frames.length) % buf.frames.length;
      const f = buf.frames[idx];
      if (f) {
        const ts = f.timestamp / 1000;
        if (t0 === null) t0 = ts;
        t.push(ts - t0);
        y.push(selector(f));
      }
    }

    return { t, y };
  };
}

function drawHorizontalAxis(u: uPlot, color: string) {
  const { ctx } = u;
  const { left, width } = u.bbox;
  const y0 = u.valToPos(0, "y", true);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(left, y0);
  ctx.lineTo(left + width, y0);
  ctx.stroke();
  ctx.restore();
}

function drawPlotLastPointAsCircle(u: uPlot, color: string, transposed = false) {
  const ySeries = u.data[1] as number[];
  const xSeries = u.data[0] as number[];
  if (!ySeries.length) return;

  const lastIdx = ySeries.length - 1;
  const xVal = xSeries[lastIdx];
  const yVal = ySeries[lastIdx];

  // Compute canvas coordinates
  const cx = transposed ? u.valToPos(yVal, "y", true) : u.valToPos(xVal, "x", true);

  const cy = transposed ? u.valToPos(xVal, "x", true) : u.valToPos(yVal, "y", true);

  const ctx = u.ctx;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawTopAxisLabels(u: uPlot) {
  const { ctx } = u;
  const { left, top, width } = u.bbox;

  ctx.save();
  ctx.fillStyle = "#3d3d3d";
  ctx.font = "12px sans-serif";
  ctx.textBaseline = "bottom";

  // Left
  ctx.textAlign = "left";
  ctx.fillText("Left (-1)", left, top - 4);

  // Right
  ctx.textAlign = "right";
  ctx.fillText("Right (1)", left + width, top - 4);

  ctx.restore();
}

function drawVerticalZeroAxis(u: uPlot, color: string, minX: number, maxX: number) {
  const { ctx } = u;
  const { left, top, height, width } = u.bbox;

  const xZero = left + ((0 - minX) / (maxX - minX)) * (width <= 0 ? 1 : width);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(xZero, top);
  ctx.lineTo(xZero, top + height);
  ctx.stroke();
  ctx.restore();
}
