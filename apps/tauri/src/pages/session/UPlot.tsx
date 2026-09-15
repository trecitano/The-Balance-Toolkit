import { useEffect, useMemo } from "react";
import uPlot from "uplot";
import { useUPlot } from "@/hooks/useUPlot";
import "uplot/dist/uPlot.min.css";
import { BoardBuffer, SessionState, SessionStore } from "@/store/sessionDataStore.tsx";
import { Tooltip } from "@/components/Tooltip.tsx";

/** Seconds of history the rolling plots show. */
export const PLOT_WINDOW_SEC = 10;
/** Padding after the newest point so it is not drawn on the plot edge. */
export const PLOT_PAD_SEC = 1.5;
/**
 * Seconds of history handed to uPlot. Slightly more than the visible window so the line still
 * enters from the left edge; anything older is never drawn, so it is never mapped either.
 */
export const PLOT_DATA_SEC = PLOT_WINDOW_SEC + 2;

export const RED_COLOUR = "#ef4444";
export const BLACK_COLOUR = "#000";
export const BLUE_COLOUR = "#3b82f6";
export const YELLOW_COLOUR = "#f59e0b";
export const GREEN_COLOUR = "#10b981";

/* ---------------- Shared option fragments ---------------- */

// Width and height are supplied by `useUPlot` from the host element.
export const basePlotOptions = {
  width: 0,
  height: 0,
  legend: { show: false },
  cursor: { show: false },
} satisfies Partial<uPlot.Options>;

/** Time axis that follows the newest sample, keeping the last PLOT_WINDOW_SEC seconds in view. */
export const rollingXScale: uPlot.Scale = {
  range: (_u, _min, max) => {
    const now = max || 0;
    return [now - PLOT_WINDOW_SEC, now + PLOT_PAD_SEC];
  },
};

export const axisBorder: uPlot.Axis.Border = { show: true, stroke: BLACK_COLOUR, width: 2 };

/** An x axis that takes no space and draws no labels; the plots show a rolling window, not time. */
export const hiddenXAxis: uPlot.Axis = {
  scale: "x",
  values: () => [],
  grid: { show: false },
  ticks: { show: false },
  size: 0,
};

/* ---------------- Plot kinds ---------------- */

type PlotData = { t: number[]; y: (number | null)[] };
type PlotSettings = {
  uPlotOptions: uPlot.Options;
  select: (state: SessionState) => BoardBuffer<unknown> | undefined;
  map: (buffer: BoardBuffer<unknown>) => PlotData;
};

function plotSettings<T extends { timestamp: number }>(
  uPlotOptions: uPlot.Options,
  select: (state: SessionState) => BoardBuffer<T> | undefined,
  pick: (frame: T) => number | null,
): PlotSettings {
  // `select` and `map` only ever meet inside `UPlot`, so widening T here is safe.
  return { uPlotOptions, select, map: makeDataMapper(pick) as PlotSettings["map"] };
}

export type PlotKind = "copX" | "copY" | "vCopX" | "vCopY";

const PLOT_KINDS: Record<PlotKind, (macAddress: number) => PlotSettings> = {
  copX: (macAddress) =>
    plotSettings(
      copXOptions(BLUE_COLOUR),
      (state) => state.rawSessionData[macAddress],
      (f) => f.copX,
    ),
  copY: (macAddress) =>
    plotSettings(
      copYOptions(RED_COLOUR),
      (state) => state.rawSessionData[macAddress],
      (f) => f.copY,
    ),
  vCopX: (macAddress) =>
    plotSettings(
      standardPlot(BLUE_COLOUR),
      (state) => state.processedSessionData[macAddress],
      (f) => f.vCopX,
    ),
  vCopY: (macAddress) =>
    plotSettings(
      standardPlot(RED_COLOUR),
      (state) => state.processedSessionData[macAddress],
      (f) => f.vCopY,
    ),
};

export function UPlot({
  title,
  tooltipId,
  kind,
  macAddress,
  store,
}: {
  title: string;
  tooltipId?: string;
  kind: PlotKind;
  macAddress: number;
  store: SessionStore;
}) {
  const settings = useMemo(() => PLOT_KINDS[kind](macAddress), [kind, macAddress]);
  // Options are captured on mount, so a panel that shows a different board must remount this
  // component (key it by board).
  const { hostRef, plotRef } = useUPlot(() => settings.uPlotOptions, 2);

  useEffect(
    () =>
      store.subscribe(
        settings.select,
        (buffer) => {
          if (!plotRef.current || buffer === undefined) return;
          const { t, y } = settings.map(buffer);
          plotRef.current.setData([t, y]);
        },
        { fireImmediately: true },
      ),
    [store, settings, plotRef],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-5 items-center justify-center">
        <div className="relative font-semibold">
          {title}
          {tooltipId && (
            <div className="absolute top-1/2 left-full ml-2.5 -translate-y-1/2">
              <Tooltip tooltipId={tooltipId} />
            </div>
          )}
        </div>
      </div>
      <div ref={hostRef} className="min-h-0 flex-1" />
    </div>
  );
}

