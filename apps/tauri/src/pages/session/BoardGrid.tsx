import { SelectedBoard } from "@/types.ts";
import ComplexBoardPanel from "@/pages/session/ComplexBoardPanel.tsx";
import { SessionStore } from "@/store/sessionDataStore.tsx";
import { BoardRows } from "@/pages/session/BoardRows.tsx";
import { ToolkitButton } from "@/components/ToolkitButton.tsx";
import { devicesIcon } from "@/assets/icons";

export function BoardGrid({
  selectedBoards,
  displayBoards,
  store,
}: {
  selectedBoards: SelectedBoard[];
  displayBoards: SelectedBoard[];
  store: SessionStore;
}) {
  const single = displayBoards.length === 1 ? displayBoards[0] : undefined;
  return (
    <div className={"min-h-105 flex-1"}>
      {selectedBoards.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center py-12 text-center text-gray-500">
          <p className="text-3xl font-medium">No boards in session</p>
          <p className="mb-4 text-xl text-gray-400">Connect to a board in the Devices page!</p>
          <ToolkitButton to="/devices" color="blue" iconUrl={devicesIcon}>
            Devices →
          </ToolkitButton>
        </div>
      ) : displayBoards.length === 0 ? (
        <div className="flex h-full flex-1 flex-col items-center justify-center py-12 text-center text-gray-500">
          <p className="text-3xl font-medium">No boards selected</p>
          <p className="text-xl text-gray-400">Choose a board from the panel above to get started.</p>
        </div>
      ) : single ? (
        // Keyed by board: the plots inside subscribe once on mount, so switching the displayed
        // board must remount them rather than re-render them with a new macAddress.
        <ComplexBoardPanel
          key={single.macAddress}
          boardName={single.name}
          macAddress={single.macAddress}
          store={store}
        />
      ) : (
        <BoardRows boards={displayBoards} store={store} />
      )}
    </div>
  );
}

export default BoardGrid;
