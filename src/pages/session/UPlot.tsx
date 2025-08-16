import React, { useEffect, useLayoutEffect, useRef } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import { useSessionDataStore, BoardBuffer, SessionState, useSessionRawDataBuffer } from "@/store/sessionDataStore.tsx";
import { ProcessedBoardEvent, RawBalanceBoardEvent } from "@/types.ts";

type DataSelector<T> = (state: any) => BoardBuffer<T> | undefined;
type DataMapper<T> = (buf: BoardBuffer<T>) => { t: number[]; y: number[] };

const RED_COLOUR = "#ef4444";
const BLACK_COLOUR = "#000";
const BLUE_COLOUR = "#3b82f6";

function UPlotLineGeneric<T>({
  uPlotOptions,
  dataSelector,
  dataMapper,
}: {
  uPlotOptions: uPlot.Options;
  dataSelector: DataSelector<T>;
  dataMapper: DataMapper<T>;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const plotRef = useRef<uPlot | null>(null);
  const widthRef = useRef(0);

  console.log("NEW RENDER?!");

  // Mount uPlot once
  useLayoutEffect(() => {
    if (!hostRef.current || plotRef.current) return;

    const width = hostRef.current.clientWidth || 300;
    widthRef.current = width;

    plotRef.current = new uPlot(uPlotOptions, [[], []], hostRef.current);

    const onResize = () => {
      const w = hostRef.current!.clientWidth;
      if (w !== widthRef.current) {
        widthRef.current = w;
        plotRef.current!.setSize({ width: w, height });
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
    const unsub = useSessionDataStore.subscribe(
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
          // console.log("Equality check:", { a: a?.len, b: b?.len });
          return a === b; // Try simple reference equality first
        },
      },
    );

    return () => unsub();
  }, []);

  return <div ref={hostRef} className="w-full" />;
}

export const UPlot = React.memo(UPlotLineGeneric, (prevProps, nextProps) => {
  return JSON.stringify(prevProps.uPlotOptions) === JSON.stringify(nextProps.uPlotOptions);
});

export function copYPlotSettings(macAddress: number) {
  const width = 150;
  const height = 150;
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
  const width = 150;
  const height = 150;
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

function makeDataMapper<T extends { timestamp: number }>(
  selector: (data: T) => number
) {
  return (buf: BoardBuffer<T>) => {
    const t: number[] = [];
    const y: number[] = [];
    let t0: number | null = null;

    for (let i = 0; i < buf.len; i++) {
      const idx =
        (buf.head - (buf.len - 1 - i) + buf.frames.length) %
        buf.frames.length;
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

export function vCopXPlotSettings(macAddress: number) {
  const width = 150;
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
    },
    axes: [
      {
        scale: "x",
        values: () => [],
        grid: { show: false },
        ticks: { show: false },
        border: { show: true, stroke: color, width: 2  },
      },
      {
        scale: "y",
        grid: { show: false },
        ticks: { show: false },
        border: { show: true, stroke: BLACK_COLOUR, width: 2  },
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











// ------------- Confidence Ellipse Area vs time -------------

export function confidenceEllipseAreaPlotSettings(boardId: string) {
  const width = 150;
  const height = 150;
  const color = BLUE_COLOUR;
  const label = "CE Area";

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
        range: (_u, _min, max) => {
          const top = Number.isFinite(max) ? (max as number) : 1;
          return [0, top > 0 ? top * 1.1 : 1];
        },
      },
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
        values: (_u, splits) => {
          const out = splits.map(() => "");
          if (splits.length > 0) out[0] = "0";
          const mid = Math.floor(splits.length / 2);
          if (splits.length > 0) out[mid] = label;
          return out;
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

  const dataSelector = (state: SessionState) => state.processedSessionData[boardId];

  const dataMapper = (buf: BoardBuffer<ProcessedBoardEvent>) => {
    const t: number[] = [];
    const y: number[] = [];
    let t0: number | null = null;

    for (let i = 0; i < buf.len; i++) {
      const idx = (buf.head - (buf.len - 1 - i) + buf.frames.length) % buf.frames.length;
      const f = buf.frames[idx];
      if (!f) continue;

      const arr = f.confidenceEllipsePolygon;
      if (!arr || arr.length === 0) continue;

      const tsSec = f.timestamp / 1000;
      if (t0 === null) t0 = tsSec;
      t.push(tsSec - t0);
      y.push(arr[arr.length - 1]);
    }

    return { t, y };
  };

  return { uPlotOptions, dataSelector, dataMapper };
}

// --------------- Convex Hull Area vs time ------------------

export function convexHullAreaPlotSettings(boardId: string) {
  const width = 150;
  const height = 150;
  const color = RED_COLOUR;
  const label = "Hull Area";

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
        range: (_u, _min, max) => {
          const top = Number.isFinite(max) ? (max as number) : 1;
          return [0, top > 0 ? top * 1.1 : 1];
        },
      },
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
        values: (_u, splits) => {
          const out = splits.map(() => "");
          if (splits.length > 0) out[0] = "0";
          const mid = Math.floor(splits.length / 2);
          if (splits.length > 0) out[mid] = label;
          return out;
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

  const dataSelector = (state: SessionState) => state.processedSessionData[boardId];

  const dataMapper = (buf: BoardBuffer<ProcessedBoardEvent>) => {
    const t: number[] = [];
    const y: number[] = [];
    let t0: number | null = null;

    for (let i = 0; i < buf.len; i++) {
      const idx = (buf.head - (buf.len - 1 - i) + buf.frames.length) % buf.frames.length;
      const f = buf.frames[idx];
      if (!f) continue;

      const arr = f.convexHullPolygon;
      if (!arr || arr.length === 0) continue;

      const tsSec = f.timestamp / 1000;
      if (t0 === null) t0 = tsSec;
      t.push(tsSec - t0);
      y.push(arr[arr.length - 1]);
    }

    return { t, y };
  };

  return { uPlotOptions, dataSelector, dataMapper };
}









// ========== Polygon helpers ==========

// Extract the most recent polygon from a rolling buffer.
function extractLatestPolygon(
  buf: BoardBuffer<ProcessedBoardEvent>,
  key: "confidenceEllipsePolygon" | "convexHullPolygon"
): { x: number[]; y: number[] } {
  // Walk newest -> oldest to find the first frame that has the polygon.
  for (let i = buf.len - 1; i >= 0; i--) {
    const idx =
      (buf.head - (buf.len - 1 - i) + buf.frames.length) % buf.frames.length;
    const f = buf.frames[idx];
    if (!f) continue;

    const poly = f[key];

    if (Array.isArray(poly) && poly.length >= 2) {
      const x: number[] = new Array(poly.length);
      const y: number[] = new Array(poly.length);
      for (let k = 0; k < poly.length; k++) {
        // Expecting [x, y]
        x[k] = poly[k][0];
        y[k] = poly[k][1];
      }
      return { x, y };
    }
  }

  return { x: [], y: [] };
}

// Draws a polyline from u.data[0] (x) and u.data[1] (y).
// If closePath is true, closes the polygon; if fill is provided, fills it.
function drawPolylineXY(
  u: uPlot,
  color: string,
  lineWidth: number,
  closePath: boolean,
  fill?: string
) {
  const xs = (u.data[0] as number[]) || [];
  const ys = (u.data[1] as number[]) || [];
  if (xs.length === 0 || ys.length === 0 || xs.length !== ys.length) return;

  const { ctx } = u;

  ctx.save();
  ctx.beginPath();

  for (let i = 0; i < xs.length; i++) {
    const x = u.valToPos(xs[i], "x", true);
    const y = u.valToPos(ys[i], "y", true);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  if (closePath) ctx.closePath();

  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }

  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = color;
  ctx.stroke();

  ctx.restore();
}

// Optional: draw x=0 and y=0 axes for reference.
// Re-uses your existing helpers if available; otherwise:
function drawZeroAxes(u: uPlot, color: string) {
  // y = 0 horizontal line
  const y0 = u.valToPos(0, "y", true);
  const { left, width } = u.bbox;

  const { ctx } = u;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  ctx.moveTo(left, y0);
  ctx.lineTo(left + width, y0);
  ctx.stroke();

  // x = 0 vertical line
  const x0 = u.valToPos(0, "x", true);
  const { top, height } = u.bbox;

  ctx.beginPath();
  ctx.moveTo(x0, top);
  ctx.lineTo(x0, top + height);
  ctx.stroke();

  ctx.restore();
}

// ========== Confidence Ellipse Polygon ==========

export function confidenceEllipsePolygonPlotSettings(boardId: string) {
  const width = 150;
  const height = 150;
  const stroke = "#3b82f6"; // BLUE_COLOUR
  const fill = "rgba(59, 130, 246, 0.15)";

  const uPlotOptions: uPlot.Options = {
    width,
    height,
    legend: { show: false },
    cursor: { show: false },

    // Dynamic ranges based on polygon extents with small padding.
    scales: {
      x: {
        range: (_u, min, max) => {
          return [-100, 100]
          if (!Number.isFinite(min) || !Number.isFinite(max)) return [-1, 1];
          const span = Math.max(1e-3, (max as number) - (min as number));
          const pad = span * 0.05;
          return [-100, 100]
        },
      },
      y: {
        range: (_u, min, max) => {
          return [-100, 100]
          if (!Number.isFinite(min) || !Number.isFinite(max)) return [-1, 1];
          const span = Math.max(1e-3, (max as number) - (min as number));
          const pad = span * 0.05;
          return [(min as number) - pad, (max as number) + pad];
        },
      },
    },

    // Hide built-in axes; we’ll draw center axes in the hook.
    axes: [
      { scale: "x", show: false },
      { scale: "y", show: false },
    ],

    // Hide default series drawing; we’ll render from hooks using u.data.
    series: [{}, { show: false }],

    hooks: {
      draw: [
        (u) => {
          drawZeroAxes(u, "#000"); // BLACK_COLOUR
          drawPolylineXY(u, stroke, 2, true, fill);
        },
      ],
    },
  };

  const dataSelector = (state: SessionState) =>
    state.processedSessionData[boardId];

  const dataMapper = (buf: BoardBuffer<ProcessedBoardEvent>) => {
    const { x, y } = extractLatestPolygon(buf, "confidenceEllipsePolygon");
    return { t: x, y };
  };

  return { uPlotOptions, dataSelector, dataMapper };
}

// ========== Convex Hull Polygon ==========

export function convexHullPolygonPlotSettings(boardId: string) {
  const width = 150;
  const height = 150;
  const stroke = "#ef4444"; // RED_COLOUR
  const fill = "rgba(239, 68, 68, 0.12)";

  const uPlotOptions: uPlot.Options = {
    width,
    height,
    legend: { show: false },
    cursor: { show: false },

    scales: {
      x: {
        range: (_u, min, max) => {
          if (!Number.isFinite(min) || !Number.isFinite(max)) return [-1, 1];
          const span = Math.max(1e-3, (max as number) - (min as number));
          const pad = span * 0.05;
          return [-100, 100];
        },
      },
      y: {
        range: (_u, min, max) => {
          return [-100, 100]
        },
      },
    },

    axes: [
      { scale: "x", show: false },
      { scale: "y", show: false },
    ],

    series: [{}, { show: false }],

    hooks: {
      draw: [
        (u) => {
          drawZeroAxes(u, "#000"); // BLACK_COLOUR
          drawPolylineXY(u, stroke, 2, true, fill);
        },
      ],
    },
  };

  const dataSelector = (state: SessionState) =>
    state.processedSessionData[boardId];

  const dataMapper = (buf: BoardBuffer<ProcessedBoardEvent>) => {
    const { x, y } = extractLatestPolygon(buf, "convexHullPolygon");
    return { t: x, y };
  };

  return { uPlotOptions, dataSelector, dataMapper };
}
