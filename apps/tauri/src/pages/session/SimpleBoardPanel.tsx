import { UPlot } from "./UPlot.tsx";
import { BalanceBoardWithCoPOverlay } from "@/pages/session/BalanceBoardWithCoPOverlay.tsx";
import { convertNumberToMacAddress } from "@/utils/macAddress.ts";
import { SessionStore } from "@/store/sessionDataStore.tsx";
import wbbTopdown from "@/assets/wbb-topdown.svg";
import ToolkitContainer from "@/components/ToolkitContainer.tsx";

export function SimpleBoardPanel({
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
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold">{boardName}</h3>
        <p>{convertNumberToMacAddress(macAddress)}</p>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-3 gap-1 text-xs">
        <div className="col-span-2 row-span-1 overflow-hidden rounded bg-gray-100 p-2">
          <BalanceBoardWithCoPOverlay macAddress={macAddress} src={wbbTopdown} store={store} />
        </div>

        <div className="bg-gray-100 p-2">
          <UPlot title="copX" kind="copX" macAddress={macAddress} store={store} />
        </div>
        <div className="bg-gray-100 p-2">
          <UPlot title="copY" kind="copY" macAddress={macAddress} store={store} />
        </div>
        <div className="bg-gray-100 p-2">
          <UPlot title="vCopX" kind="vCopX" macAddress={macAddress} store={store} />
        </div>
        <div className="bg-gray-100 p-2">
          <UPlot title="vCopY" kind="vCopY" macAddress={macAddress} store={store} />
        </div>
      </div>
    </ToolkitContainer>
  );
}

export default SimpleBoardPanel;
