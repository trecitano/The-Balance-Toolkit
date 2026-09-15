// Types shared with the Rust backend come from the generated bindings; this module keeps
// the names the UI has always used and the handful of shapes that only exist in the UI.
import type {
  Activity,
  AmplitudeSpectrum,
  CalibrationPosition,
  FrontendBalanceBoardEvent,
  FrontendCalibrationReading,
  CapturedCalibrationReading,
  SessionSettings,
  LastSessionInformation,
  ReplayInformation,
  SessionInformation,
  GeneralSettings,
  InterpolationSetting,
  NintendoDevice,
  OngoingSessionActivityState,
  ProcessingSettings,
  SelectedBoard,
  SessionActivityState,
  SessionStats,
  TimelineBlock,
  User,
  UserPageInformation,
} from "@/bindings";

export type {
  Activity,
  AmplitudeSpectrum,
  CalibrationPosition,
  CapturedCalibrationReading,
  GeneralSettings,
  LastSessionInformation,
  SessionInformation,
  OngoingSessionActivityState,
  ProcessingSettings,
  SelectedBoard,
  SessionActivityState,
  SessionStats,
  TimelineBlock,
  UserPageInformation,
};

export type UserType = User;
export type Device = NintendoDevice;
export type SessionPanelConfiguration = SessionSettings;
export type ReplayConfiguration = ReplayInformation;
export type CalibrationReading = FrontendCalibrationReading;

export type BalanceBoardEvent = FrontendBalanceBoardEvent;
export type RawBalanceBoardEvent = Extract<FrontendBalanceBoardEvent, { event: "raw" }>;
export type ProcessedBoardEvent = Extract<FrontendBalanceBoardEvent, { event: "processed" }>;

export type InterpolationOption = InterpolationSetting;
export const interpolationOptions = ["Linear", "Cubic", "Polynomial"] as const satisfies readonly InterpolationOption[];

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
