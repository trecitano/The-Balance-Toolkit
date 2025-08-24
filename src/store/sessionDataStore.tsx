import { create } from "zustand";
import { RawBalanceBoardEvent, ProcessedBoardEvent, ProcessedPolygonData, ProcessedSessionData } from "@/types";
import { subscribeWithSelector } from "zustand/middleware";

const MAX_FRAMES = 2_000;

export type BoardBuffer<T> = {
  frames: (T | undefined)[];
  head: number;
  len: number;
};

export type SessionState = {
  rawSessionData: Record<string, BoardBuffer<RawBalanceBoardEvent>>;
  processedSessionData: Record<string, BoardBuffer<ProcessedSessionData>>;
  processedSessionPolygonData: Record<string, ProcessedPolygonData>;

  actions: {
    pushRawFrame: (f: RawBalanceBoardEvent) => void;
    pushProcessedFrame: (f: ProcessedBoardEvent) => void;
    clear: () => void;
  };
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

function createSessionDataStore() {
return create(
  subscribeWithSelector<SessionState>((set) => ({
    rawSessionData: {},
    processedSessionData: {},
    processedSessionPolygonData: {},

    actions: {
      pushRawFrame: (f) =>
        set((state) => {
          const oldBuffer = state.rawSessionData[f.macAddress] || createEmptyBuffer<RawBalanceBoardEvent>();
          const newBuffer = updateBuffer(oldBuffer, f);

          return {
            rawSessionData: {
              ...state.rawSessionData,
              [f.macAddress]: newBuffer, // ✅ new object reference
            },
          };
        }),

      pushProcessedFrame: (f) =>
        set((state) => {
          const sessionData: ProcessedSessionData = { timestamp: f.timestamp, vCopX: f.vCopX, vCopY: f.vCopY };
          const polygonData: ProcessedPolygonData = {
            confidenceEllipsePolygon: f.confidenceEllipsePolygon,
            convexHullPolygon: f.convexHullPolygon,
          };

          const oldSessionBuffer =
            state.processedSessionData[f.macAddress] || createEmptyBuffer<ProcessedSessionData>();
          const newSessionBuffer = updateBuffer(oldSessionBuffer, sessionData);

          return {
            processedSessionData: {
              ...state.processedSessionData,
              [f.macAddress]: newSessionBuffer, // ✅ new object reference
            },
            processedSessionPolygonData: {
              ...state.processedSessionPolygonData,
              [f.macAddress]: polygonData,
            },
          };
        }),

      clear: () => set({ rawSessionData: {}, processedSessionData: {}, processedSessionPolygonData: {} }),
    },
  })),
);
}

export const useSessionDataStore = createSessionDataStore();
export const useReplayDataStore = createSessionDataStore();

// Selectors
export const useSessionActions = () =>
  useSessionDataStore.getState().actions;
export const useReplayActions = () =>
  useReplayDataStore.getState().actions;