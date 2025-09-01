import {
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  useState,
} from "react";
import { BoardBuffer, SessionState } from "@/store/sessionDataStore.tsx";
import {
  RawBalanceBoardEvent,
  processedSingleFrameSessionData,
} from "@/types.ts";
import { StoreApi } from "zustand";
import wbbTopdown from "@/assets/wbb-topdown.svg";

// Constants (same units as your CoP/polygons, typically mm)
const COP_X_MIN = -216.5;
const COP_X_MAX = 216.5;
const COP_Y_MIN = -119.0;
const COP_Y_MAX = 119.0;

const TRAIL_SECONDS = 1;

const BLUE = "#3b82f6";
const BLUE_FILL = "rgba(59, 130, 246, 0.15)";
const RED = "#ef4444";
const RED_FILL = "rgba(239, 68, 68, 0.12)";
const DOT_COLOR = BLUE;
const DOT_RADIUS = 6;

type Props = {
  macAddress: number;
  src: string;
  alt?: string;
  className?: string;
  store: StoreApi<SessionState>;
};

export function BalanceBoardWithCoPOverlay({
                                             macAddress,
                                             store,
                                           }: Props) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Local UI state for toggles
  const [showConfidenceEllipse, setShowConfidenceEllipse] = useState(true);
  const [showConvexHull, setShowConvexHull] = useState(true);

  // Stability index state
  const [stabilityIndex, setStabilityIndex] = useState<number | null>(null);

  const [weightKg, setWeightKg] = useState<number | null>(null);

  // Refs to avoid re-render on every frame
  const rawRef = useRef<BoardBuffer<RawBalanceBoardEvent> | undefined>(
    undefined,
  );
  const polyRef = useRef<processedSingleFrameSessionData | undefined>(undefined);
  const showCERef = useRef<boolean>(showConfidenceEllipse);
  const showHullRef = useRef<boolean>(showConvexHull);

  const rafRef = useRef<number | null>(null);

  const scheduleDraw = useCallback(() => {
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      draw(
        canvasRef.current,
        rawRef.current,
        polyRef.current,
        showCERef.current,
        showHullRef.current,
      );
    });
  }, []);

  // Canvas size management (DPR-aware)
  useLayoutEffect(() => {
    if (!imgRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const image = imgRef.current;

    const ro = new ResizeObserver(() => {
      const dpr = Math.max(1, window.devicePixelRatio || 1);

      const w = Math.round(image.clientWidth);
      const h = Math.round(image.clientHeight);

      if (w === 0 || h === 0) return;

      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.imageSmoothingEnabled = true;
      }

      scheduleDraw();
    });

    ro.observe(image);
    return () => ro.disconnect();
  }, [scheduleDraw]);

  // Subscriptions
  useEffect(() => {
    const rawDataUnsub = store.subscribe(
      (s) => s.rawSessionData?.[macAddress],
      (buf) => {
        rawRef.current = buf;

        const lastRawFrame = buf.frames[buf.head];
        const weight = lastRawFrame?.weight;

        setWeightKg(weight ?? null);


        scheduleDraw();
      },
      { equalityFn: (a, b) => a === b },
    );

    const lastFrameDataUnsub = store.subscribe(
      (s) => s.processedSingleFrameSessionData?.[macAddress],
      (lastFrameData) => {
        polyRef.current = lastFrameData;
        setStabilityIndex(lastFrameData?.stabilityIndex ?? null);

        scheduleDraw();
      },
      { equalityFn: (a, b) => a === b },
    );

    return () => {
      rawDataUnsub();
      lastFrameDataUnsub();
    }
  }, [macAddress, scheduleDraw]);

  // Keep refs in sync with state
  useEffect(() => {
    showCERef.current = showConfidenceEllipse;
    showHullRef.current = showConvexHull;
    scheduleDraw();
  }, [showConfidenceEllipse, showConvexHull, scheduleDraw]);

  // Clean raf
  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className="relative flex gap-3 h-full">
      <div className="relative w-7/10">
        <img
          ref={imgRef}
          src={wbbTopdown}
          className="pointer-events-none block object-contain select-none"
          draggable={false}
          onLoad={scheduleDraw}
        />
        <canvas
          className="pointer-events-none absolute inset-0"
          ref={canvasRef}
        />
      </div>

      {/* Controls + Stability Index */}
      <div className="flex flex-col w-3/10 gap-3">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={showConfidenceEllipse}
            onChange={(e) => setShowConfidenceEllipse(e.target.checked)}
          />
          <span>Confidence ellipse</span>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={showConvexHull}
            onChange={(e) => setShowConvexHull(e.target.checked)}
          />
          <span>Convex hull</span>
        </label>

        <div className="text-sm text-gray-700">
          Stability Index:{" "}
          <span className="font-semibold">
            {stabilityIndex !== null ? stabilityIndex.toFixed(2) : "—"}
          </span>
        </div>
        <div className="text-sm text-gray-700">
          Weight
          <span className="font-semibold">
            {weightKg !== null ? weightKg.toFixed(2) : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Drawing helpers ---------------- */

function draw(
  canvas: HTMLCanvasElement | null,
  raw: BoardBuffer<RawBalanceBoardEvent> | undefined,
  poly: processedSingleFrameSessionData | undefined,
  showCE: boolean,
  showHull: boolean,
) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const w = canvas.clientWidth;
  const h = canvas.clientHeight;

  if (w === 0 || h === 0) return;

  ctx.clearRect(0, 0, w, h);

  // Polygons under the trail/dot
  if (poly) {
    if (showHull && poly.convexHullPolygon?.length >= 3) {
      drawPolygon(ctx, w, h, poly.convexHullPolygon, RED, RED_FILL, 2);
    }
    if (showCE && poly.confidenceEllipsePolygon?.length >= 3) {
      drawPolygon(ctx, w, h, poly.confidenceEllipsePolygon, BLUE, BLUE_FILL, 2);
    }
  }

  // Trail + last point
  if (raw && raw.len > 0) {
    const pts = getLastSeconds(raw, TRAIL_SECONDS);
    if (pts.length > 0) {
      const mapped = pts.map((p) => ({
        x: mapX(p.x, w),
        y: mapY(p.y, h),
        t: p.t,
      }));

      ctx.save();
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = DOT_COLOR;

      ctx.beginPath();
      ctx.moveTo(mapped[0].x, mapped[0].y);
      for (let i = 1; i < mapped.length; i++) {
        ctx.lineTo(mapped[i].x, mapped[i].y);
      }
      ctx.stroke();
      ctx.restore();

      const last = mapped[mapped.length - 1];
      ctx.save();
      ctx.beginPath();
      ctx.arc(last.x, last.y, DOT_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = DOT_COLOR;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#fff";
      ctx.stroke();
      ctx.restore();
    }
  }
}

function drawPolygon(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  points: [number, number][],
  stroke: string,
  fill?: string,
  lineWidth = 2,
) {
  if (!points || points.length === 0) return;

  ctx.save();
  ctx.beginPath();
  const [x0, y0] = points[0];
  ctx.moveTo(mapX(x0, width), mapY(y0, height));

  for (let i = 1; i < points.length; i++) {
    const [x, y] = points[i];
    ctx.lineTo(mapX(x, width), mapY(y, height));
  }

  ctx.closePath();

  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }

  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = stroke;
  ctx.stroke();
  ctx.restore();
}

function getLastSeconds(
  buf: BoardBuffer<RawBalanceBoardEvent>,
  seconds: number,
) {
  if (!buf || buf.len === 0)
    return [] as { x: number; y: number; t: number }[];

  const frames = buf.frames;
  const cap = frames.length;
  const lastIdx = buf.head;
  const last = frames[lastIdx];
  if (!last) return [];

  const tEnd = last.timestamp;
  const tStart = tEnd - seconds * 1000;

  const out: { x: number; y: number; t: number }[] = [];
  for (let i = 0; i < buf.len; i++) {
    const idx = (lastIdx - i + cap) % cap;
    const f = frames[idx];
    if (!f) break;
    if (f.timestamp < tStart) break;
    out.push({ x: f.copX, y: f.copY, t: f.timestamp / 1000 });
  }
  out.reverse();
  return out;
}

function mapX(v: number, width: number) {
  const ratio = (v - COP_X_MIN) / (COP_X_MAX - COP_X_MIN);
  return clamp(ratio, 0, 1) * width;
}

function mapY(v: number, height: number) {
  // Invert so positive Y is visually up
  const ratio = (v - COP_Y_MIN) / (COP_Y_MAX - COP_Y_MIN);
  return (1 - clamp(ratio, 0, 1)) * height;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}