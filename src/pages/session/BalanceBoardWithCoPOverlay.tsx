import React, { useEffect, useLayoutEffect, useRef } from "react";
import { useSessionDataStore, BoardBuffer } from "@/store/sessionDataStore";
import { RawBalanceBoardEvent } from "@/types";

// Constants (match your uPlot ranges)
const COP_X_MIN = -216.5;
const COP_X_MAX = 216.5;
const COP_Y_MIN = -119.0;
const COP_Y_MAX = 119.0;
const TRAIL_SECONDS = 1;
const DOT_COLOR = "#3b82f6"; // blue
const DOT_RADIUS = 6;

type Props = {
  boardId: string;
  src: string;
  alt?: string;
  className?: string; // optional wrapper classes (height/centering etc.)
};

export function BalanceBoardWithCoPOverlay({
  boardId,
  src,
  alt = "Balance Board",
  className = "flex h-[120px] items-center justify-center",
}: Props) {
  // Outer container just centers content, as in your snippet
  const outerRef = useRef<HTMLDivElement | null>(null);

  // This wrapper shrink-wraps to the image size so the overlay aligns
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Keep canvas sized to wrapper and scaled for devicePixelRatio
  useLayoutEffect(() => {
    if (!wrapRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const wrapper = wrapRef.current;

    const ro = new ResizeObserver(() => {
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const w = Math.round(wrapper.clientWidth);
      const h = Math.round(wrapper.clientHeight);

      // Style size (CSS pixels)
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      // Backing store size (device pixels)
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // scale once
        ctx.imageSmoothingEnabled = true;
      }
    });

    ro.observe(wrapper);
    return () => ro.disconnect();
  }, []);

  // Draw whenever new data arrives
  useEffect(() => {
    // Subscribe directly for high-frequency updates without re-rendering
    const unsub = useSessionDataStore.subscribe(
      (s) => s.rawSessionData?.[boardId],
      (buffer) => {
        drawFrame(buffer, canvasRef.current);
      },
      { equalityFn: (a, b) => a === b },
    );

    // Draw one frame on mount (in case data already exists)
    const initial = useSessionDataStore.getState().rawSessionData?.[boardId];
    drawFrame(initial, canvasRef.current);

    return () => unsub();
  }, [boardId]);

  return (
    <div ref={outerRef} className={className}>
      <div ref={wrapRef} className="relative inline-block h-full">
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          className="pointer-events-none block h-full object-contain select-none"
          draggable={false}
        />
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0" />
      </div>
    </div>
  );
}

// ----- drawing + data helpers -----

function drawFrame(buffer: BoardBuffer<RawBalanceBoardEvent> | undefined, canvas: HTMLCanvasElement | null) {
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Clear
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);

  if (!buffer || buffer.len === 0) return;

  // Collect last 1s of samples (chronological order)
  const points = getLastSeconds(buffer, TRAIL_SECONDS);
  if (points.length === 0) return;

  // Map to pixels
  const mapped = points.map((p) => ({
    x: mapX(p.x, w),
    y: mapY(p.y, h),
    t: p.t,
  }));

  // Trail (older → newer). Optional alpha fade by age.
  const tMin = mapped[0].t;
  const tMax = mapped[mapped.length - 1].t;
  const tSpan = Math.max(0.0001, tMax - tMin);

  ctx.save();
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.moveTo(mapped[0].x, mapped[0].y);
  for (let i = 1; i < mapped.length; i++) {
    ctx.lineTo(mapped[i].x, mapped[i].y);
  }
  ctx.strokeStyle = DOT_COLOR;
  ctx.globalAlpha = 0.9;
  ctx.stroke();
  ctx.restore();

  // Last point (blue dot with white ring)
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

function getLastSeconds(buf: BoardBuffer<RawBalanceBoardEvent>, seconds: number) {
  if (!buf || buf.len === 0) return [] as { x: number; y: number; t: number }[];

  const frames = buf.frames;
  const cap = frames.length;
  const lastIdx = buf.head;
  const last = frames[lastIdx];
  if (!last) return [];

  const tEnd = last.timestamp;
  const tStart = tEnd - seconds * 1000;

  const out: { x: number; y: number; t: number }[] = [];
  // Walk backward from head until we leave the window
  let count = 0;
  for (let i = 0; i < buf.len; i++) {
    const idx = (lastIdx - i + cap) % cap;
    const f = frames[idx];
    if (!f) break;
    if (f.timestamp < tStart) break;
    out.push({
      x: f.data.copX,
      y: f.data.copY,
      t: f.timestamp / 1000,
    });
    count++;
  }
  // Result is newest→oldest; reverse to chronological
  out.reverse();
  return out;
}

function mapX(v: number, width: number) {
  const ratio = (v - COP_X_MIN) / (COP_X_MAX - COP_Y_MIN); // 0..1
  return clamp(ratio, 0, 1) * width;
}

function mapY(v: number, height: number) {
  // Invert so positive CoP-Y (front) is visually "up"
  const ratio = (v - COP_Y_MIN) / (COP_Y_MAX - COP_Y_MIN); // 0..1 bottom→top
  return (1 - clamp(ratio, 0, 1)) * height;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
