import { create } from "zustand";
import { RawBalanceBoardEvent, ProcessedBoardEvent } from "@/types";
import {subscribeWithSelector} from "zustand/middleware";

const MAX_FRAMES = 10_000;

export type BoardBuffer<T> = {
  frames: (T | undefined)[];
  head: number;
  len: number;
}

export type SessionState = {
  windowMs: number;
  rawSessionData: Record<string, BoardBuffer<RawBalanceBoardEvent>>;
  processedSessionData: Record<string, BoardBuffer<ProcessedBoardEvent>>;

  actions: {
    pushRawFrame: (f: RawBalanceBoardEvent) => void;
    pushProcessedFrame: (f: ProcessedBoardEvent) => void;
    clear: () => void;
  }
};

// Helper to create a new empty buffer
function createEmptyBuffer<T>(): BoardBuffer<T> {
  return { frames: Array(MAX_FRAMES), head: -1, len: 0 };
}

// Helper to immutably update a buffer
function updateBuffer<T>(oldBuffer: BoardBuffer<T>, frame: T): BoardBuffer<T> {
  const newFrames = oldBuffer.frames.slice();
  const newHead = (oldBuffer.head + 1) % MAX_FRAMES;
  newFrames[newHead] = frame;

  return {
    frames: newFrames,
    head: newHead,
    len: Math.min(oldBuffer.len + 1, MAX_FRAMES),
  };
}

export const useSessionDataStore = create(
  subscribeWithSelector<SessionState>((set) => ({
    windowMs: 10_000,
    rawSessionData: {},
    processedSessionData: {},

    actions: {
      pushRawFrame: (f) =>
        set((state) => {
          const oldBuffer = state.rawSessionData[f.boardId] || createEmptyBuffer<RawBalanceBoardEvent>();
          const newBuffer = updateBuffer(oldBuffer, f);

          return {
            rawSessionData: {
              ...state.rawSessionData,
              [f.boardId]: newBuffer, // ✅ new object reference
            },
          };
        }),

      pushProcessedFrame: (f) =>
        set((state) => {
          const oldBuffer = state.processedSessionData[f.boardId] || createEmptyBuffer<ProcessedBoardEvent>();
          const newBuffer = updateBuffer(oldBuffer, f);

          return {
            processedSessionData: {
              ...state.processedSessionData,
              [f.boardId]: newBuffer, // ✅ new object reference
            },
          };
        }),

      clear: () => set({ rawSessionData: {}, processedSessionData: {} }),
    },
  })
));

// Selectors
export const useSessionActions = () => useSessionDataStore((s) => s.actions);

export const useSessionRawDataBuffer = (boardId: string) =>
  useSessionDataStore((s) => s.rawSessionData[boardId]);

export const useSessionProcessedDataBuffer = (boardId: string) =>
  useSessionDataStore((s) => s.processedSessionData[boardId]);

export const useWindowMs = () => useSessionDataStore((s) => s.windowMs);