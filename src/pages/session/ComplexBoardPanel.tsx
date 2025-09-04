import { copXPlotSettings, copYPlotSettings, makeDataMapper, RED_COLOUR, standardPlot, UPlot } from "./UPlot.tsx";
import wbbTopdown from "@/assets/wbb-topdown.svg";
import { BalanceBoardWithCoPOverlay } from "@/pages/session/BalanceBoardWithCoPOverlay.tsx";
import { useState } from "react";
import { convertNumberToMacAddress } from "@/pages/devices/Devices.tsx";
import { StoreApi } from "zustand";
import { SessionState } from "@/store/sessionDataStore.tsx";
import { ProcessedSessionData, ProcessedSingleFrameSessionData } from "@/types.ts";
import { PSDPlot } from "@/pages/session/PSDPlot.tsx";
import ToolkitContainer from "@/components/ToolkitContainer.tsx";
import { MultiMetricPlot } from "@/pages/session/MultiMetricDsiPlot.tsx";
import { StabilityBarGauge } from "@/pages/session/StabilityBarGauge.tsx";

export function ComplexBoardPanel({
  boardName,
  macAddress,
  store,
}: {
  boardName: string;
  macAddress: number;
  store: StoreApi<SessionState>;
}) {
  return (
    <ToolkitContainer className={"flex flex-1 flex-col gap-3"}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{boardName}</h3>
        <p>{convertNumberToMacAddress(macAddress)}</p>
      </div>

      <div className="grid h-full grid-cols-12 grid-rows-2 gap-3">
        <div className="col-span-6 flex gap-3 rounded bg-gray-100 p-2">
          <BalanceBoardWithCoPOverlay
            className="h-[100px] w-full p-3"
            macAddress={macAddress}
            src={wbbTopdown}
            store={store}
          />
        </div>

        <div className="col-span-3 rounded bg-gray-100 p-2">
          <UPlot title="copX" {...copXPlotSettings(macAddress)} store={store} />
        </div>
        <div className="col-span-3 rounded bg-gray-100 p-2">
          <UPlot title="copY" {...copYPlotSettings(macAddress)} store={store} />
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

        {/* Combined DPSI metrics plot - spans 4 columns */}
        <div className="col-span-3 rounded bg-gray-100 p-2">
          <MultiMetricPlot title="DPSI Metrics" macAddress={macAddress} store={store} />
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

        <div className="col-span-3 rounded bg-gray-100 p-2">
          <UPlot
            title="vCopX"
            uPlotOptions={standardPlot(RED_COLOUR)}
            dataSelector={(state: SessionState) => state.processedSessionData[macAddress]}
            dataMapper={makeDataMapper<ProcessedSessionData>((d) => d.vCopX)}
            store={store}
          />
        </div>
      </div>
    </ToolkitContainer>
  );
}

export default ComplexBoardPanel;
