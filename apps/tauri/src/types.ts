// Types shared with the Rust backend come from the generated bindings; this module re-exports
// the ones the UI uses under their generated names and adds the handful of UI-only shapes.
import type { AmplitudeSpectrum, FrontendBalanceBoardEvent, InterpolationSetting } from "@/bindings";

export type {
  Activity,
  AmplitudeSpectrum,
  CalibrationPosition,
  CapturedCalibrationReading,
  FrontendBalanceBoardEvent,
  FrontendCalibrationReading,
  GeneralSettings,
  InterpolationSetting,
  LastSessionInformation,
  NintendoDevice,
  OngoingSessionActivityState,
  ProcessingSettings,
  ReplayInformation,
  SelectedBoard,
  SessionActivityState,
  SessionInformation,
  SessionSettings,
  SessionStats,
  TimelineBlock,
  User,
  UserPageInformation,
} from "@/bindings";

export type RawBalanceBoardEvent = Extract<FrontendBalanceBoardEvent, { event: "raw" }>;
export type ProcessedBoardEvent = Extract<FrontendBalanceBoardEvent, { event: "processed" }>;

export const interpolationOptions = [
  "Linear",
  "Cubic",
  "Polynomial",
] as const satisfies readonly InterpolationSetting[];

// Per-frame shapes kept by the session store, derived from `ProcessedBoardEvent`.
export type ProcessedSessionData = {
  timestamp: number;
  vCopX: number | null;
  vCopY: number | null;
  mlsi: number | null;
  apsi: number | null;
  vsi: number | null;
  dpsi: number | null;
};

export type ProcessedSingleFrameSessionData = {
  confidenceEllipsePolygon: [number, number][] | null;
  convexHullPolygon: [number, number][] | null;
  stabilityIndex: number | null;
  amplitudeSpectrum: AmplitudeSpectrum | null;
};