function copYOptions(color: string): uPlot.Options {
  return {
    ...basePlotOptions,
    padding: [20, 30, 20, 15], // top, right, bottom, left
    scales: { x: rollingXScale, y: { range: [-1, 1] } },
    axes: [
      hiddenXAxis,
      {
        scale: "y",
        grid: { show: false },
        border: axisBorder,
        font: "10px sans-serif",
        stroke: "#3d3d3d",
        values: (_, splits) =>
          splits.map((_, i) => {
            if (i === 0) return "Back (-1)"; // bottom tick
            if (i === splits.length - 1) return "Front (1)"; // top tick
            return ""; // hide all other labels
          }),
        ticks: {
          show: true,
          size: 6,
          stroke: "#b2b2b2",
          filter: (_, splits) => splits.map((v, i) => (i === 0 || i === splits.length - 1 ? v : null)),
        },
      },
    ],
    series: [{}, { stroke: color, width: 2 }],
    hooks: {
      draw: [
        (u) => {
          drawHorizontalAxis(u, BLACK_COLOUR);
          drawLastPointAsCircle(u, color);
        },
      ],
    },
  };
}

function copXOptions(color: string): uPlot.Options {
  // Horizontal domain (CoP-X)
  const X_MIN = -1;
  const X_MAX = 1;

  return {
    ...basePlotOptions,
    padding: [0, 30, 20, 30], // top, right, bottom, left

    // Keep uPlot's native orientation (time on x, value on y),
    // but hide built-in axes, and draw everything transposed in hooks.
    scales: {
      x: { ...rollingXScale, ori: 1, dir: -1 },
      y: { range: [X_MIN, X_MAX], ori: 0 },
    },
    axes: [
      { ...hiddenXAxis, side: 0, size: 20, border: axisBorder },
      { scale: "y", show: false },
    ],
    series: [{}, { stroke: color, width: 2 }],
    hooks: {
      draw: [
        (u) => {
          drawVerticalZeroAxis(u, BLACK_COLOUR, X_MIN, X_MAX);
          drawTopAxisLabels(u);
          drawLastPointAsCircle(u, color, { transposed: true });
        },
      ],
    },
  };
}

function standardPlot(color: string): uPlot.Options {
  return {
    ...basePlotOptions,
    scales: {
      x: rollingXScale,
      y: {
        range: (_, min, max) => {
          if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
          if (min === max) return [0, max + 0.1];
          return [0, Number((max + 0.1).toFixed(1))];
        },
      },
    },
    axes: [
      { ...hiddenXAxis, border: axisBorder },
      {
        scale: "y",
        grid: { show: false },
        ticks: { show: true, size: 6, stroke: "#b2b2b2" },
        border: axisBorder,
        size: 35,
      },
    ],
    series: [{}, { stroke: color, width: 2 }],
    hooks: { draw: [(u) => drawLastPointAsCircle(u, color)] },
  };
}

/* ---------------- Helper functions ---------------- */

/**
 * Visits the frames from the last `seconds` of a ring buffer, oldest to newest. The buffer
 * keeps far more history than the plots show (processed data at 10 Hz fills it with minutes),
 * so walking back from the head and stopping at the window edge keeps each redraw proportional
 * to what is drawn rather than to the buffer size.
 */
export function forEachFrameInWindow<T extends { timestamp: number }>(
  buf: BoardBuffer<T>,
  seconds: number,
  visit: (frame: T) => void,
) {
  if (buf.len === 0) return;
  const cap = buf.frames.length;
  const newest = buf.frames[buf.head];
  if (!newest) return;

  const tStart = newest.timestamp - seconds * 1000;
  let count = 0;
  for (; count < buf.len; count++) {
    const f = buf.frames[(buf.head - count + cap) % cap];
    if (!f || f.timestamp < tStart) break;
  }

  for (let i = count - 1; i >= 0; i--) {
    visit(buf.frames[(buf.head - i + cap) % cap] as T);
  }
}

// A `null` value is a metric the backend could not compute for that frame; uPlot draws it as a gap.
export function makeDataMapper<T extends { timestamp: number }>(selector: (data: T) => number | null) {
  return (buf: BoardBuffer<T>): PlotData => {
    const t: number[] = [];
    const y: (number | null)[] = [];

    // Epoch seconds go straight onto the x scale: its range is relative to the newest point
    // and the axis labels are hidden, so no per-frame re-basing is needed.
    forEachFrameInWindow(buf, PLOT_DATA_SEC, (f) => {
      t.push(f.timestamp / 1000);
      y.push(selector(f));
    });

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

/** Marks the newest sample of a series with a filled circle. Skips hidden series and gaps. */
export function drawLastPointAsCircle(
  u: uPlot,
  color: string,
  { seriesIdx = 1, transposed = false }: { seriesIdx?: number; transposed?: boolean } = {},
) {
  if (!u.series[seriesIdx]?.show) return;
  const ySeries = u.data[seriesIdx] as (number | null)[] | undefined;
  const xSeries = u.data[0] as number[];
  if (!ySeries?.length) return;

  const lastIdx = ySeries.length - 1;
  const xVal = xSeries[lastIdx];
  const yVal = ySeries[lastIdx];
  if (xVal === undefined || yVal == null || !Number.isFinite(yVal)) return;

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
