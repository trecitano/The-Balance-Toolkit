use crate::actors::balance_board_actor::{
    BalanceBoardCalibratedReading, BalanceBoardOutput,
};
use anyhow::Result;
use chrono::{DateTime, TimeDelta, Utc};
use rustfft::{num_complex::Complex, FftPlanner};
use serde::{Deserialize, Serialize};
use std::f32::consts::PI;
use std::thread;
use tokio::sync::mpsc;
use tokio::sync::mpsc::Sender;

use crate::types::MacAddress;

#[derive(Debug, Clone)]
struct CenterOfPressurePoint {
    timestamp: DateTime<Utc>,
    x: f32,
    y: f32,
    z: f32,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
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

impl ProcessingSettings {
    pub fn default() -> ProcessingSettings {
        ProcessingSettings {
            balance_board_x_size: 446.0,
            balance_board_y_size: 238.0,
            window_size_ms: 5000,
            window_slide_ms: 100,
            sampling_rate: 100,
            interpolation: InterpolationSetting::Cubic,
            baseline_weight: None,
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum InterpolationSetting {
    Linear,
    Cubic,
    Polynomial,
}

#[derive(Serialize, Debug, Clone)]
pub struct ProcessedBoardData {
    pub timestamp: DateTime<Utc>,
    pub mac_address: MacAddress,
    pub sway_metrics: Option<SwayMetrics>,
    pub stability_index: Option<f32>,
    pub area_metrics: Option<AreaMetrics>,
    pub amplitude_spectrum: Option<AmplitudeSpectrum>,
    pub dpsi_metrics: Option<DpsiMetrics>,
}

impl ProcessedBoardData {
    pub fn to_byte_array(&self) -> Vec<u8> {
        let mut buf = Vec::new();

        // 1. Serialize timestamp (8 bytes)
        let timestamp_nanos = self.timestamp.timestamp_nanos_opt().unwrap_or(0);
        buf.extend_from_slice(&timestamp_nanos.to_be_bytes());

        // 2. Create flags byte indicating which fields are present
        let mut flags = 0u8;
        if self.sway_metrics.is_some() {
            flags |= 0b0001;
        }
        if self.area_metrics.is_some() {
            flags |= 0b0010;
        }

        buf.push(flags);

        // 3. Serialize optional fields based on flags
        if let Some(ref sway) = self.sway_metrics {
            buf.extend_from_slice(&sway.mean_velocity.to_be_bytes());
            buf.extend_from_slice(&sway.total_path_length.to_be_bytes());
            buf.extend_from_slice(&sway.velocity_moment.to_be_bytes());
        }

        buf
    }
}

pub fn initialize(
    observers: Vec<Sender<BalanceBoardOutput>>,
    mac_address: MacAddress,
    settings: ProcessingSettings,
) -> Sender<BalanceBoardOutput> {
    let (tx, rx) = mpsc::channel(3000);

    thread::spawn(move || {
        match data_process_loop(rx, observers, mac_address, settings) {
            Ok(_) => (),
            Err(e) => {
                println!("Error in data processing loop: {:?}", e);
            }
        }
    });

    tx
}

fn data_process_loop(
    mut rx: mpsc::Receiver<BalanceBoardOutput>,
    mut observers: Vec<Sender<BalanceBoardOutput>>,
    mac_address: MacAddress,
    settings: ProcessingSettings,
) -> Result<()> {
    println!("Data processing execution start.");
    let mut buffer: Vec<CenterOfPressurePoint> = Vec::with_capacity(200);

    let window_size = std::time::Duration::from_millis(settings.window_size_ms);
    let window_slide_size = std::time::Duration::from_millis(settings.window_slide_ms);

    let sr_hz = settings.sampling_rate as f32;
    let dt_ms = (1_000.0 / sr_hz).max(1.0).round();
    let sampling_size_time_delta = TimeDelta::milliseconds(dt_ms as i64);

    let cop_calculation_x_value = settings.balance_board_x_size / 2.0;
    let cop_calculation_y_value = settings.balance_board_y_size / 2.0;

    loop {
        while let Ok(item) = rx.try_recv() {
            match item {
                BalanceBoardOutput::Raw(data) => {
                    let cop = balance_board_reading_to_cop(
                        data,
                        cop_calculation_x_value,
                        cop_calculation_y_value,
                    );
                    buffer.push(cop);
                }
                BalanceBoardOutput::Processed(_) => {
                    panic!()
                }
            }
        }

        if rx.is_closed() {
            break;
        }

        let end_time = buffer.last().map(|p| p.timestamp).unwrap_or(Utc::now());
        let start_time = end_time - window_size;

        let idx = buffer.partition_point(|p| p.timestamp < start_time);
        buffer.drain(0..idx);

        let start_idx = buffer.partition_point(|p| p.timestamp < start_time);
        let end_idx = buffer.partition_point(|p| p.timestamp <= end_time);
        let window_slice = &buffer[start_idx..end_idx];

        let points = match settings.interpolation {
            InterpolationSetting::Linear => {
                linear_interpolation(&window_slice, start_time, end_time, &sampling_size_time_delta)
            }
            InterpolationSetting::Cubic => {
                cubic_interpolation(&window_slice, start_time, end_time, &sampling_size_time_delta)
            }
            InterpolationSetting::Polynomial => {
                polynomial_interpolation(&window_slice, start_time, end_time, &sampling_size_time_delta)
            }
        };

        let sway_calculation = calculate_basic_sway_metrics(&points);
        let stability_index = calculate_stability_index(&points);
        let area_calculation = calculate_area_metrics(&points);
        let amplitude_spectrum = compute_fft_amplitude_spectrum(&points, 2.0);
        let dpsi_metrics = calculate_dpsi_metrics(&points, settings.baseline_weight);

        let result = ProcessedBoardData {
            timestamp: end_time,
            mac_address,
            sway_metrics: sway_calculation,
            stability_index,
            area_metrics: area_calculation,
            amplitude_spectrum: amplitude_spectrum,
            dpsi_metrics,
        };

        observers.retain(|observer| {
            observer
                .try_send(BalanceBoardOutput::Processed(result.clone()))
                .is_ok()
        });

        if observers.is_empty() {
            break;
        }

        thread::sleep(window_slide_size);
    }

    println!("Data processing execution complete.");
    Ok(())
}

fn balance_board_reading_to_cop(
    data: BalanceBoardCalibratedReading,
    x_value: f32,
    y_value: f32,
) -> CenterOfPressurePoint {
    let total_force =
        data.top_right + data.bottom_right + data.top_left + data.bottom_left;

    if total_force.abs() < 0.1 {
        return CenterOfPressurePoint {
            timestamp: data.timestamp,
            x: 0.0,
            y: 0.0,
            z: 0.0,
        };
    }

    let center_of_pressure_x =
        ((data.top_right + data.bottom_right)
        - (data.top_left + data.bottom_left))
        / total_force;

    let center_of_pressure_y =
        ((data.top_right + data.top_left)
        - (data.bottom_right + data.bottom_left))
        / total_force;

    CenterOfPressurePoint {
        timestamp: data.timestamp,
        x: center_of_pressure_x,
        y: center_of_pressure_y,
        z: total_force,
    }
}

// ============================================================================
// INTERPOLATION FUNCTIONS
// ============================================================================

fn linear_interpolation(
    points: &[CenterOfPressurePoint],
    start_time: DateTime<Utc>,
    end_time: DateTime<Utc>,
    time_step: &TimeDelta,
) -> Vec<CenterOfPressurePoint> {
    let mut result = Vec::new();
    let mut current_time = start_time;

    while current_time <= end_time {
        if let Some((before, after)) = find_interpolation_points(points, current_time) {
            let interpolated = if before.timestamp == after.timestamp {
                before.clone()
            } else {
                let total_duration = after.timestamp - before.timestamp;
                let elapsed_duration = current_time - before.timestamp;
                let t = elapsed_duration.num_milliseconds() as f32
                    / total_duration.num_milliseconds() as f32;

                CenterOfPressurePoint {
                    timestamp: current_time,
                    x: before.x + t * (after.x - before.x),
                    y: before.y + t * (after.y - before.y),
                    z: before.z + t * (after.z - before.z),
                }
            };

            result.push(interpolated);
        }

        current_time += *time_step;
    }

    result
}

fn cubic_interpolation(
    points: &[CenterOfPressurePoint],
    start_time: DateTime<Utc>,
    end_time: DateTime<Utc>,
    time_step: &TimeDelta,
) -> Vec<CenterOfPressurePoint> {
    if points.len() < 4 {
        return linear_interpolation(points, start_time, end_time, time_step);
    }

    let mut result = Vec::new();

    let times: Vec<f32> = points
        .iter()
        .map(|p| (p.timestamp - start_time).num_microseconds().unwrap_or(0) as f32 / 1_000_000.0)
        .collect();

    let x_spline =
        create_cubic_spline(&times, &points.iter().map(|p| p.x).collect::<Vec<_>>());
    let y_spline =
        create_cubic_spline(&times, &points.iter().map(|p| p.y).collect::<Vec<_>>());
    let z_spline =
        create_cubic_spline(&times, &points.iter().map(|p| p.z).collect::<Vec<_>>());

    let mut current_time = start_time;

    while current_time <= end_time {
        let t_seconds =
            (current_time - start_time).num_microseconds().unwrap_or(0) as f32 / 1_000_000.0;

        if t_seconds >= times[0] && t_seconds <= times[times.len() - 1] {
            let interpolated = CenterOfPressurePoint {
                timestamp: current_time,
                x: evaluate_cubic_spline(&x_spline, &times, t_seconds),
                y: evaluate_cubic_spline(&y_spline, &times, t_seconds),
                z: evaluate_cubic_spline(&z_spline, &times, t_seconds),
            };

            result.push(interpolated);
        }

        current_time += *time_step;
    }

    result
}

fn polynomial_interpolation(
    points: &[CenterOfPressurePoint],
    start_time: DateTime<Utc>,
    end_time: DateTime<Utc>,
    time_step: &TimeDelta,
) -> Vec<CenterOfPressurePoint> {
    if points.len() < 2 {
        return Vec::new();
    }

    // Use cubic interpolation for small datasets
    if points.len() <= 4 {
        return cubic_interpolation(points, start_time, end_time, time_step);
    }

    let mut result = Vec::new();
    let mut current_time = start_time;

    while current_time <= end_time {
        // Find nearby points for local polynomial interpolation
        let nearby_points = find_nearby_points(points, current_time, 4); // Use 4 points for cubic

        if nearby_points.len() >= 2 {
            let local_times: Vec<f32> = nearby_points
                .iter()
                .map(|p| (p.timestamp - start_time).num_milliseconds() as f32 / 1000.0)
                .collect();

            let t_seconds = (current_time - start_time).num_milliseconds() as f32 / 1000.0;

            let interpolated = CenterOfPressurePoint {
                timestamp: current_time,
                x: lagrange_interpolate(
                    &local_times,
                    &nearby_points.iter().map(|p| p.x).collect::<Vec<_>>(),
                    t_seconds,
                ),
                y: lagrange_interpolate(
                    &local_times,
                    &nearby_points.iter().map(|p| p.y).collect::<Vec<_>>(),
                    t_seconds,
                ),
                z: lagrange_interpolate(
                    &local_times,
                    &nearby_points.iter().map(|p| p.z).collect::<Vec<_>>(),
                    t_seconds,
                ),
            };

            result.push(interpolated);
        }

        current_time += *time_step;
    }

    result
}

fn find_nearby_points(
    points: &[CenterOfPressurePoint],
    target_time: DateTime<Utc>,
    max_points: usize,
) -> Vec<CenterOfPressurePoint> {
    if points.is_empty() {
        return Vec::new();
    }

    // Find the closest point
    let mut closest_idx = 0;
    let mut min_diff = (points[0].timestamp - target_time).num_milliseconds().abs();

    for (i, point) in points.iter().enumerate().skip(1) {
        let diff = (point.timestamp - target_time).num_milliseconds().abs();
        if diff < min_diff {
            min_diff = diff;
            closest_idx = i;
        }
    }

    // Collect points around the closest point
    let half = max_points / 2;
    let start_idx = closest_idx.saturating_sub(half);
    let end_idx = (closest_idx + half + 1).min(points.len());

    points[start_idx..end_idx].to_vec()
}

fn find_interpolation_points(
    points: &[CenterOfPressurePoint],
    target_time: DateTime<Utc>,
) -> Option<(&CenterOfPressurePoint, &CenterOfPressurePoint)> {
    if points.len() < 2 {
        return None;
    }

    for i in 0..points.len() - 1 {
        if points[i].timestamp <= target_time && points[i + 1].timestamp >= target_time {
            return Some((&points[i], &points[i + 1]));
        }
    }
    None
}

struct CubicSpline {
    a: Vec<f32>,
    b: Vec<f32>,
    c: Vec<f32>,
    d: Vec<f32>,
}

fn create_cubic_spline(x: &[f32], y: &[f32]) -> CubicSpline {
    let n = x.len() - 1;
    let mut h = vec![0.0; n];
    let mut alpha = vec![0.0; n];

    for i in 0..n {
        h[i] = x[i + 1] - x[i];
    }

    for i in 1..n {
        alpha[i] = 3.0 * (y[i + 1] - y[i]) / h[i]
            - 3.0 * (y[i] - y[i - 1]) / h[i - 1];
    }

    let mut l = vec![1.0; n + 1];
    let mut mu = vec![0.0; n + 1];
    let mut z = vec![0.0; n + 1];

    for i in 1..n {
        l[i] = 2.0 * (x[i + 1] - x[i - 1]) - h[i - 1] * mu[i - 1];
        mu[i] = h[i] / l[i];
        z[i] = (alpha[i] - h[i - 1] * z[i - 1]) / l[i];
    }

    let mut c = vec![0.0; n + 1];
    let mut b = vec![0.0; n];
    let mut d = vec![0.0; n];

    for j in (0..n).rev() {
        c[j] = z[j] - mu[j] * c[j + 1];
        b[j] = (y[j + 1] - y[j]) / h[j]
            - h[j] * (c[j + 1] + 2.0 * c[j]) / 3.0;
        d[j] = (c[j + 1] - c[j]) / (3.0 * h[j]);
    }

    CubicSpline {
        a: y.to_vec(),
        b,
        c: c[0..n].to_vec(),
        d,
    }
}

fn evaluate_cubic_spline(spline: &CubicSpline, x_points: &[f32], x: f32) -> f32 {
    let mut i = 0;
    for j in 0..x_points.len() - 1 {
        if x >= x_points[j] && x <= x_points[j + 1] {
            i = j;
            break;
        }
    }

    let dx = x - x_points[i];
    spline.a[i]
        + spline.b[i] * dx
        + spline.c[i] * dx * dx
        + spline.d[i] * dx * dx * dx
}

fn lagrange_interpolate(x_points: &[f32], y_points: &[f32], x: f32) -> f32 {
    let n = x_points.len();
    let mut result = 0.0;

    for i in 0..n {
        let mut term = y_points[i];
        for j in 0..n {
            if i != j {
                term *= (x - x_points[j]) / (x_points[i] - x_points[j]);
            }
        }
        result += term;
    }

    result
}

// ============================================================================
// CALCULATIONS
// ============================================================================

fn calculate_stability_index(points: &[CenterOfPressurePoint]) -> Option<f32> {
    if points.len() < 3 {
        return None;
    }

    let n = points.len() as f32;

    // 1. Calculate RMS (Root Mean Square) of COP displacement
    let mean_x = points.iter().map(|p| p.x).sum::<f32>() / n;
    let mean_y = points.iter().map(|p| p.y).sum::<f32>() / n;

    let mut sum_sq_displacement = 0.0;
    for point in points {
        let dx = point.x - mean_x;
        let dy = point.y - mean_y;
        sum_sq_displacement += dx * dx + dy * dy;
    }

    Some((sum_sq_displacement / n).sqrt())
}

// ============================================================================
// BASIC SWAY METRICS
// ============================================================================

#[derive(Serialize, Debug, Clone)]
pub struct SwayMetrics {
    pub v_cop_x: f32,
    pub v_cop_y: f32,
    pub mean_velocity: f32,
    pub total_path_length: f32,
    pub velocity_moment: f32,
}

fn calculate_basic_sway_metrics(
    points: &[CenterOfPressurePoint],
) -> Option<SwayMetrics> {
    if points.len() < 2 {
        return None;
    }

    let mut velocities_x = Vec::new();
    let mut velocities_y = Vec::new();
    let mut velocities_total = Vec::new();
    let mut total_path_length = 0.0;
    let mut total_time = 0.0;

    for i in 1..points.len() {
        let dt = (points[i].timestamp - points[i - 1].timestamp).num_milliseconds()
            as f32
            / 1000.0;

        if dt > 0.0 {
            let dx = points[i].x - points[i - 1].x;
            let dy = points[i].y - points[i - 1].y;

            let v_x = dx / dt;
            let v_y = dy / dt;
            let v_total = (dx * dx + dy * dy).sqrt() / dt;

            velocities_x.push(v_x.abs());
            velocities_y.push(v_y.abs());
            velocities_total.push(v_total);

            total_path_length += (dx * dx + dy * dy).sqrt();
            total_time += dt;
        }
    }

    if velocities_total.is_empty() {
        return None;
    }

    let v_cop_x = velocities_x.iter().sum::<f32>() / velocities_x.len() as f32;
    let v_cop_y = velocities_y.iter().sum::<f32>() / velocities_y.len() as f32;
    let mean_velocity =
        velocities_total.iter().sum::<f32>() / velocities_total.len() as f32;

    let velocity_moment = if total_time > 0.0 {
        total_path_length / total_time
    } else {
        0.0
    };

    Some(SwayMetrics {
        v_cop_x,
        v_cop_y,
        mean_velocity,
        total_path_length,
        velocity_moment,
    })
}

// ============================================================================
// DPSI METRICS
// ============================================================================

#[derive(Serialize, Debug, Clone)]
pub struct DpsiMetrics {
    pub mlsi: f32,
    pub apsi: f32,
    pub vsi: f32,
    pub dpsi: f32,
}

fn calculate_dpsi_metrics(
    points: &[CenterOfPressurePoint],
    baseline_weight: Option<f32>,
) -> Option<DpsiMetrics> {
    if points.is_empty() {
        return None;
    }

    let n = points.len() as f32;
    let baseline = match baseline_weight {
        Some(b) => b,
        None => points.iter().map(|p| p.z).sum::<f32>() / n,
    };

    let mut sum_x2 = 0.0_f32;
    let mut sum_y2 = 0.0_f32;
    let mut sum_zdiff2 = 0.0_f32;

    for p in points {
        sum_x2 += p.x * p.x;
        sum_y2 += p.y * p.y;
        let dz = baseline - p.z;
        sum_zdiff2 += dz * dz;
    }

    let mlsi = (sum_x2 / n).sqrt();
    let apsi = (sum_y2 / n).sqrt();
    let vsi = (sum_zdiff2 / n).sqrt();
    let dpsi = ((sum_x2 + sum_y2 + sum_zdiff2) / n).sqrt();

    Some(DpsiMetrics {
        mlsi,
        apsi,
        vsi,
        dpsi,
    })
}

// ============================================================================
// AREA-BASED METRICS
// ============================================================================

#[derive(Serialize, Debug, Clone)]
pub struct AreaMetrics {
    pub confidence_ellipse_polygon: Vec<(f32, f32)>,
    pub convex_hull_polygon: Vec<(f32, f32)>,
}

fn calculate_area_metrics(points: &[CenterOfPressurePoint]) -> Option<AreaMetrics> {
    if points.len() < 3 {
        return None;
    }

    let confidence_ellipse_polygon = generate_confidence_ellipse_points(points, 0.95, 180)?;
    let convex_hull_polygon = calculate_convex_hull_polygon(points)?;

    Some(AreaMetrics {
        confidence_ellipse_polygon,
        convex_hull_polygon,
    })
}

fn convex_hull_graham_scan(points: &mut [(f32, f32)]) -> Vec<(f32, f32)> {
    if points.len() < 3 {
        return points.to_vec();
    }

    // Find bottom-most point (or left most in case of tie)
    let mut bottom_idx = 0;
    for i in 1..points.len() {
        if points[i].1 < points[bottom_idx].1 ||
            (points[i].1 == points[bottom_idx].1 && points[i].0 < points[bottom_idx].0) {
            bottom_idx = i;
        }
    }
    points.swap(0, bottom_idx);
    let bottom = points[0];

    // Sort points by polar angle with respect to bottom point
    points[1..].sort_by(|a, b| {
        let angle_a = (a.1 - bottom.1).atan2(a.0 - bottom.0);
        let angle_b = (b.1 - bottom.1).atan2(b.0 - bottom.0);

        let ord = angle_a.total_cmp(&angle_b);
        if ord == std::cmp::Ordering::Equal {
            let dist_a = ((a.0 - bottom.0).powi(2) + (a.1 - bottom.1).powi(2)).sqrt();
            let dist_b = ((b.0 - bottom.0).powi(2) + (b.1 - bottom.1).powi(2)).sqrt();
            dist_a.total_cmp(&dist_b)
        } else {
            ord
        }
    });

    let mut hull = Vec::new();

    for point in points {
        while hull.len() >= 2 {
            let len = hull.len();
            if cross_product(hull[len-2], hull[len-1], *point) <= 0.0 {
                hull.pop();
            } else {
                break;
            }
        }
        hull.push(*point);
    }

    hull
}

fn cross_product(o: (f32, f32), a: (f32, f32), b: (f32, f32)) -> f32 {
    (a.0 - o.0) * (b.1 - o.1) - (a.1 - o.1) * (b.0 - o.0)
}

fn calculate_convex_hull_polygon(
    points: &[CenterOfPressurePoint],
) -> Option<Vec<(f32, f32)>> {
    if points.len() < 3 {
        return None;
    }
    let mut coords: Vec<(f32, f32)> = points.iter().map(|p| (p.x, p.y)).collect();
    let hull = convex_hull_graham_scan(&mut coords);
    if hull.len() < 3 {
        return None;
    }
    Some(hull)
}

fn generate_confidence_ellipse_points(
    points: &[CenterOfPressurePoint],
    confidence: f32,
    num_points: usize,
) -> Option<Vec<(f32, f32)>> {
    if points.len() < 3 || num_points < 3 || !(0.0..1.0).contains(&confidence) {
        return None;
    }

    // Means
    let n = points.len() as f32;
    let mean_x = points.iter().map(|p| p.x).sum::<f32>() / n;
    let mean_y = points.iter().map(|p| p.y).sum::<f32>() / n;

    // Sample covariance
    let mut cov_xx = 0.0_f32;
    let mut cov_yy = 0.0_f32;
    let mut cov_xy = 0.0_f32;
    for p in points {
        let dx = p.x - mean_x;
        let dy = p.y - mean_y;
        cov_xx += dx * dx;
        cov_yy += dy * dy;
        cov_xy += dx * dy;
    }
    let denom = (n - 1.0).max(1.0); // guard
    cov_xx /= denom;
    cov_yy /= denom;
    cov_xy /= denom;

    // Eigen decomposition of covariance (2x2 closed-form)
    let trace = cov_xx + cov_yy;
    let det = cov_xx * cov_yy - cov_xy * cov_xy;
    let disc = (trace * trace - 4.0 * det).max(0.0);
    let lambda1 = 0.5 * (trace + disc.sqrt());
    let lambda2 = 0.5 * (trace - disc.sqrt());

    // Orientation (angle of first eigenvector)
    let theta = 0.5 * (2.0 * cov_xy).atan2(cov_xx - cov_yy);
    let cos_t = theta.cos();
    let sin_t = theta.sin();

    // Chi-square quantile for 2 DOF at given confidence
    let chi2 = chi_square_quantile_2df(confidence)?;

    // Semi-axes (radii) along principal components
    let r1 = (chi2 * lambda1).max(0.0).sqrt();
    let r2 = (chi2 * lambda2).max(0.0).sqrt();

    // Sample the ellipse
    let mut poly = Vec::with_capacity(num_points);
    for k in 0..num_points {
        let t = 2.0 * PI * (k as f32) / (num_points as f32);
        let ct = t.cos();
        let st = t.sin();

        // x = cx + r1*ct*cosθ - r2*st*sinθ
        // y = cy + r1*ct*sinθ + r2*st*cosθ
        let x = mean_x + r1 * ct * cos_t - r2 * st * sin_t;
        let y = mean_y + r1 * ct * sin_t + r2 * st * cos_t;
        poly.push((x, y));
    }

    Some(poly)
}

/// Chi-square quantile for 2 degrees of freedom:
/// χ²₂(p) = -2 ln(1 - p)
fn chi_square_quantile_2df(p: f32) -> Option<f32> {
    if p <= 0.0 || p >= 1.0 {
        return None;
    }
    Some(-2.0 * (1.0 - p).ln())
}

// ============================================================================
// FREQUENCY DOMAIN ANALYSIS
// ============================================================================

#[derive(Serialize, Debug, Clone)]
pub struct FrequencySpectrum {
    pub freqs_hz: Vec<f32>,
    pub psd_xy: Vec<f32>, // summed x+y one-sided PSD (mm^2/Hz)
}

#[derive(Serialize, Debug, Clone)]
pub struct AmplitudeSpectrum {
    pub freqs_hz: Vec<f32>,
    pub amplitude_x: Vec<f32>,  // Amplitude in mm for X direction
    pub amplitude_y: Vec<f32>,  // Amplitude in mm for Y direction
    pub amplitude_xy: Vec<f32>, // Combined amplitude (sqrt(x^2 + y^2))
}

fn compute_fft_amplitude_spectrum(
    points: &[CenterOfPressurePoint],
    max_hz: f32,
) -> Option<AmplitudeSpectrum> {
    if points.len() < 8 {
        return None;
    }

    // Demean the signals
    let n = points.len();
    let mean_x = points.iter().map(|p| p.x).sum::<f32>() / n as f32;
    let mean_y = points.iter().map(|p| p.y).sum::<f32>() / n as f32;

    let mut x: Vec<f32> = points.iter().map(|p| p.x - mean_x).collect();
    let mut y: Vec<f32> = points.iter().map(|p| p.y - mean_y).collect();

    // Assume uniform sampling after interpolation
    let dt = (points[1].timestamp - points[0].timestamp)
        .num_microseconds()
        .unwrap_or(0) as f32 / 1_000_000.0;

    if dt <= 0.0 {
        return None;
    }

    let fs = 1.0 / dt;  // Sampling frequency in Hz

       // Apply Hann window and correct amplitude by coherent gain
       let mut window = Vec::with_capacity(n);
       for i in 0..n {
           let w = 0.5 - 0.5 * (2.0 * PI * i as f32 / (n as f32 - 1.0)).cos();
           window.push(w);
           x[i] *= w;
           y[i] *= w;
       }
      let coherent_gain = window.iter().sum::<f32>() / n as f32; // = 0.5 for Hann

    // Prepare FFT
    let mut planner = FftPlanner::new();
    let fft = planner.plan_fft_forward(n);

    // Convert to complex and apply FFT
    let mut x_complex: Vec<Complex<f32>> = x.iter()
        .map(|&val| Complex::new(val, 0.0))
        .collect();

    let mut y_complex: Vec<Complex<f32>> = y.iter()
        .map(|&val| Complex::new(val, 0.0))
        .collect();

    fft.process(&mut x_complex);
    fft.process(&mut y_complex);

    // Compute amplitude spectrum (not PSD)
    // For real signals, we only need the first half
    let n_half = n / 2 + 1;
    let mut freqs = Vec::with_capacity(n_half);
    let mut amp_x = Vec::with_capacity(n_half);
    let mut amp_y = Vec::with_capacity(n_half);
    let mut amp_xy = Vec::with_capacity(n_half);

    for k in 0..n_half {
        let freq = k as f32 * fs / n as f32;

        // Only include up to max_hz
        if freq > max_hz {
            break;
        }

           // One-sided amplitude scaling. For even N, Nyquist is k == N/2.
           // For odd N there is no Nyquist bin, so only DC uses 1/N.
           let is_nyquist = n % 2 == 0 && k == n / 2;
           let scale = if k == 0 || is_nyquist {
               1.0 / n as f32
           } else {
               2.0 / n as f32
           };
           // Correct for window coherent gain
           let scale = scale / coherent_gain;

        let ax = x_complex[k].norm() * scale;
        let ay = y_complex[k].norm() * scale;
        let axy = (ax * ax + ay * ay).sqrt();

        freqs.push(freq);
        amp_x.push(ax);
        amp_y.push(ay);
        amp_xy.push(axy);
    }

    Some(AmplitudeSpectrum {
        freqs_hz: freqs,
        amplitude_x: amp_x,
        amplitude_y: amp_y,
        amplitude_xy: amp_xy,
    })
}
