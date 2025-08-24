import { copXPlotSettings, copYPlotSettings, UPlot, vCopXPlotSettings, vCopYPlotSettings } from "./UPlot.tsx";
import wbbTopdown from "@/assets/wbb-topdown.svg";
import { BalanceBoardWithCoPOverlay } from "@/pages/session/BalanceBoardWithCoPOverlay.tsx";
import { useState } from "react";
import { convertNumberToMacAddress } from "@/pages/devices/Devices.tsx";
import { StoreApi } from "zustand";
import { SessionState } from "@/store/sessionDataStore.tsx";

export function BoardPanel({
  boardName,
  macAddress,
  store,
}: {
  boardName: string;
  macAddress: number;
  store: StoreApi<SessionState>;
}) {
  const [showConfidenceEllipse, setShowConfidenceEllipse] = useState(true);
  const [showConvexHull, setShowConvexHull] = useState(true);

  return (
    <section className="rounded-lg bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold">{boardName}</h3>
        <p>{convertNumberToMacAddress(macAddress)}</p>
      </div>

      <div className="grid grid-cols-12 gap-3">
        {/* Top row: Board drawing (SVG) left, metrics right */}
        <div className="col-span-6 rounded bg-gray-100 p-2">
          <BalanceBoardWithCoPOverlay
            macAddress={macAddress}
            src={wbbTopdown}
            showConfidenceEllipse={showConfidenceEllipse}
            showConvexHull={showConvexHull}
            store={store}
          />
        </div>

        <div className="col-span-6 rounded bg-gray-100 p-2">
          <div className="flex flex-col gap-3">
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
          </div>
        </div>

        {/* Middle row: blue CoP-related charts */}
        <div className="col-span-6 rounded bg-gray-100 p-2">
          <UPlot {...copYPlotSettings(macAddress)} store={store} />
        </div>
        <div className="col-span-6 rounded bg-gray-100 p-2">
          <UPlot {...copXPlotSettings(macAddress)} store={store} />
        </div>

        {/* Bottom row: red velocity charts */}
        <div className="col-span-6 rounded bg-gray-100 p-2">
          <UPlot {...vCopYPlotSettings(macAddress)} store={store} />
        </div>
        <div className="col-span-6 rounded bg-gray-100 p-2">
          <UPlot {...vCopXPlotSettings(macAddress)} store={store} />
        </div>
      </div>
    </section>
  );
}

export default BoardPanel;
