import { create } from "zustand";
import { BalanceBoardEvent } from "../types";

const MAX_FRAMES = 10_000;

export type BoardBuffer = {
  frames: (BalanceBoardEvent | undefined)[];
  head: number;
  len: number;
};

type LiveState = {
  playing: boolean;
  windowMs: number;
  boards: Record<string, BoardBuffer>;

  pushFrame: (f: BalanceBoardEvent) => void;
  pushFramesBatch: (fs: BalanceBoardEvent[]) => void;
  clear: () => void;
};

// Internal helper
function ensureBuffer(boards: Record<string, BoardBuffer>, boardId: string): BoardBuffer {
  let b = boards[boardId];
  if (!b) {
    b = { frames: Array(MAX_FRAMES), head: -1, len: 0 };
    boards[boardId] = b;
  }
  return b;
}

export const useLiveStore = create<LiveState>((set) => ({
  playing: false,
  windowMs: 30_000,
  boards: {},

  pushFrame: (f) =>
    set((s) => {
      const boards = { ...s.boards };
      const b = ensureBuffer(boards, f.boardId);
      b.head = (b.head + 1) % MAX_FRAMES;
      b.frames[b.head] = f;
      b.len = Math.min(b.len + 1, MAX_FRAMES);
      return { boards };
    }),

  pushFramesBatch: (fs) =>
    set((s) => {
      const boards = { ...s.boards };
      for (const f of fs) {
        const b = ensureBuffer(boards, f.boardId);
        b.head = (b.head + 1) % MAX_FRAMES;
        b.frames[b.head] = f;
        b.len = Math.min(b.len + 1, MAX_FRAMES);
      }
      return { boards };
    }),

  clear: () => set({ boards: {} }),
}));

// Stable selectors

export const useBoardBuffer = (boardId: string) => useLiveStore((s) => s.boards[boardId]); // stable reference until that board updates

export const useWindowMs = () => useLiveStore((s) => s.windowMs);

export const useBoardLatest = (boardId: string) =>
  useLiveStore((s) => {
    const b = s.boards[boardId];
    if (!b || b.len === 0) return null;
    return b.frames[b.head] ?? null;
  });
