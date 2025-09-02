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
    pub frequency_spectrum: Option<FrequencySpectrum>,
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
        //println!("BEFORE INTERPOLATION: {:#?}", &window_slice);

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

        //println!("AFTER INTERPOLATION: {:#?}", &points);

        let sway_calculation = calculate_basic_sway_metrics(&points);
        let stability_index = calculate_stability_index(&points);
        let area_calculation = calculate_area_metrics(&points);
        let frequency_spectrum = welch_psd_xy(&points, 1000, 0.5f32, 15f32);
        let dpsi_metrics = calculate_dpsi_metrics(&points, settings.baseline_weight);

        let result = ProcessedBoardData {
            timestamp: end_time,
            mac_address,
            sway_metrics: sway_calculation,
            stability_index,
            area_metrics: area_calculation,
            frequency_spectrum,
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

    println!("Total pressure is {:#?}", total_force);

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

    let mut result = Vec::new();

    let times: Vec<f32> = points
        .iter()
        .map(|p| (p.timestamp - start_time).num_milliseconds() as f32 / 1000.0)
        .collect();

    let mut current_time = start_time;

    while current_time <= end_time {
        let t_seconds =
            (current_time - start_time).num_milliseconds() as f32 / 1000.0;

        if t_seconds >= times[0] && t_seconds <= times[times.len() - 1] {
            let interpolated = CenterOfPressurePoint {
                timestamp: current_time,
                x: lagrange_interpolate(
                    &times,
                    &points.iter().map(|p| p.x).collect::<Vec<_>>(),
                    t_seconds,
                ),
                y: lagrange_interpolate(
                    &times,
                    &points.iter().map(|p| p.y).collect::<Vec<_>>(),
                    t_seconds,
                ),
                z: lagrange_interpolate(
                    &times,
                    &points.iter().map(|p| p.z).collect::<Vec<_>>(),
                    t_seconds,
                ),
            };

            result.push(interpolated);
        }

        current_time += *time_step;
    }

    result
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

    println!("dpsi: {}, mlsi: {}, apsi: {}, vsi: {}, sum_x2: {}, sum_y2: {}, sum_zdiff2: {}, n: {}", dpsi, mlsi, apsi, vsi, sum_x2, sum_y2, sum_zdiff2, n);

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

    let confidence_ = calculate_95_confidence_ellipse_area(points)?;
    let convex_hull_area = calculate_convex_hull_area(points)?;

    let confidence_ellipse_polygon = generate_confidence_ellipse_points(points, 0.95, 180)?;
    let convex_hull_polygon = calculate_convex_hull_polygon(points)?;

    Some(AreaMetrics {
        confidence_ellipse_polygon,
        convex_hull_polygon,
    })
}

fn calculate_95_confidence_ellipse_area(points: &[CenterOfPressurePoint]) -> Option<f32> {
    if points.len() < 3 {
        return None;
    }

    let n = points.len() as f32;

    // Calculate means
    let mean_x = points.iter().map(|p| p.x).sum::<f32>() / n;
    let mean_y = points.iter().map(|p| p.y).sum::<f32>() / n;

    // Calculate covariance matrix elements
    let mut cov_xx = 0.0;
    let mut cov_yy = 0.0;
    let mut cov_xy = 0.0;

    for point in points {
        let dx = point.x - mean_x;
        let dy = point.y - mean_y;
        cov_xx += dx * dx;
        cov_yy += dy * dy;
        cov_xy += dx * dy;
    }

    cov_xx /= n - 1.0;
    cov_yy /= n - 1.0;
    cov_xy /= n - 1.0;

    // Calculate eigenvalues
    let trace = cov_xx + cov_yy;
    let det = cov_xx * cov_yy - cov_xy * cov_xy;
    let discriminant = trace * trace - 4.0 * det;

    if discriminant < 0.0 {
        return None;
    }

    let lambda1 = (trace + discriminant.sqrt()) / 2.0;
    let lambda2 = (trace - discriminant.sqrt()) / 2.0;

    // 95% confidence ellipse (chi-square critical value for 2 DOF at 95% = 5.991)
    let chi_square_95 = 5.991;
    let area = PI * (chi_square_95 * lambda1).sqrt() * (chi_square_95 * lambda2).sqrt();

    Some(area)
}

