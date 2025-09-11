import { copXPlotSettings, copYPlotSettings, makeDataMapper, RED_COLOUR, standardPlot, UPlot } from "./UPlot.tsx";
import { BalanceBoardWithCoPOverlay } from "@/pages/session/BalanceBoardWithCoPOverlay.tsx";
import { convertNumberToMacAddress } from "@/pages/devices/Devices.tsx";
import { SessionState, SessionStore } from "@/store/sessionDataStore.tsx";
import { ProcessedSessionData } from "@/types.ts";
import wbbTopdown from "@/assets/wbb-topdown.svg";
import ToolkitContainer from "@/components/ToolkitContainer.tsx";

export function BoardPanel({
  boardName,
  macAddress,
  store,
}: {
  boardName: string;
  macAddress: number;
  store: SessionStore;
}) {
  return (
    <ToolkitContainer className={"flex-1 flex flex-col"}>
      <div className="flex mb-2 items-center justify-between">
        <h3 className="font-semibold">{boardName}</h3>
        <p>{convertNumberToMacAddress(macAddress)}</p>
      </div>

      <div className="flex-1 h-full w-full grid grid-rows-3 grid-cols-2 gap-1">
        {/* Top row: Board drawing (SVG) left, metrics right */}
        <div className="h-40 rounded bg-gray-100 p-2 col-span-2 row-span-3">
          <BalanceBoardWithCoPOverlay
            className="h-[100px] w-7/10"
            macAddress={macAddress}
            src={wbbTopdown}
            store={store}
          />
        </div>


          <div className="rounded bg-gray-100 p-2">
            <UPlot title="copX" {...copXPlotSettings(macAddress)} store={store} />
          </div>
          <div className="rounded bg-gray-100 p-2">
            <UPlot title="copY" {...copYPlotSettings(macAddress)} store={store} />
          </div>

          <div className="rounded bg-gray-100 p-2">
            <UPlot
              title="vCopX"
              uPlotOptions={standardPlot(RED_COLOUR)}
              dataSelector={(state: SessionState) => state.processedSessionData[macAddress]}
              dataMapper={makeDataMapper<ProcessedSessionData>((d) => d.vCopX)}
              store={store}
            />
          </div>
          <div className="rounded bg-gray-100 p-2">
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
