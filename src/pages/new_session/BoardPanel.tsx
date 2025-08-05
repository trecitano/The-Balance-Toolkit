import { useMemo } from "react";
import {
  useBoardBuffer,
  useBoardLatest,
  useWindowMs,
} from "@/store/liveStore.tsx";
import { UPlotLine } from "./UPlotLine";
import { UPlotPath } from "./UPlotPath";
import { ProcessedBoardData } from "@/types.ts";
import wbbTopdown from "../../assets/wbb-topdown.svg";

function windowFramesFromBuffer(
  buf:
    | {
    frames: (ProcessedBoardData | undefined)[];
    head: number;
    len: number;
  }
    | undefined,
  windowMs: number
) {
  if (!buf || buf.len === 0) return [];
  const latest = buf.frames[buf.head]!;
  const cutoff = latest.ts - windowMs;

  const out: ProcessedBoardData[] = [];
  for (let i = 0; i < buf.len; i++) {
    const idx = (buf.head - i + buf.frames.length) % buf.frames.length;
    const f = buf.frames[idx]!;
    if (f.ts < cutoff) break;
    out.push(f);
  }
  out.reverse();
  return out;
}

export function BoardPanel({
                             boardId,
                             title,
                           }: {
  boardId: string;
  title: string;
}) {
  const buf = useBoardBuffer(boardId);
  const latest = useBoardLatest(boardId);
  const windowMs = useWindowMs();

  const windowFrames = useMemo(
    () => windowFramesFromBuffer(buf, windowMs),
    [buf, buf?.head, buf?.len, windowMs]
  );

  const vCoPxData = useMemo(() => {
    const t: number[] = [];
    const y: number[] = [];
    for (const f of windowFrames) {
      t.push(f.ts / 1000);
      y.push(f.traces.vCoPx);
    }
    return { t, y };
  }, [windowFrames]);

  const vCoPyData = useMemo(() => {
    const t: number[] = [];
    const y: number[] = [];
    for (const f of windowFrames) {
      t.push(f.ts / 1000);
      y.push(f.traces.vCoPy);
    }
    return { t, y };
  }, [windowFrames]);

  const pathData = useMemo(() => {
    const x: number[] = [];
    const y: number[] = [];
    for (const f of windowFrames) {
      x.push(f.cop.x);
      y.push(f.cop.y);
    }
    return { x, y };
  }, [windowFrames]);

  return (
    <section className="rounded-lg border bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold">{title}</h3>
      </div>

      <div className="grid grid-cols-12 gap-3">
        {/* Top row: Board drawing (SVG) left, metrics right */}
        <div className="col-span-7">
          <div className="rounded border p-2">
            <div className="flex h-[220px] items-center justify-center">
              <img
                src={wbbTopdown}
                alt="Balance Board"
                className="pointer-events-none max-h-full max-w-full select-none object-contain"
                draggable={false}
              />
            </div>
          </div>
        </div>

        <div className="col-span-5">
          <div className="rounded border p-3 space-y-3">
            <div>
              <div className="text-sm text-gray-500">Stability Index</div>
              <div className="text-2xl font-semibold">
                {latest?.metrics.stabilityIndex ?? "—"}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">User</div>
              <div className="text-base">{latest?.userId ?? "—"}</div>
            </div>
          </div>
        </div>

        {/* Middle row: blue CoP-related charts */}
        <div className="col-span-6">
          <div className="rounded border p-2">
            <UPlotPath points={pathData} height={160} />
          </div>
        </div>
        <div className="col-span-6">
          <div className="rounded border p-2">
            <UPlotPath points={pathData} height={160} />
          </div>
        </div>

        {/* Bottom row: red velocity charts */}
        <div className="col-span-6">
          <div className="rounded border p-2">
            <UPlotLine label="vCoPx" data={vCoPxData} height={150} />
          </div>
        </div>
        <div className="col-span-6">
          <div className="rounded border p-2">
            <UPlotLine label="vCoPy" data={vCoPyData} height={150} />
          </div>
        </div>
      </div>
    </section>
  );
}

export default BoardPanel;