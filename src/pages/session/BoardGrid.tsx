import { SelectedBoard } from "@/types.ts";
import BoardPanel from "@/pages/session/BoardPanel.tsx";
import { StoreApi } from "zustand";
import { SessionState } from "@/store/sessionDataStore.tsx";

export function BoardGrid({ boards, store }: { boards: SelectedBoard[]; store: StoreApi<SessionState> }) {
  return boards.length === 0 ? (
    <div className="flex h-full flex-col items-center justify-center py-12 text-center text-gray-500">
      <p className="text-3xl font-medium">No boards selected</p>
      <p className="text-xl text-gray-400">Choose a board from the panel above to get started.</p>
    </div>
  ) : boards.length === 1 ? (
    <div className="mt-5 flex justify-center">
      <BoardPanel boardName={boards[0].name} macAddress={boards[0].macAddress} store={store} />
    </div>
  ) : (
    <div
      className="grid gap-4"
      style={{
        gridTemplateColumns: `repeat(${boards.length}, minmax(0, 1fr))`,
      }}
    >
      {boards.map((board) => (
        <BoardPanel key={board.macAddress} boardName={board.name} macAddress={board.macAddress} store={store} />
      ))}
    </div>
  );
}

export default BoardGrid;
