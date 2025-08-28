import { copXPlotSettings, copYPlotSettings, makeDataMapper, RED_COLOUR, standardPlot, UPlot } from "./UPlot.tsx";
import wbbTopdown from "@/assets/wbb-topdown.svg";
import { BalanceBoardWithCoPOverlay } from "@/pages/session/BalanceBoardWithCoPOverlay.tsx";
import { useState } from "react";
import { convertNumberToMacAddress } from "@/pages/devices/Devices.tsx";
import { StoreApi } from "zustand";
import { SessionState } from "@/store/sessionDataStore.tsx";
import { ProcessedSessionData } from "@/types.ts";

export function ComplexBoardPanel({
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
    <section className="flex-1 rounded-lg bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold">{boardName}</h3>
        <p>{convertNumberToMacAddress(macAddress)}</p>
      </div>

      <div className="grid grid-cols-10 grid-rows-2 gap-3">
        {/* Top row: Board drawing (SVG) left, metrics right */}
        <div className="col-span-3 flex rounded bg-gray-100 p-2">
          <BalanceBoardWithCoPOverlay
            className="h-[100px] w-7/10"
            macAddress={macAddress}
            src={wbbTopdown}
            showConfidenceEllipse={showConfidenceEllipse}
            showConvexHull={showConvexHull}
            store={store}
          />

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
        <div className="col-span-2 rounded bg-gray-100 p-2">
          <UPlot title="copX" {...copXPlotSettings(macAddress)} store={store} />
        </div>
        <div className="col-span-2 rounded bg-gray-100 p-2">
          <UPlot title="copY" {...copYPlotSettings(macAddress)} store={store} />
        </div>

        <div className="col-span-3 flex rounded bg-gray-100 p-2">
          <BalanceBoardWithCoPOverlay
            className="h-[100px] w-7/10"
            macAddress={macAddress}
            src={wbbTopdown}
            showConfidenceEllipse={showConfidenceEllipse}
            showConvexHull={showConvexHull}
            store={store}
          />

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

        <div className="col-span-2 rounded bg-gray-100 p-2">
          <UPlot
            title="vCopX"
            uPlotOptions={standardPlot(RED_COLOUR)}
            dataSelector={(state: SessionState) => state.processedSessionData[macAddress]}
            dataMapper={makeDataMapper<ProcessedSessionData>((d) => d.vCopX)}
            store={store}
          />
        </div>
        <div className="col-span-2 rounded bg-gray-100 p-2">
          <UPlot
            title="vCopY"
            uPlotOptions={standardPlot(RED_COLOUR)}
            dataSelector={(state: SessionState) => state.processedSessionData[macAddress]}
            dataMapper={makeDataMapper<ProcessedSessionData>((d) => d.vCopY)}
            store={store}
          />
        </div>
        <div className="col-span-2 rounded bg-gray-100 p-2">
          <UPlot
            title="Total Power"
            uPlotOptions={standardPlot(RED_COLOUR)}
            dataSelector={(state: SessionState) => state.processedSessionData[macAddress]}
            dataMapper={makeDataMapper<ProcessedSessionData>((d) => d.totalPower)}
            store={store}
          />
        </div>

        <div className="col-span-2 rounded bg-gray-100 p-2">
          <UPlot
            title="Center Of Spectrum"
            uPlotOptions={standardPlot(RED_COLOUR)}
            dataSelector={(state: SessionState) => state.processedSessionData[macAddress]}
            dataMapper={makeDataMapper<ProcessedSessionData>((d) => d.centerOfSpectrum)}
            store={store}
          />
        </div>
        <div className="col-span-2 rounded bg-gray-100 p-2">
          <UPlot
            title="Mean Power Frequency"
            uPlotOptions={standardPlot(RED_COLOUR)}
            dataSelector={(state: SessionState) => state.processedSessionData[macAddress]}
            dataMapper={makeDataMapper<ProcessedSessionData>((d) => d.meanPowerFrequency)}
            store={store}
          />
        </div>
      </div>
    </section>
  );
}

export default ComplexBoardPanel;
