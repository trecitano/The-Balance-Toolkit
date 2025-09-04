import { copXPlotSettings, copYPlotSettings, makeDataMapper, RED_COLOUR, standardPlot, UPlot } from "./UPlot.tsx";
import { BalanceBoardWithCoPOverlay } from "@/pages/session/BalanceBoardWithCoPOverlay.tsx";
import { useState } from "react";
import { convertNumberToMacAddress } from "@/pages/devices/Devices.tsx";
import { StoreApi } from "zustand";
import { SessionState } from "@/store/sessionDataStore.tsx";
import { ProcessedSessionData } from "@/types.ts";
import wbbTopdown from "@/assets/wbb-topdown.svg";
import ToolkitContainer from "@/components/ToolkitContainer.tsx";
import { PSDPlot } from "@/pages/session/PSDPlot.tsx";

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
    <ToolkitContainer>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold">{boardName}</h3>
        <p>{convertNumberToMacAddress(macAddress)}</p>
      </div>

      <div className="grid grid-cols-6 gap-3">
        {/* Top row: Board drawing (SVG) left, metrics right */}
        <div className="col-span-3 flex rounded bg-gray-100 p-2">
          <BalanceBoardWithCoPOverlay
            className="h-[100px] w-7/10"
            macAddress={macAddress}
            src={wbbTopdown}
            store={store}
          />
        </div>

        <div className="col-span-3 rounded bg-gray-100 p-2">
          <PSDPlot
            title="Power Spectral Density"
            macAddress={macAddress}
            store={store}
            maxFreq={15.0} // Focus on 0-5 Hz range typical for postural sway
            logScale={true} // or true if you prefer log scale
          />
        </div>

        <div className="col-span-3 rounded bg-gray-100 p-2">
          <UPlot title="copX" {...copXPlotSettings(macAddress)} store={store} />
        </div>
        <div className="col-span-3 rounded bg-gray-100 p-2">
          <UPlot title="copY" {...copYPlotSettings(macAddress)} store={store} />
        </div>

        <div className="col-span-3 rounded bg-gray-100 p-2">
          <UPlot
            title="vCopX"
            uPlotOptions={standardPlot(RED_COLOUR)}
            dataSelector={(state: SessionState) => state.processedSessionData[macAddress]}
            dataMapper={makeDataMapper<ProcessedSessionData>((d) => d.vCopX)}
            store={store}
          />
        </div>
        <div className="col-span-3 rounded bg-gray-100 p-2">
          <UPlot
            title="vCopY"
            uPlotOptions={standardPlot(RED_COLOUR)}
            dataSelector={(state: SessionState) => state.processedSessionData[macAddress]}
            dataMapper={makeDataMapper<ProcessedSessionData>((d) => d.vCopY)}
            store={store}
          />
        </div>
      </div>
    </ToolkitContainer>
  );
}

export default BoardPanel;
