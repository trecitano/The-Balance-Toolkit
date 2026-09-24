//! The desktop wire format: every type that crosses the Tauri bridge, as the React app
//! sees it. These mirror the toolkit's API types on purpose. The core stays unaware of
//! the desktop's codegen, and the `From` impls are the contract the compiler checks when
//! either side changes.
//!
//! Presentation choices live here, not in the core: camelCase keys, millisecond
//! timestamps, and which fields are exposed at all.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use specta::Type;
use std::collections::HashMap;
use std::path::PathBuf;
use std::time::Duration;
use toolkit_core::actors::balance_board_actor::{
    BalanceBoardCalibratedReading as CoreCalibratedReading, BalanceBoardOutput,
};
use toolkit_core::actors::state::activities as core_activities;
use toolkit_core::actors::toolkit_service as core_service;
use toolkit_core::processing::data_processor as core_processing;
use toolkit_core::processing::file_writer as core_writer;
use toolkit_core::types as core;

pub type MacAddress = core::MacAddress;

fn map_all<A, B: From<A>>(items: Vec<A>) -> Vec<B> {
    items.into_iter().map(Into::into).collect()
}

// --- SETTINGS ---

#[derive(Serialize, Deserialize, Debug, Clone, Type)]
#[serde(rename_all = "camelCase")]
pub struct GeneralSettings {
    pub tcp_connection_string_raw: String,
    pub tcp_connection_string_processed: String,
    pub tcp_send_raw_data: bool,
    pub tcp_send_processed_data: bool,
    pub lsl_stream_name: String,
    pub lsl_source_id: String,
    pub lsl_send_raw_data: bool,
    pub lsl_send_processed_data: bool,
    pub store_files_default_directory: PathBuf,
    pub store_raw_session: bool,
    pub store_processed_data: bool,
    pub processing_settings: ProcessingSettings,
    pub is_demo_mode: bool,
}

impl From<core::GeneralSettings> for GeneralSettings {
    fn from(s: core::GeneralSettings) -> Self {
        GeneralSettings {
            tcp_connection_string_raw: s.tcp_connection_string_raw,
            tcp_connection_string_processed: s.tcp_connection_string_processed,
            tcp_send_raw_data: s.tcp_send_raw_data,
            tcp_send_processed_data: s.tcp_send_processed_data,
            lsl_stream_name: s.lsl_stream_name,
            lsl_source_id: s.lsl_source_id,
            lsl_send_raw_data: s.lsl_send_raw_data,
            lsl_send_processed_data: s.lsl_send_processed_data,
            store_files_default_directory: s.store_files_default_directory,
            store_raw_session: s.store_raw_session,
            store_processed_data: s.store_processed_data,
            processing_settings: s.processing_settings.into(),
            is_demo_mode: s.is_demo_mode,
        }
    }
}

