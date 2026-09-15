import { UPlot } from "./UPlot.tsx";
import wbbTopdown from "@/assets/wbb-topdown.svg";
import { BalanceBoardWithCoPOverlay } from "@/pages/session/BalanceBoardWithCoPOverlay.tsx";
import { convertNumberToMacAddress } from "@/utils/macAddress.ts";
import { SessionStore } from "@/store/sessionDataStore.tsx";
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
    <ToolkitContainer className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex gap-2 text-sm">
        <p className="font-semibold">{boardName}</p>
        <p>{convertNumberToMacAddress(macAddress)}</p>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-12 grid-rows-2 gap-3 text-xs">
        <div className="col-span-6 bg-gray-100 p-2">
          <BalanceBoardWithCoPOverlay macAddress={macAddress} src={wbbTopdown} store={store} />
        </div>

        <div className="col-span-3 bg-gray-100 p-2">
          <UPlot title="copX" tooltipId="session_cop_x" kind="copX" macAddress={macAddress} store={store} />
        </div>
        <div className="col-span-3 bg-gray-100 p-2">
          <UPlot title="copY" tooltipId="session_cop_y" kind="copY" macAddress={macAddress} store={store} />
        </div>

        <div className="col-span-3 bg-gray-100 p-2">
          <FFTAmplitudePlot
            title="FFT Amplitude Spectrum (Normalized)"
            tooltipId="session_amplitude_spectrum"
            macAddress={macAddress}
            store={store}
          />
        </div>

        <div className="col-span-3 bg-gray-100 p-2">
          <MultiMetricPlot title="DPSI Metrics" tooltipId="session_dpsi" macAddress={macAddress} store={store} />
        </div>

        <div className="col-span-3 bg-gray-100 p-2">
          <UPlot title="vCopX" tooltipId="session_mean_velocity_x" kind="vCopX" macAddress={macAddress} store={store} />
        </div>

        <div className="col-span-3 bg-gray-100 p-2">
          <UPlot title="vCopY" tooltipId="session_mean_velocity_y" kind="vCopY" macAddress={macAddress} store={store} />
        </div>
      </div>
    </ToolkitContainer>
  );
}

export default ComplexBoardPanel;
