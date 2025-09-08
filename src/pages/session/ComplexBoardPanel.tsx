import {
  BLUE_COLOUR,
  copXPlotSettings,
  copYPlotSettings,
  makeDataMapper,
  RED_COLOUR,
  standardPlot,
  UPlot,
} from "./UPlot.tsx";
import wbbTopdown from "@/assets/wbb-topdown.svg";
import { BalanceBoardWithCoPOverlay } from "@/pages/session/BalanceBoardWithCoPOverlay.tsx";
import { convertNumberToMacAddress } from "@/pages/devices/Devices.tsx";
import { SessionState, SessionStore } from "@/store/sessionDataStore.tsx";
import { ProcessedSessionData } from "@/types.ts";
import ToolkitContainer from "@/components/ToolkitContainer.tsx";
import { MultiMetricPlot } from "@/pages/session/MultiMetricDsiPlot.tsx";
import { FFTAmplitudePlot } from "@/pages/session/FFTAmplitudePlot.tsx";

export function ComplexBoardPanel({
  boardName,
  macAddress,
  store,
}: {
  boardName: string;
  macAddress: number;
  store: SessionStore;
}) {
  return (
    <ToolkitContainer className={"flex flex-auto flex-col gap-3"}>
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
          <UPlot title="copX" tooltipId={"session_cop_x"} {...copXPlotSettings(macAddress)} store={store} />
        </div>
        <div className="col-span-3 rounded bg-gray-100 p-2">
          <UPlot title="copY" tooltipId={"session_cop_y"} {...copYPlotSettings(macAddress)} store={store} />
        </div>

        <div className="col-span-3 rounded bg-gray-100 p-2">
          <FFTAmplitudePlot
            title="FFT Amplitude Spectrum (Normalized)"
            tooltipId={"session_amplitude_spectrum"}
            macAddress={macAddress}
            store={store}
          />
        </div>

        {/* Combined DPSI metrics plot - spans 4 columns */}
        <div className="col-span-3 rounded bg-gray-100 p-2">
          <MultiMetricPlot title="DPSI Metrics" tooltipText={"TODO"} macAddress={macAddress} store={store} />
        </div>

        <div className="col-span-3 rounded bg-gray-100 p-2">
          <UPlot
            title="vCopX"
            tooltipId={"session_mean_velocity_x"}
            uPlotOptions={standardPlot(BLUE_COLOUR)}
            dataSelector={(state: SessionState) => state.processedSessionData[macAddress]}
            dataMapper={makeDataMapper<ProcessedSessionData>((d) => d.vCopX)}
            store={store}
          />
        </div>

        <div className="col-span-3 rounded bg-gray-100 p-2">
          <UPlot
            title="vCopY"
            tooltipId={"session_mean_velocity_y"}
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

export default ComplexBoardPanel;
