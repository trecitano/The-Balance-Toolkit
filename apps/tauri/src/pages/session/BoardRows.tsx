import wbbTopdown from "@/assets/wbb-topdown.svg";
import { BalanceBoardWithCoPOverlay } from "@/pages/session/BalanceBoardWithCoPOverlay.tsx";
import { BoardPanel, PlotCell } from "@/pages/session/BoardPanel.tsx";
import { PlotKind, UPlot } from "@/pages/session/UPlot.tsx";
import { SessionStore } from "@/store/sessionDataStore.tsx";
import { SelectedBoard } from "@/types.ts";

const PLOTS: PlotKind[] = ["copX", "copY", "vCopX", "vCopY"];

/**
 * Two boards, one row each: the board view, then its four plots across. Stacked like this, the
 * two boards' plots line up, so their timing is easy to compare.
 */
export function BoardRows({ boards, store }: { boards: SelectedBoard[]; store: SessionStore }) {
  return (
    <div className="grid h-full grid-rows-2 gap-4">
      {boards.map((board) => (
        // Keyed by board: each plot subscribes to its board once, when it mounts (see UPlot).
        <BoardPanel key={board.macAddress} name={board.name} macAddress={board.macAddress}>
          <div className="grid min-h-0 flex-1 grid-cols-[3fr_1fr_1fr_1fr_1fr] gap-3 text-xs">
            <PlotCell>
              <BalanceBoardWithCoPOverlay macAddress={board.macAddress} src={wbbTopdown} store={store} />
            </PlotCell>
            {PLOTS.map((kind) => (
              <PlotCell key={kind}>
                <UPlot kind={kind} macAddress={board.macAddress} store={store} />
              </PlotCell>
            ))}
          </div>
        </BoardPanel>
      ))}
    </div>
  );
}
