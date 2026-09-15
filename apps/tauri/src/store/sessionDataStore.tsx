import { create } from "zustand";
import {
  FrontendBalanceBoardEvent,
  RawBalanceBoardEvent,
  ProcessedSessionData,
  ProcessedSingleFrameSessionData,
} from "@/types";
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
  processedSingleFrameSessionData: Record<string, ProcessedSingleFrameSessionData>;

  actions: {
    /** Apply a batch of events in a single store update, so subscribers fire once per batch. */
    pushFrames: (frames: FrontendBalanceBoardEvent[]) => void;
    clear: () => void;
  };
};

// Helper to create a new empty buffer
function createEmptyBuffer<T>(): BoardBuffer<T> {
  return { frames: Array(MAX_FRAMES), head: -1, len: 0 };
}

function updateBuffer<T>(oldBuffer: BoardBuffer<T>, frame: T): BoardBuffer<T> {
  const newHead = (oldBuffer.head + 1) % MAX_FRAMES;
  oldBuffer.frames[newHead] = frame;

  return {
    frames: oldBuffer.frames,
    head: newHead,
    len: Math.min(oldBuffer.len + 1, MAX_FRAMES),
  };
}

function createSessionDataStore() {
  return create(
    subscribeWithSelector<SessionState>((set) => {
      // Events arrive at ~100 Hz per board, but the display only changes 60 times a second.
      // Applying a whole animation frame's worth of events in one `set` means every plot
      // subscriber fires (and redraws) once per frame instead of once per event.
      const pushFrames = (frames: FrontendBalanceBoardEvent[]) => {
        if (frames.length === 0) return;

        set((state) => {
          let rawSessionData = state.rawSessionData;
          let processedSessionData = state.processedSessionData;
          let processedSingleFrameSessionData = state.processedSingleFrameSessionData;
          let rawChanged = false;
          let processedChanged = false;

          for (const f of frames) {
            if (f.event === "raw") {
              if (!rawChanged) {
                rawSessionData = { ...rawSessionData };
                rawChanged = true;
              }
              const oldBuffer = rawSessionData[f.macAddress] || createEmptyBuffer<RawBalanceBoardEvent>();
              rawSessionData[f.macAddress] = updateBuffer(oldBuffer, f);
            } else if (f.event === "processed") {
              if (!processedChanged) {
                processedSessionData = { ...processedSessionData };
                processedSingleFrameSessionData = { ...processedSingleFrameSessionData };
                processedChanged = true;
              }
              const sessionData: ProcessedSessionData = {
                timestamp: f.timestamp,
                vCopX: f.vCopX,
                vCopY: f.vCopY,
                mlsi: f.mlsi,
                apsi: f.apsi,
                vsi: f.vsi,
                dpsi: f.dpsi,
              };
              const singleFrameData: ProcessedSingleFrameSessionData = {
                confidenceEllipsePolygon: f.confidenceEllipsePolygon,
                convexHullPolygon: f.convexHullPolygon,
                stabilityIndex: f.stabilityIndex,
                amplitudeSpectrum: f.amplitudeSpectrum,
              };

              const oldSessionBuffer = processedSessionData[f.macAddress] || createEmptyBuffer<ProcessedSessionData>();
              processedSessionData[f.macAddress] = updateBuffer(oldSessionBuffer, sessionData);
              processedSingleFrameSessionData[f.macAddress] = singleFrameData;
            }
          }

          const next: Partial<SessionState> = {};
          if (rawChanged) next.rawSessionData = rawSessionData;
          if (processedChanged) {
            next.processedSessionData = processedSessionData;
            next.processedSingleFrameSessionData = processedSingleFrameSessionData;
          }
          return next;
        });
      };

      return {
        rawSessionData: {},
        processedSessionData: {},
        processedSingleFrameSessionData: {},

        actions: {
          pushFrames,
          clear: () => set({ rawSessionData: {}, processedSessionData: {}, processedSingleFrameSessionData: {} }),
        },
      };
    }),
  );
}

export const useSessionDataStore = createSessionDataStore();
export const useReplayDataStore = createSessionDataStore();

// Selectors
export const getSessionActions = () => useSessionDataStore.getState().actions;
export const getReplayActions = () => useReplayDataStore.getState().actions;

export type SessionStore = ReturnType<typeof createSessionDataStore>;
