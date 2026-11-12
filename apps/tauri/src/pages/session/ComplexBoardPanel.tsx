import { UPlot } from "./UPlot.tsx";
import wbbTopdown from "@/assets/wbb-topdown.svg";
import { BalanceBoardWithCoPOverlay } from "@/pages/session/BalanceBoardWithCoPOverlay.tsx";
import { BoardPanel, PlotCell } from "@/pages/session/BoardPanel.tsx";
import { SessionStore } from "@/store/sessionDataStore.tsx";
import { MultiMetricPlot } from "@/pages/session/MultiMetricDsiPlot.tsx";
import { FFTAmplitudePlot } from "@/pages/session/FFTAmplitudePlot.tsx";

/** One board on its own: the board view and every plot. */
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
    <BoardPanel name={boardName} macAddress={macAddress}>
      <div className="grid min-h-0 flex-1 grid-cols-12 grid-rows-2 gap-3 text-xs">
        <PlotCell className="col-span-6">
          <BalanceBoardWithCoPOverlay macAddress={macAddress} src={wbbTopdown} store={store} />
        </PlotCell>
        <PlotCell className="col-span-3">
          <UPlot kind="copX" macAddress={macAddress} store={store} />
        </PlotCell>
        <PlotCell className="col-span-3">
          <UPlot kind="copY" macAddress={macAddress} store={store} />
        </PlotCell>
        <PlotCell className="col-span-3">
          <FFTAmplitudePlot
            title="FFT Amplitude Spectrum"
            tooltipId="session_amplitude_spectrum"
            macAddress={macAddress}
            store={store}
          />
        </PlotCell>
        <PlotCell className="col-span-3">
          <MultiMetricPlot title="DPSI Metrics" tooltipId="session_dpsi" macAddress={macAddress} store={store} />
        </PlotCell>
        <PlotCell className="col-span-3">
          <UPlot kind="vCopX" macAddress={macAddress} store={store} />
        </PlotCell>
        <PlotCell className="col-span-3">
          <UPlot kind="vCopY" macAddress={macAddress} store={store} />
        </PlotCell>
      </div>
    </BoardPanel>
  );
}

export default ComplexBoardPanel;
