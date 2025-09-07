import { SelectedBoard } from "@/types.ts";
import ComplexBoardPanel from "@/pages/session/ComplexBoardPanel.tsx";
import { SessionStore } from "@/store/sessionDataStore.tsx";
import SimpleBoardPanel from "@/pages/session/SimpleBoardPanel.tsx";

export function BoardGrid({ boards, store }: { boards: SelectedBoard[]; store: SessionStore }) {
  return boards.length === 0 ? (
    <div className="flex h-full flex-1 flex-col items-center justify-center py-12 text-center text-gray-500">
      <p className="text-3xl font-medium">No boards selected</p>
      <p className="text-xl text-gray-400">Choose a board from the panel above to get started.</p>
    </div>
  ) : boards.length === 1 ? (
    <ComplexBoardPanel boardName={boards[0].name} macAddress={boards[0].macAddress} store={store} />
  ) : (
    <div
      className="grid gap-4"
      style={{
        gridTemplateColumns: `repeat(${boards.length}, minmax(0, 1fr))`,
      }}
    >
      {boards.map((board) => (
        <SimpleBoardPanel key={board.macAddress} boardName={board.name} macAddress={board.macAddress} store={store} />
      ))}
    </div>
  );
}

export default BoardGrid;