fn calculate_convex_hull_area(points: &[CenterOfPressurePoint]) -> Option<f32> {
    if points.len() < 3 {
        return None;
    }

    // Extract x,y coordinates
    let mut coords: Vec<(f32, f32)> = points.iter().map(|p| (p.x, p.y)).collect();

    // Graham scan algorithm for convex hull
    let hull = convex_hull_graham_scan(&mut coords);

    if hull.len() < 3 {
        return None;
    }

    // Calculate area using shoelace formula
    let mut area = 0.0;
    for i in 0..hull.len() {
        let j = (i + 1) % hull.len();
        area += hull[i].0 * hull[j].1;
        area -= hull[j].0 * hull[i].1;
    }

    Some((area / 2.0).abs())
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

fn welch_psd_xy(
    points: &[CenterOfPressurePoint],
    seg_len: usize,      // e.g., 1000 for 0.1 Hz resolution at 100 Hz sampling
    overlap: f32,        // e.g., 0.5 (50%)
    max_hz: f32,         // e.g., 10.0 Hz
) -> Option<FrequencySpectrum> {
    if points.len() < seg_len || seg_len < 8 || !(0.0..1.0).contains(&overlap) {
        return None;
    }

    // Uniform dt assumed after your interpolation
    let dt = (points[1].timestamp - points[0].timestamp)
        .num_microseconds()? as f32
        / 1_000_000.0;
    if dt <= 0.0 {
        return None;
    }
    let fs = 1.0 / dt;
    let step = (seg_len as f32 * (1.0 - overlap)).max(1.0).round() as usize;

    // Demean x,y
    let n = points.len();
    let mean_x = points.iter().map(|p| p.x).sum::<f32>() / n as f32;
    let mean_y = points.iter().map(|p| p.y).sum::<f32>() / n as f32;

    let x: Vec<f32> = points.iter().map(|p| p.x - mean_x).collect();
    let y: Vec<f32> = points.iter().map(|p| p.y - mean_y).collect();

    // Hann window and its normalization U
    let mut w = vec![0.0_f32; seg_len];
    let mut w2sum = 0.0_f32;
    for i in 0..seg_len {
        let wi = 0.5 - 0.5 * (2.0 * std::f32::consts::PI * i as f32 / (seg_len as f32 - 1.0)).cos();
        w[i] = wi;
        w2sum += wi * wi;
    }
    let u = w2sum / seg_len as f32; // window power normalization

    // FFT setup
    let mut planner = FftPlanner::new();
    let fft = planner.plan_fft_forward(seg_len);

    let nhalf = seg_len / 2 + 1;
    let mut acc_psd = vec![0.0_f32; nhalf];
    let mut nseg = 0usize;

    let mut start = 0usize;
    while start + seg_len <= n {
        // Windowed segment
        let mut sx: Vec<Complex<f32>> = (0..seg_len)
            .map(|i| Complex::new(x[start + i] * w[i], 0.0))
            .collect();
        let mut sy: Vec<Complex<f32>> = (0..seg_len)
            .map(|i| Complex::new(y[start + i] * w[i], 0.0))
            .collect();

        fft.process(&mut sx);
        fft.process(&mut sy);

        // One-sided PSD, scale for density (mm^2/Hz)
        for k in 0..nhalf {
            let fx = sx[k].norm_sqr();
            let fy = sy[k].norm_sqr();
            let mut s = (fx + fy) * dt / (u * seg_len as f32);
            if k != 0 && k != nhalf - 1 {
                s *= 2.0;
            }
            acc_psd[k] += s;
        }

        nseg += 1;
        start += step;
    }

    if nseg == 0 {
        return None;
    }

    let psd: Vec<f32> = acc_psd.into_iter().map(|v| v / nseg as f32).collect();
    let freqs: Vec<f32> = (0..nhalf)
        .map(|k| k as f32 * fs / seg_len as f32)
        .collect();

    // --- NEW: Clip to max_hz (e.g., 10 Hz) ---
    let mut freqs_clipped = Vec::new();
    let mut psd_clipped = Vec::new();
    for (f, p) in freqs.iter().zip(psd.iter()) {
        if *f <= max_hz {
            freqs_clipped.push(*f);
            psd_clipped.push(*p);
        } else {
            break;
        }
    }

    Some(FrequencySpectrum {
        freqs_hz: freqs_clipped,
        psd_xy: psd_clipped,
    })
}
