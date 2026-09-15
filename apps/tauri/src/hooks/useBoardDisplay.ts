import { useState } from "react";
import type { SelectedBoard } from "@/types";

export function useBoardDisplay(boards: SelectedBoard[]) {
  const available = boards.map((board) => board.macAddress);
  const key = available.join(",");
  const [selection, setSelection] = useState({ key, ids: available });
  if (selection.key !== key) setSelection({ key, ids: available });
  const ids = selection.key === key ? selection.ids : available;
  return {
    boardDisplaySelected: ids,
    onBoardDisplayChange: (next: number[]) => setSelection({ key, ids: next }),
    boardDisplayOptions: boards.map((board) => ({ value: board.macAddress, label: board.name })),
    displayBoards: boards.filter((board) => ids.includes(board.macAddress)),
  };
}
