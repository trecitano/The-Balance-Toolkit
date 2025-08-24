import { useEffect, useLayoutEffect, useRef } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import { BoardBuffer, SessionState } from "@/store/sessionDataStore.tsx";
import { ProcessedBoardEvent, RawBalanceBoardEvent } from "@/types.ts";
import { StoreApi } from "zustand";

type DataSelector<T> = (state: any) => BoardBuffer<T> | undefined;
type DataMapper<T> = (buf: BoardBuffer<T>) => { t: number[]; y: number[] };

const RED_COLOUR = "#ef4444";
const BLACK_COLOUR = "#000";
const BLUE_COLOUR = "#3b82f6";

function UPlotLineGeneric<T>({
  uPlotOptions,
  dataSelector,
  dataMapper,
  store,
}: {
  uPlotOptions: uPlot.Options;
  dataSelector: DataSelector<T>;
  dataMapper: DataMapper<T>;
  store: StoreApi<SessionState>;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const plotRef = useRef<uPlot | null>(null);
  const widthRef = useRef(0);

  // Mount uPlot once
  useLayoutEffect(() => {
    if (!hostRef.current || plotRef.current) return;

    const width = hostRef.current.clientWidth || 300;
    widthRef.current = width;

    plotRef.current = new uPlot(uPlotOptions, [[], []], hostRef.current);

    const onResize = () => {
      const w = hostRef.current!.clientWidth;
      const h = hostRef.current!.clientHeight;
      if (w !== widthRef.current) {
        widthRef.current = w;
        plotRef.current!.setSize({ width: w, height: h });
      }
    };

    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
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
        if (!plotRef || buffer === undefined) {
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

  return <div ref={hostRef} />;
}

export const UPlot = UPlotLineGeneric;

export function copYPlotSettings(macAddress: number) {
  const width = 100;
  const height = 100;
  const color = BLUE_COLOUR;
  const label = "copY";

  const uPlotOptions: uPlot.Options = {
    width,
    height,
    legend: { show: false },
    cursor: { show: false },
    scales: {
      x: {
        range: (_u, _min, max) => {
          const now = max || 0;
          const pad = 1.5; // padding to avoid cropping latest point
          return [now - 10, now + pad];
        },
      },
      y: { range: [-50, 50] },
    },
    axes: [
      {
        scale: "x",
        grid: { show: false },
        values: () => [],
        ticks: { show: false },
      },
      {
        scale: "y",
        grid: { show: false },
        values: (u, splits) => {
          return splits.map((v, i) => {
            if (i === 0) return "Back"; // bottom tick
            if (v === 0) return label;
            if (i === splits.length - 1) return "Front"; // top tick
            return ""; // hide all other labels
          });
        },
      },
    ],
    series: [{}, { label, stroke: color, width: 2 }],
    hooks: {
      draw: [
        (u) => {
          drawHorizontalAxis(u, BLACK_COLOUR);
          drawVerticalAxisStationary(u, BLACK_COLOUR);
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

function drawVerticalAxisStationary(u: uPlot, color: string) {
  const { ctx } = u;
  const { left, top, height } = u.bbox;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(left, top + height);
  ctx.stroke();
  ctx.restore();
}

function drawPlotLastPointAsCircle(u: uPlot, color: string) {
  const ySeries = u.data[1] as number[];
  const xSeries = u.data[0] as number[];
  if (!ySeries.length) return;

  const lastIdx = ySeries.length - 1;
  const xVal = xSeries[lastIdx];
  const yVal = ySeries[lastIdx];

  const xPos = u.valToPos(xVal, "x", true);
  const yPos = u.valToPos(yVal, "y", true);

  const ctx = u.ctx;
  ctx.save();
  ctx.beginPath();
  ctx.arc(xPos, yPos, 6, 0, 2 * Math.PI); // radius 6px
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "#fff"; // white border
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

// CoPx vs Time (time on Y, CoPx on X)
// - Vertical axis fixed at x = 0 (center), labeled "CoPx" at the top
// - Horizontal axis fixed at the top, labeled "Left" (far left) and "Right"
// - Last point is drawn as a filled circle

// Transposed CoP-X plot: time runs top→bottom, CoP-X runs left→right.
// Produces the second mock image: a top stationary axis labeled
// "Left  CoPx  Right", a vertical zero line at CoPx=0, the CoP-X trace
// drawn top→bottom, and the last point highlighted.

export function copXPlotSettings(macAddress: number) {
  const width = 100;
  const height = 100;
  const color = BLUE_COLOUR;
  const label = "CoPx";

  // Horizontal domain (CoP-X)
  const X_MIN = -50;
  const X_MAX = 50;

  // Vertical domain (time window)
  const WINDOW_SEC = 10;
  const PAD_SEC = 1.5;

  const uPlotOptions: uPlot.Options = {
    width,
    height,
    legend: { show: false },
    cursor: { show: false },
    padding: [20, 0, 0, 0], // top, right, bottom, left

    // Keep uPlot's native orientation (time on x, value on y),
    // but hide built-in axes, and draw everything transposed in hooks.
    scales: {
      x: {
        range: (_u, _min, max) => {
          const now = max || 0;
          return [now - WINDOW_SEC, now + PAD_SEC];
        },
      },
      y: { range: [X_MIN, X_MAX] },
    },

    axes: [
      { scale: "x", show: false },
      { scale: "y", show: false },
    ],

    // Hide default series drawing; we’ll render our own transposed line.
    series: [{}, {}],

    hooks: {
      draw: [
        (u) => {
          drawTopAxisStationary(u, BLACK_COLOUR);
          drawVerticalZeroAxis(u, BLACK_COLOUR, X_MIN, X_MAX);
          drawTransposedSeries(u, color, X_MIN, X_MAX);
          drawLastPointTransposed(u, color, X_MIN, X_MAX);
          drawTopAxisLabels(u, label);
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

function makeDataMapper<T extends { timestamp: number }>(selector: (data: T) => number) {
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

// ------------------------ drawing helpers ------------------------

function drawTopAxisStationary(u: uPlot, color: string) {
  const { ctx } = u;
  const { left, top, width } = u.bbox;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(left + width, top);
  ctx.stroke();
  ctx.restore();
}

function drawTopAxisLabels(u: uPlot, centerLabel: string) {
  const { ctx } = u;
  const { left, top, width } = u.bbox;

  ctx.save();
  ctx.fillStyle = "#666";
  ctx.font = "12px sans-serif";
  ctx.textBaseline = "bottom";

  // Left
  ctx.textAlign = "left";
  ctx.fillText("Left", left, top - 4);

  // Center label (CoPx)
  ctx.textAlign = "center";
  ctx.fillText(centerLabel, left + width / 2, top - 4);

  // Right
  ctx.textAlign = "right";
  ctx.fillText("Right", left + width, top - 4);

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

// Map CoP-X value -> horizontal px
function xPxFromCoPx(u: uPlot, value: number, minX: number, maxX: number): number {
  const { left, width } = u.bbox;
  const ratio = (value - minX) / (maxX - minX);
  return left + ratio * width;
}

// Map time (on uPlot's x-scale) -> vertical px (top→bottom)
function yPxFromTime(u: uPlot, t: number): number {
  const { top, height, left, width } = u.bbox;
  const xPos = u.valToPos(t, "x", true); // horizontal px on native scale
  const ratio = (xPos - left) / width; // 0..1
  return top + ratio * height; // vertical px
}

// Draw the CoP-X trace with time flowing downward.
function drawTransposedSeries(u: uPlot, color: string, minX: number, maxX: number) {
  const t = u.data[0] as number[];
  const xVals = u.data[1] as number[];
  if (!t.length) return;

  const { ctx } = u;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();

  for (let i = 0; i < t.length; i++) {
    const x = xPxFromCoPx(u, xVals[i], minX, maxX);
    const y = yPxFromTime(u, t[i]);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  ctx.stroke();
  ctx.restore();
}

function drawLastPointTransposed(u: uPlot, color: string, minX: number, maxX: number) {
  const t = u.data[0] as number[];
  const xVals = u.data[1] as number[];
  if (!t.length) return;

  const last = t.length - 1;
  const x = xPxFromCoPx(u, xVals[last], minX, maxX);
  const y = yPxFromTime(u, t[last]);

  const { ctx } = u;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

export function vCopYPlotSettings(macAddress: number) {
  const width = 150;
  const height = 150;
  const color = RED_COLOUR;
  const label = "vCoPy";

  const WINDOW_SEC = 10;
  const PAD_SEC = 1.5;

  const uPlotOptions: uPlot.Options = {
    width,
    height,
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
        border: { show: true, stroke: BLACK_COLOUR, width: 2 },
      },
      {
        scale: "y",
        grid: { show: false },
        label: label,
        ticks: { show: false },
        border: { show: true, stroke: BLACK_COLOUR, width: 2 },
      },
    ],
    series: [{}, { label, stroke: color, width: 2 }],

    hooks: {
      draw: [
        (u) => {
          drawPlotLastPointAsCircle(u, color);
        },
      ],
    },
  };

  const dataSelector = (state: SessionState) => state.processedSessionData[macAddress];
  const dataMapper = makeDataMapper<ProcessedBoardEvent>((d) => d.vCopY);

  return { uPlotOptions, dataSelector, dataMapper };
}

export function vCopXPlotSettings(macAddress: number) {
  const width = 250;
  const height = 150;
  const color = RED_COLOUR;
  const label = "vCoPx";

  const WINDOW_SEC = 10;
  const PAD_SEC = 1.5;

  const uPlotOptions: uPlot.Options = {
    width,
    height,
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
        border: { show: true, stroke: BLACK_COLOUR, width: 2 },
      },
      {
        scale: "y",
        grid: { show: false },
        label: label,
        ticks: { show: false },
        border: { show: true, stroke: BLACK_COLOUR, width: 2 },
      },
    ],
    series: [{}, { label, stroke: color, width: 2 }],

    hooks: {
      draw: [
        (u) => {
          drawPlotLastPointAsCircle(u, color);
        },
      ],
    },
  };

  const dataSelector = (state: SessionState) => state.processedSessionData[macAddress];
  const dataMapper = makeDataMapper<ProcessedBoardEvent>((d) => d.vCopX);

  return { uPlotOptions, dataSelector, dataMapper };
}