impl From<GeneralSettings> for core::GeneralSettings {
    fn from(s: GeneralSettings) -> Self {
        core::GeneralSettings {
            tcp_connection_string_raw: s.tcp_connection_string_raw,
            tcp_connection_string_processed: s.tcp_connection_string_processed,
            tcp_send_raw_data: s.tcp_send_raw_data,
            tcp_send_processed_data: s.tcp_send_processed_data,
            lsl_stream_name: s.lsl_stream_name,
            lsl_source_id: s.lsl_source_id,
            lsl_send_raw_data: s.lsl_send_raw_data,
            lsl_send_processed_data: s.lsl_send_processed_data,
            store_files_default_directory: s.store_files_default_directory,
            store_raw_session: s.store_raw_session,
            store_processed_data: s.store_processed_data,
            processing_settings: s.processing_settings.into(),
            is_demo_mode: s.is_demo_mode,
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, Type)]
#[serde(rename_all = "camelCase")]
pub struct ProcessingSettings {
    pub balance_board_x_size: f32,
    pub balance_board_y_size: f32,
    pub window_size_ms: u64,
    pub window_slide_ms: u64,
    pub sampling_rate: u64,
    pub interpolation: InterpolationSetting,
    pub baseline_weight: Option<f32>,
}

impl From<core_processing::ProcessingSettings> for ProcessingSettings {
    fn from(s: core_processing::ProcessingSettings) -> Self {
        ProcessingSettings {
            balance_board_x_size: s.balance_board_x_size,
            balance_board_y_size: s.balance_board_y_size,
            window_size_ms: s.window_size_ms,
            window_slide_ms: s.window_slide_ms,
            sampling_rate: s.sampling_rate,
            interpolation: s.interpolation.into(),
            baseline_weight: s.baseline_weight,
        }
    }
}

impl From<ProcessingSettings> for core_processing::ProcessingSettings {
    fn from(s: ProcessingSettings) -> Self {
        core_processing::ProcessingSettings {
            balance_board_x_size: s.balance_board_x_size,
            balance_board_y_size: s.balance_board_y_size,
            window_size_ms: s.window_size_ms,
            window_slide_ms: s.window_slide_ms,
            sampling_rate: s.sampling_rate,
            interpolation: s.interpolation.into(),
            baseline_weight: s.baseline_weight,
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, Type)]
pub enum InterpolationSetting {
    Linear,
    Cubic,
    Polynomial,
}

impl From<core_processing::InterpolationSetting> for InterpolationSetting {
    fn from(s: core_processing::InterpolationSetting) -> Self {
        match s {
            core_processing::InterpolationSetting::Linear => InterpolationSetting::Linear,
            core_processing::InterpolationSetting::Cubic => InterpolationSetting::Cubic,
            core_processing::InterpolationSetting::Polynomial => InterpolationSetting::Polynomial,
        }
    }
}

impl From<InterpolationSetting> for core_processing::InterpolationSetting {
    fn from(s: InterpolationSetting) -> Self {
        match s {
            InterpolationSetting::Linear => core_processing::InterpolationSetting::Linear,
            InterpolationSetting::Cubic => core_processing::InterpolationSetting::Cubic,
            InterpolationSetting::Polynomial => core_processing::InterpolationSetting::Polynomial,
        }
    }
}

// --- USERS ---

#[derive(Serialize, Deserialize, Debug, Clone, Type)]
#[serde(rename_all = "camelCase")]
pub struct User {
    pub id: usize,
    pub name: String,
    pub age: Option<u8>,
    pub gender: Option<String>,
    pub height: Option<f64>,
    pub height_metric: Option<String>,
    /// Always kilograms; this is the session baseline weight.
    pub weight: Option<f32>,
    /// Display unit only (`kg` or `lb`). The frontend converts at its edge.
    pub weight_metric: Option<String>,
    pub dominant_hand: Option<String>,
    pub color: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub is_default: bool,
}

impl From<core::User> for User {
    fn from(u: core::User) -> Self {
        User {
            id: u.id,
            name: u.name,
            age: u.age,
            gender: u.gender,
            height: u.height,
            height_metric: u.height_metric,
            weight: u.weight,
            weight_metric: u.weight_metric,
            dominant_hand: u.dominant_hand,
            color: u.color,
            created_at: u.created_at,
            updated_at: u.updated_at,
            is_default: u.is_default,
        }
    }
}

impl From<User> for core::User {
    fn from(u: User) -> Self {
        core::User {
            id: u.id,
            name: u.name,
            age: u.age,
            gender: u.gender,
            height: u.height,
            height_metric: u.height_metric,
            weight: u.weight,
            weight_metric: u.weight_metric,
            dominant_hand: u.dominant_hand,
            color: u.color,
            created_at: u.created_at,
            updated_at: u.updated_at,
            is_default: u.is_default,
        }
    }
}

/// Everything the users page shows, composed by the bridge from the users list and the
/// session information so the page needs one request.
#[derive(Serialize, Debug, Clone, Type)]
#[serde(rename_all = "camelCase")]
pub struct UserPageInformation {
    pub users: Vec<User>,
    pub selected_user_id: usize,
    pub session_devices: Vec<SelectedBoard>,
}

impl UserPageInformation {
    pub fn new(users: Vec<std::sync::Arc<core::User>>, session: core::SessionInformation) -> Self {
        UserPageInformation {
            users: users
                .into_iter()
                .map(|user| user.as_ref().clone().into())
                .collect(),
            selected_user_id: session.core.selected_user,
            session_devices: map_all(session.selected_boards),
        }
    }
}

// --- DEVICES ---

#[derive(Serialize, Debug, Clone, Type)]
#[serde(rename_all = "camelCase")]
pub struct NintendoDevice {
    pub id: String,
    pub name: String,
    pub mac_address: MacAddress,
    pub is_connected: bool,
    pub last_connected: Option<DateTime<Utc>>,
}

impl From<core::NintendoDevice> for NintendoDevice {
    fn from(d: core::NintendoDevice) -> Self {
        NintendoDevice {
            id: d.id,
            name: d.name,
            mac_address: d.mac_address,
            is_connected: d.is_connected,
            last_connected: d.last_connected,
        }
    }
}

#[derive(Serialize, Debug, Clone, Type)]
#[serde(rename_all = "camelCase")]
pub struct SelectedBoard {
    pub name: String,
    pub mac_address: MacAddress,
}

impl From<core::SelectedBoard> for SelectedBoard {
    fn from(b: core::SelectedBoard) -> Self {
        SelectedBoard {
            name: b.name,
            mac_address: b.mac_address,
        }
    }
}

// --- CALIBRATION ---

/// A live sensor reading while calibrating.
#[derive(Serialize, Debug, Clone, Type)]
#[serde(rename_all = "camelCase")]
pub struct FrontendCalibrationReading {
    pub mac_address: MacAddress,
    pub timestamp: i64,
    pub top_left: f32,
    pub top_right: f32,
    pub bottom_left: f32,
    pub bottom_right: f32,
    pub total_weight: f32,
}

impl From<CoreCalibratedReading> for FrontendCalibrationReading {
    fn from(reading: CoreCalibratedReading) -> Self {
        FrontendCalibrationReading {
            mac_address: reading.mac_address,
            timestamp: reading.timestamp.timestamp_millis(),
            top_left: reading.top_left,
            top_right: reading.top_right,
            bottom_left: reading.bottom_left,
            bottom_right: reading.bottom_right,
            total_weight: reading.total_force(),
        }
    }
}

/// A reading the frontend captured at one calibration position and sends back.
#[derive(Deserialize, Debug, Clone, Type)]
#[serde(rename_all = "camelCase")]
pub struct FrontendCalibrationReadingInput {
    pub mac_address: MacAddress,
    /// Unix milliseconds, as received in `FrontendCalibrationReading`.
    pub timestamp: i64,
    pub top_left: f32,
    pub top_right: f32,
    pub bottom_left: f32,
    pub bottom_right: f32,
}

impl From<FrontendCalibrationReadingInput> for CoreCalibratedReading {
    fn from(r: FrontendCalibrationReadingInput) -> Self {
        CoreCalibratedReading {
            mac_address: r.mac_address,
            timestamp: DateTime::from_timestamp_millis(r.timestamp).unwrap_or(DateTime::UNIX_EPOCH),
            top_left: r.top_left,
            top_right: r.top_right,
            bottom_left: r.bottom_left,
            bottom_right: r.bottom_right,
        }
    }
}

#[derive(Deserialize, Debug, Clone, Type)]
pub struct CapturedCalibrationReading {
    pub position: CalibrationPosition,
    pub reading: FrontendCalibrationReadingInput,
}

impl From<CapturedCalibrationReading> for core::CapturedCalibrationReading {
    fn from(c: CapturedCalibrationReading) -> Self {
        core::CapturedCalibrationReading {
            position: c.position.into(),
            reading: c.reading.into(),
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, Hash, Type)]
#[serde(rename_all = "snake_case")]
pub enum CalibrationPosition {
    TopLeft,
    TopRight,
    BottomLeft,
    BottomRight,
    Center,
}

impl From<core_service::CalibrationPosition> for CalibrationPosition {
    fn from(p: core_service::CalibrationPosition) -> Self {
        match p {
            core_service::CalibrationPosition::TopLeft => CalibrationPosition::TopLeft,
            core_service::CalibrationPosition::TopRight => CalibrationPosition::TopRight,
            core_service::CalibrationPosition::BottomLeft => CalibrationPosition::BottomLeft,
            core_service::CalibrationPosition::BottomRight => CalibrationPosition::BottomRight,
            core_service::CalibrationPosition::Center => CalibrationPosition::Center,
        }
    }
}

impl From<CalibrationPosition> for core_service::CalibrationPosition {
    fn from(p: CalibrationPosition) -> Self {
        match p {
            CalibrationPosition::TopLeft => core_service::CalibrationPosition::TopLeft,
            CalibrationPosition::TopRight => core_service::CalibrationPosition::TopRight,
            CalibrationPosition::BottomLeft => core_service::CalibrationPosition::BottomLeft,
            CalibrationPosition::BottomRight => core_service::CalibrationPosition::BottomRight,
            CalibrationPosition::Center => core_service::CalibrationPosition::Center,
        }
    }
}

#[derive(Serialize, Debug, Clone, Type)]
pub struct BalanceBoardCalibratedReading {
    pub timestamp: DateTime<Utc>,
    pub mac_address: MacAddress,
    pub top_right: f32,
    pub bottom_right: f32,
    pub top_left: f32,
    pub bottom_left: f32,
}

impl From<CoreCalibratedReading> for BalanceBoardCalibratedReading {
    fn from(r: CoreCalibratedReading) -> Self {
        BalanceBoardCalibratedReading {
            timestamp: r.timestamp,
            mac_address: r.mac_address,
            top_right: r.top_right,
            bottom_right: r.bottom_right,
            top_left: r.top_left,
            bottom_left: r.bottom_left,
        }
    }
}

#[derive(Serialize, Debug, Clone, Type)]
pub struct CalibrationPositionData {
    pub position: CalibrationPosition,
    pub weight_kg: f64,
    pub sensor_readings: BalanceBoardCalibratedReading,
}

impl From<core_service::CalibrationPositionData> for CalibrationPositionData {
    fn from(d: core_service::CalibrationPositionData) -> Self {
        CalibrationPositionData {
            position: d.position.into(),
            weight_kg: d.weight_kg,
            sensor_readings: d.sensor_readings.into(),
        }
    }
}

#[derive(Serialize, Debug, Clone, Type)]
pub struct DeviceCalibrationData {
    pub mac_address: MacAddress,
    pub calibration_weight_kg: f64,
    pub positions: HashMap<CalibrationPosition, CalibrationPositionData>,
}

impl From<core_service::DeviceCalibrationData> for DeviceCalibrationData {
    fn from(d: core_service::DeviceCalibrationData) -> Self {
        DeviceCalibrationData {
            mac_address: d.mac_address,
            calibration_weight_kg: d.calibration_weight_kg,
            positions: d
                .positions
                .into_iter()
                .map(|(position, data)| (position.into(), data.into()))
                .collect(),
        }
    }
}

// --- ACTIVITIES ---

#[derive(Serialize, Deserialize, Debug, Clone, Type)]
#[serde(rename_all = "camelCase")]
pub struct Activity {
    pub id: String,
    pub title: String,
    pub static_image: String,
    pub timeline_blocks: Vec<TimelineBlock>,
    pub boards_required: i32,
    pub description: String,
    pub loops: i32,
}

impl From<core_activities::Activity> for Activity {
    fn from(a: core_activities::Activity) -> Self {
        Activity {
            id: a.id,
            title: a.title,
            static_image: a.static_image,
            timeline_blocks: map_all(a.timeline_blocks),
            boards_required: a.boards_required,
            description: a.description,
            loops: a.loops,
        }
    }
}

impl From<Activity> for core_activities::Activity {
    fn from(a: Activity) -> Self {
        core_activities::Activity {
            id: a.id,
            title: a.title,
            static_image: a.static_image,
            timeline_blocks: map_all(a.timeline_blocks),
            boards_required: a.boards_required,
            description: a.description,
            loops: a.loops,
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, Type)]
#[serde(rename_all = "camelCase")]
pub struct TimelineBlock {
    pub title: String,
    pub id: String,
    pub duration: i32,
}

impl From<core_activities::TimelineBlock> for TimelineBlock {
    fn from(b: core_activities::TimelineBlock) -> Self {
        TimelineBlock {
            title: b.title,
            id: b.id,
            duration: b.duration,
        }
    }
}

impl From<TimelineBlock> for core_activities::TimelineBlock {
    fn from(b: TimelineBlock) -> Self {
        core_activities::TimelineBlock {
            title: b.title,
            id: b.id,
            duration: b.duration,
        }
    }
}

#[derive(Serialize, Debug, Clone, Type)]
#[serde(rename_all = "camelCase")]
pub struct SessionActivityState {
    pub activity: Activity,
    pub ongoing_state: Option<OngoingSessionActivityState>,
}

impl From<core::SessionActivityState> for SessionActivityState {
    fn from(s: core::SessionActivityState) -> Self {
        SessionActivityState {
            activity: s.activity.into(),
            ongoing_state: s.ongoing_state.map(Into::into),
        }
    }
}

#[derive(Serialize, Debug, Clone, Type)]
#[serde(rename_all = "camelCase")]
pub struct OngoingSessionActivityState {
    pub current_block_index: i32,
    pub time_to_next_block_ms: i32,
    pub loop_number: i32,
}

impl From<core::OngoingSessionActivityState> for OngoingSessionActivityState {
    fn from(s: core::OngoingSessionActivityState) -> Self {
        OngoingSessionActivityState {
            current_block_index: s.current_block_index,
            time_to_next_block_ms: s.time_to_next_block_ms,
            loop_number: s.loop_number,
        }
    }
}

// --- SESSION & REPLAY ---

#[derive(Serialize, Debug, Clone, Type)]
#[serde(rename_all = "camelCase")]
pub struct SelectOption<T> {
    pub label: String,
    pub value: T,
}

impl From<core::UserSummary> for SelectOption<usize> {
    fn from(user: core::UserSummary) -> Self {
        SelectOption {
            label: user.name,
            value: user.id,
        }
    }
}

#[derive(Serialize, Debug, Clone, Type)]
#[serde(rename_all = "camelCase")]
pub struct SessionInformation {
    pub available_users: Vec<SelectOption<usize>>,
    pub selected_boards: Vec<SelectedBoard>,
    pub core: SessionSettings,
    pub activity: Option<Activity>,
    pub has_ongoing_session: bool,
}

impl From<core::SessionInformation> for SessionInformation {
    fn from(i: core::SessionInformation) -> Self {
        SessionInformation {
            available_users: map_all(i.available_users),
            selected_boards: map_all(i.selected_boards),
            core: i.core.into(),
            activity: i.activity.map(Into::into),
            has_ongoing_session: i.has_ongoing_session,
        }
    }
}

/// The pipeline settings a user can change for a session or replay.
#[derive(Serialize, Deserialize, Debug, Clone, Type)]
#[serde(rename_all = "camelCase")]
pub struct SessionSettings {
    pub selected_user: usize,
    pub activity_id: Option<String>,
    pub lsl_enabled: bool,
    pub tcp_enabled: bool,
    pub output_directory: PathBuf,
    pub window_size_ms: u64,
    pub window_slide_ms: u64,
    pub sampling_rate: u64,
    pub interpolation: InterpolationSetting,
}

impl From<core::SessionSettings> for SessionSettings {
    fn from(s: core::SessionSettings) -> Self {
        SessionSettings {
            selected_user: s.selected_user,
            activity_id: s.activity_id,
            lsl_enabled: s.lsl_enabled,
            tcp_enabled: s.tcp_enabled,
            output_directory: s.output_directory,
            window_size_ms: s.window_size_ms,
            window_slide_ms: s.window_slide_ms,
            sampling_rate: s.sampling_rate,
            interpolation: s.interpolation.into(),
        }
    }
}

impl From<SessionSettings> for core::SessionSettings {
    fn from(s: SessionSettings) -> Self {
        core::SessionSettings {
            selected_user: s.selected_user,
            activity_id: s.activity_id,
            lsl_enabled: s.lsl_enabled,
            tcp_enabled: s.tcp_enabled,
            output_directory: s.output_directory,
            window_size_ms: s.window_size_ms,
            window_slide_ms: s.window_slide_ms,
            sampling_rate: s.sampling_rate,
            interpolation: s.interpolation.into(),
        }
    }
}

#[derive(Serialize, Debug, Clone, Type)]
#[serde(rename_all = "camelCase")]
pub struct ReplayInformation {
    pub user: User,
    pub core: SessionSettings,
    pub devices: Vec<SelectedBoard>,
    pub activity: Option<Activity>,
    pub file_path: PathBuf,
    pub has_ongoing_session: bool,
}

impl From<core::ReplayInformation> for ReplayInformation {
    fn from(c: core::ReplayInformation) -> Self {
        ReplayInformation {
            user: c.user.into(),
            core: c.core.into(),
            devices: map_all(c.devices),
            activity: c.activity.map(Into::into),
            file_path: c.file_path,
            has_ongoing_session: c.has_ongoing_session,
        }
    }
}

#[derive(Serialize, Debug, Clone, Type)]
#[serde(rename_all = "camelCase")]
pub struct LastSessionInformation {
    pub user: User,
    pub session_stats: SessionStats,
    pub file_location: String,
    pub activity: Option<Activity>,
}

impl From<core::LastSessionInformation> for LastSessionInformation {
    fn from(i: core::LastSessionInformation) -> Self {
        LastSessionInformation {
            user: i.user.into(),
            session_stats: i.session_stats.into(),
            file_location: i.file_location,
            activity: i.activity.map(Into::into),
        }
    }
}

#[derive(Serialize, Debug, Clone, Type)]
#[serde(rename_all = "camelCase")]
pub struct SessionStats {
    pub board_sampling_rate: f64,
    pub duration: Duration,
}

impl From<core_writer::SessionStats> for SessionStats {
    fn from(s: core_writer::SessionStats) -> Self {
        SessionStats {
            board_sampling_rate: s.board_sampling_rate,
            duration: s.duration,
        }
    }
}

// --- LIVE SESSION DATA (Tauri channel payloads) ---

#[derive(Serialize, Debug, Clone, Type)]
#[serde(tag = "event", rename_all = "camelCase")]
pub enum FrontendBalanceBoardEvent {
    Raw(FrontendRawReadingData),
    Processed(FrontendProcessedReadingData),
}

#[derive(Serialize, Debug, Clone, Type)]
#[serde(rename_all = "camelCase")]
pub struct FrontendRawReadingData {
    pub mac_address: MacAddress,
    pub timestamp: i64,
    pub weight: f32,
    pub cop_x: f32,
    pub cop_y: f32,
}

#[derive(Serialize, Debug, Clone, Type)]
#[serde(rename_all = "camelCase")]
pub struct FrontendProcessedReadingData {
    pub mac_address: MacAddress,
    pub timestamp: i64,
    pub v_cop_x: Option<f32>,
    pub v_cop_y: Option<f32>,
    pub confidence_ellipse_polygon: Option<Vec<(f32, f32)>>,
    pub convex_hull_polygon: Option<Vec<(f32, f32)>>,
    pub amplitude_spectrum: Option<AmplitudeSpectrum>,
    pub stability_index: Option<f32>,
    pub mlsi: Option<f32>,
    pub apsi: Option<f32>,
    pub vsi: Option<f32>,
    pub dpsi: Option<f32>,
}

#[derive(Serialize, Debug, Clone, Type)]
pub struct AmplitudeSpectrum {
    pub freqs_hz: Vec<f32>,
    pub amplitude_x: Vec<f32>,
    pub amplitude_y: Vec<f32>,
    pub amplitude_xy: Vec<f32>,
}

impl From<core_processing::AmplitudeSpectrum> for AmplitudeSpectrum {
    fn from(s: core_processing::AmplitudeSpectrum) -> Self {
        AmplitudeSpectrum {
            freqs_hz: s.freqs_hz,
            amplitude_x: s.amplitude_x,
            amplitude_y: s.amplitude_y,
            amplitude_xy: s.amplitude_xy,
        }
    }
}

impl From<BalanceBoardOutput> for FrontendBalanceBoardEvent {
    fn from(output: BalanceBoardOutput) -> Self {
        match output {
            BalanceBoardOutput::Raw(data) => {
                let cop = data.calculate_cop();
                FrontendBalanceBoardEvent::Raw(FrontendRawReadingData {
                    mac_address: data.mac_address,
                    timestamp: data.timestamp.timestamp_millis(),
                    weight: data.total_force(),
                    cop_x: cop.x,
                    cop_y: cop.y,
                })
            }
            BalanceBoardOutput::Processed(data) => {
                FrontendBalanceBoardEvent::Processed(FrontendProcessedReadingData {
                    mac_address: data.mac_address,
                    timestamp: data.timestamp.timestamp_millis(),
                    v_cop_x: data.sway_metrics.as_ref().map(|m| m.v_cop_x),
                    v_cop_y: data.sway_metrics.as_ref().map(|m| m.v_cop_y),
                    confidence_ellipse_polygon: data
                        .area_metrics
                        .as_ref()
                        .map(|m| m.confidence_ellipse_polygon.clone()),
                    convex_hull_polygon: data
                        .area_metrics
                        .as_ref()
                        .map(|m| m.convex_hull_polygon.clone()),
                    amplitude_spectrum: data.amplitude_spectrum.clone().map(Into::into),
                    stability_index: data.stability_index,
                    mlsi: data.dpsi_metrics.as_ref().map(|m| m.mlsi),
                    apsi: data.dpsi_metrics.as_ref().map(|m| m.apsi),
                    vsi: data.dpsi_metrics.as_ref().map(|m| m.vsi),
                    dpsi: data.dpsi_metrics.as_ref().map(|m| m.dpsi),
                })
            }
        }
    }
}
