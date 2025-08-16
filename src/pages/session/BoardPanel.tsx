import {
  confidenceEllipsePolygonPlotSettings,
  convexHullPolygonPlotSettings,
  copXPlotSettings,
  copXTopDownPlotSettings,
  copYPlotSettings,
  UPlot,
  vCopXPlotSettings,
} from "./UPlot.tsx";
import wbbTopdown from "@/assets/wbb-topdown.svg";
import { BalanceBoardWithCoPOverlay } from "@/pages/session/BalanceBoardWithCoPOverlay.tsx";

export function BoardPanel({ boardName, macAddress }: { boardName: string; macAddress: string }) {
  return (
    <section className="rounded-lg border bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold">{boardName}</h3>
        <p>{macAddress}</p>
      </div>

      <div className="grid grid-cols-12 gap-3">
        {/* Top row: Board drawing (SVG) left, metrics right */}
        <div className="col-span-7">
          <div className="rounded border p-2">
            <BalanceBoardWithCoPOverlay boardId="Board One" src={wbbTopdown} />
          </div>
        </div>

        <div className="col-span-5">
          <div className="space-y-3 rounded border p-3">
            <div>
              <div className="text-sm text-gray-500">Stability Index</div>
              <div className="text-2xl font-semibold">{"—"}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">User</div>
              <div className="text-base">
                {/* If you send userId in processed events */}
                TODO User Name!
              </div>
            </div>
          </div>
        </div>

        {/* Middle row: blue CoP-related charts */}
        <div className="col-span-6">
          <div className="rounded border p-2">
            <UPlot {...copYPlotSettings(macAddress)} />
          </div>
        </div>
        <div className="col-span-6">
          <div className="rounded border p-2">
            <UPlot {...copXPlotSettings(macAddress)} />
          </div>
        </div>

        {/* Bottom row: red velocity charts */}
        <div className="col-span-6">
          <div className="rounded border p-2">
            <UPlot {...vCopXPlotSettings(macAddress)} />
          </div>
        </div>
        <div className="col-span-6">
          <div className="rounded border p-2">
            <UPlot {...vCopXPlotSettings(macAddress)} />
          </div>
        </div>

        {/*
        <div className="col-span-6">
          <div className="rounded border p-2">
            <UPlot {...confidenceEllipsePolygonPlotSettings(macAddress)} />
          </div>
        </div>

        <div className="col-span-6">
          <div className="rounded border p-2">
            <UPlot {...convexHullPolygonPlotSettings(macAddress)} />
          </div>
        </div>
        */}
      </div>
    </section>
  );
}

export default BoardPanel;
