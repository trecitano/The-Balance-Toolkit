use crate::actors::balance_board_actor::{BalanceBoardCalibratedReading, BalanceBoardOutput};
use anyhow::Result;
use chrono::{DateTime, TimeDelta, Utc};
use tokio::sync::mpsc;
use tokio::sync::mpsc::Sender;
use rustfft::{FftPlanner, num_complex::Complex};
use std::f32::consts::PI;
use std::thread;
use serde::{Deserialize, Serialize};
use crate::types::MacAddress;

#[derive(Debug, Clone)]
struct CenterOfPressurePoint {
    timestamp: DateTime<Utc>,
    x: f32,
    y: f32,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProcessingSettings {
    pub balance_board_x_size: f32,      // X distance (mm) of the Balance Board Force transducer.
    pub balance_board_y_size: f32,      // Y distance (mm) of the Balance Board Force transducer.
    pub window_size_ms: u64,            // Window size used for calculations
    pub window_slide_ms: u64,           // How much the window moves
    pub sampling_rate: u64,           // Sampling size to create a time series (using a specific interpolation)
    pub interpolation: InterpolationSetting
}

impl ProcessingSettings {
    pub fn default() -> ProcessingSettings {
        ProcessingSettings {
            balance_board_x_size:  446.0,
            balance_board_y_size:  238.0,
            window_size_ms: 1000,
            window_slide_ms: 100,
            sampling_rate: 20,
            interpolation: InterpolationSetting::Cubic
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
    pub area_metrics: Option<AreaMetrics>,
    pub frequency_metrics: Option<FrequencyMetrics>,
    pub dfa_alpha: Option<f32>,
    pub jerk: Option<f32>,
}

pub fn initialize(observers: Vec<Sender<BalanceBoardOutput>>,
                  mac_address: MacAddress,
                  settings: ProcessingSettings) -> Sender<BalanceBoardOutput> {
    let (tx, rx) = mpsc::channel(3000);

    // This requires some heavy processing, so we dedicate a thread to it.
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

// The job of the processor is two fold:
// When it receives a raw data, it needs to send to whoever is interested in it.
// From X to X time, it will also send processed data.
fn data_process_loop(
    mut rx: mpsc::Receiver<BalanceBoardOutput>,
    mut observers: Vec<Sender<BalanceBoardOutput>>,
    mac_address: MacAddress,
    settings: ProcessingSettings
) -> Result<()> {
    println!("Data processing execution start.");
    let mut buffer: Vec<CenterOfPressurePoint> = Vec::with_capacity(200);

    let update_rate = std::time::Duration::from_millis(100);

    // Window size of 5 seconds
    let window_size = std::time::Duration::from_millis(settings.window_size_ms);
    let window_slide_size = std::time::Duration::from_millis(settings.window_slide_ms);
    let sampling_size_time_delta = TimeDelta::milliseconds(settings.window_size_ms as i64 / settings.sampling_rate as i64);

    let cop_calculation_x_value = settings.balance_board_x_size / 2.0;
    let cop_calculation_y_value = settings.balance_board_y_size / 2.0;

    // Initialization : We need to let the window build up first
    thread::sleep(window_size);

    loop {
        thread::sleep(window_slide_size);

        while let Ok(item) = rx.try_recv() {
            match item {
                BalanceBoardOutput::Raw(data) => {
                    let cop = balance_board_reading_to_cop(data, cop_calculation_x_value, cop_calculation_y_value);
                    buffer.push(cop);
                }
                BalanceBoardOutput::Processed(_) => {
                    // This is a hack - it should be impossible for this channel to receive these events.
                    // Just doing this to make my life easier :see_no_evil:
                    panic!()
                }
            }
        }
        
        if rx.is_closed() {
            break;
        }

        let end_time = Utc::now();
        let start_time = end_time - window_size;

        // Cleanup old raw readings
        let idx = buffer.partition_point(|p| p.timestamp < start_time);
        buffer.drain(0..idx);

        let points = match settings.interpolation {
            InterpolationSetting::Linear => { linear_interpolation(&buffer, start_time, end_time, &sampling_size_time_delta)}
            InterpolationSetting::Cubic => { cubic_interpolation(&buffer, start_time, end_time, &sampling_size_time_delta)}
            InterpolationSetting::Polynomial => { polynomial_interpolation(&buffer, start_time, end_time, &sampling_size_time_delta)}
        };

        let sway_calculation = calculate_basic_sway_metrics(&points);
        let area_calculation = calculate_area_metrics(&points);
        let frequency_calculation = calculate_frequency_metrics(&points);
        let dfa_calculation = calculate_dfa_alpha(&points);
        let jerk_calculation = calculate_jerk(&points);

        let result = ProcessedBoardData {
            timestamp: end_time,
            mac_address,
            sway_metrics: sway_calculation,
            area_metrics: area_calculation,
            frequency_metrics: frequency_calculation,
            dfa_alpha: dfa_calculation,
            jerk: jerk_calculation,
        };

        observers.retain(|observer| {
            observer.try_send(BalanceBoardOutput::Processed(result.clone())).is_ok()
        });

        if observers.is_empty() {
            // No living channel interested in these results, so we can stop processing.
            break;
        }
    }

    println!("Data processing execution complete.");
    Ok(())
}

fn balance_board_reading_to_cop(data: BalanceBoardCalibratedReading, x_value: f32, y_value: f32)
    -> CenterOfPressurePoint {
    let total_force = data.top_right + data.bottom_right + data.top_left + data.bottom_left;
    if total_force.abs() < 0.1 {
        return CenterOfPressurePoint {
            timestamp: data.timestamp,
            x: 0.0,
            y: 0.0,
        };
    }

    let center_of_pressure_x =
        x_value * ((data.top_right + data.bottom_right) - (data.top_left + data.bottom_left)) / total_force;

    let center_of_pressure_y =
        y_value * ((data.top_right + data.top_left) - (data.bottom_right + data.bottom_left)) / total_force;

    CenterOfPressurePoint {
        timestamp: data.timestamp,
        x: center_of_pressure_x,
        y: center_of_pressure_y,
    }
}

// ============================================================================
// PRE-PROCESSING ALGORITHMS
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
        // Find the two points to interpolate between
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

    // Extract time points as seconds from start_time
    let times: Vec<f32> = points
        .iter()
        .map(|p| (p.timestamp - start_time).num_milliseconds() as f32 / 1000.0)
        .collect();

    // Create cubic splines for x and y coordinates
    let x_spline = create_cubic_spline(
        &times,
        &points.iter().map(|p| p.x).collect::<Vec<_>>()
    );
    let y_spline = create_cubic_spline(
        &times,
        &points.iter().map(|p| p.y).collect::<Vec<_>>()
    );

    let mut current_time = start_time;

    while current_time <= end_time {
        let t_seconds = (current_time - start_time).num_milliseconds() as f32 / 1000.0;

        // Check if we're within the interpolation range
        if t_seconds >= times[0] && t_seconds <= times[times.len() - 1] {
            let interpolated = CenterOfPressurePoint {
                timestamp: current_time,
                x: evaluate_cubic_spline(&x_spline, &times, t_seconds),
                y: evaluate_cubic_spline(&y_spline, &times, t_seconds),
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
        let t_seconds = (current_time - start_time).num_milliseconds() as f32 / 1000.0;

        // Check if we're within the interpolation range
        if t_seconds >= times[0] && t_seconds <= times[times.len() - 1] {
            let interpolated = CenterOfPressurePoint {
                timestamp: current_time,
                x: lagrange_interpolate(&times, &points.iter().map(|p| p.x).collect::<Vec<_>>(), t_seconds),
                y: lagrange_interpolate(&times, &points.iter().map(|p| p.y).collect::<Vec<_>>(), t_seconds),
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
        alpha[i] = 3.0 * (y[i + 1] - y[i]) / h[i] - 3.0 * (y[i] - y[i - 1]) / h[i - 1];
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
        b[j] = (y[j + 1] - y[j]) / h[j] - h[j] * (c[j + 1] + 2.0 * c[j]) / 3.0;
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
    spline.a[i] + spline.b[i] * dx + spline.c[i] * dx * dx + spline.d[i] * dx * dx * dx
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

#[derive(Debug, Clone)]
pub struct CenterOfPressureRMS {
    pub total_displacement: f32,
    pub x_displacement: f32,
    pub y_displacement: f32,
    pub mean_x: f32,
    pub mean_y: f32,
}

fn calculate_cop_rms(points: &[CenterOfPressurePoint]) -> Option<CenterOfPressureRMS> {
    if points.is_empty() {
        return None;
    }

    let n = points.len() as f32;

    // Calculate mean position
    let mean_x = points.iter().map(|p| p.x).sum::<f32>() / n;
    let mean_y = points.iter().map(|p| p.y).sum::<f32>() / n;

    // Calculate squared deviations
    let mut sum_x_squared = 0.0;
    let mut sum_y_squared = 0.0;
    let mut sum_total_squared = 0.0;

    for point in points {
        let x_dev = point.x - mean_x;
        let y_dev = point.y - mean_y;

        sum_x_squared += x_dev * x_dev;
        sum_y_squared += y_dev * y_dev;
        sum_total_squared += x_dev * x_dev + y_dev * y_dev;  // Euclidean distance squared
    }

    // Calculate RMS values
    let rms_x = (sum_x_squared / n).sqrt();
    let rms_y = (sum_y_squared / n).sqrt();
    let rms_total = (sum_total_squared / n).sqrt();

    Some(CenterOfPressureRMS {
        total_displacement: rms_total,
        x_displacement: rms_x,
        y_displacement: rms_y,
        mean_x,
        mean_y,
    })
}

fn calculate_x_rms(points: &[CenterOfPressurePoint]) -> Option<f32> {
    if points.is_empty() {
        return None;
    }

    let n = points.len() as f32;
    let mean_x = points.iter().map(|p| p.x).sum::<f32>() / n;

    let sum_squared = points
        .iter()
        .map(|p| (p.x - mean_x).powi(2))
        .sum::<f32>();

    Some((sum_squared / n).sqrt())
}

fn calculate_y_rms(points: &[CenterOfPressurePoint]) -> Option<f32> {
    if points.is_empty() {
        return None;
    }

    let n = points.len() as f32;
    let mean_y = points.iter().map(|p| p.y).sum::<f32>() / n;

    let sum_squared = points
        .iter()
        .map(|p| (p.y - mean_y).powi(2))
        .sum::<f32>();

    Some((sum_squared / n).sqrt())
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

fn calculate_basic_sway_metrics(points: &[CenterOfPressurePoint]) -> Option<SwayMetrics> {
    if points.len() < 2 {
        return None;
    }

    let mut velocities_x = Vec::new();
    let mut velocities_y = Vec::new();
    let mut velocities_total = Vec::new();
    let mut total_path_length = 0.0;
    let mut total_time = 0.0;

    for i in 1..points.len() {
        let dt = (points[i].timestamp - points[i - 1].timestamp).num_milliseconds() as f32
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
    let mean_velocity = velocities_total.iter().sum::<f32>() / velocities_total.len() as f32;

    // Velocity Moment (normalized path length)
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
        angle_a.partial_cmp(&angle_b).unwrap()
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
pub struct FrequencyMetrics {
    pub mean_power_frequency: f32,
    pub center_of_spectrum: f32,
    pub total_power: f32,
}

// https://en.wikipedia.org/wiki/Spectral_density#Power_spectral_density
fn calculate_frequency_metrics(points: &[CenterOfPressurePoint]) -> Option<FrequencyMetrics> {
    if points.len() < 8 {
        return None;
    }

    // Calculate sampling rate
    let total_time = (points.last()?.timestamp - points[0].timestamp).num_milliseconds() as f32 / 1000.0;
    let sampling_rate = points.len() as f32 / total_time;

    // Prepare data for FFT (using resultant velocity)
    let mut signal = Vec::new();
    for i in 1..points.len() {
        let dt = (points[i].timestamp - points[i-1].timestamp).num_milliseconds() as f32 / 1000.0;
        if dt > 0.0 {
            let dx = points[i].x - points[i-1].x;
            let dy = points[i].y - points[i-1].y;
            let velocity = ((dx * dx + dy * dy).sqrt()) / dt;
            signal.push(Complex::new(velocity, 0.0));
        }
    }

    // Pad to next power of 2
    let n = signal.len().next_power_of_two();
    signal.resize(n, Complex::new(0.0, 0.0));

    // Perform FFT
    let mut planner = FftPlanner::new();
    let fft = planner.plan_fft_forward(n);
    fft.process(&mut signal);

    // Calculate power spectrum (only positive frequencies)
    let mut power_spectrum = Vec::new();
    let mut frequencies = Vec::new();

    for i in 0..n/2 {
        let power = signal[i].norm_sqr();
        power_spectrum.push(power);
        frequencies.push(i as f32 * sampling_rate / n as f32);
    }

    // Calculate metrics
    let total_power: f32 = power_spectrum.iter().sum();

    if total_power == 0.0 {
        return None;
    }

    // Mean Power Frequency
    let mut weighted_freq_sum = 0.0;
    for i in 0..power_spectrum.len() {
        weighted_freq_sum += frequencies[i] * power_spectrum[i];
    }
    let mean_power_frequency = weighted_freq_sum / total_power;

    // Center of Spectrum (median frequency)
    let mut cumulative_power = 0.0;
    let half_power = total_power / 2.0;
    let mut center_of_spectrum = 0.0;

    for i in 0..power_spectrum.len() {
        cumulative_power += power_spectrum[i];
        if cumulative_power >= half_power {
            center_of_spectrum = frequencies[i];
            break;
        }
    }

    Some(FrequencyMetrics {
        mean_power_frequency,
        center_of_spectrum,
        total_power,
    })
}

// ============================================================================
// DETRENDED FLUCTUATION ANALYSIS (DFA)
// ============================================================================

// https://en.wikipedia.org/wiki/Detrended_fluctuation_analysis
fn calculate_dfa_alpha(points: &[CenterOfPressurePoint]) -> Option<f32> {
    if points.len() < 16 {
        return None;
    }

    // Create time series (resultant displacement from mean)
    let mean_x = points.iter().map(|p| p.x).sum::<f32>() / points.len() as f32;
    let mean_y = points.iter().map(|p| p.y).sum::<f32>() / points.len() as f32;

    let time_series: Vec<f32> = points.iter()
        .map(|p| ((p.x - mean_x).powi(2) + (p.y - mean_y).powi(2)).sqrt())
        .collect();

    // Remove mean
    let series_mean = time_series.iter().sum::<f32>() / time_series.len() as f32;
    let centered_series: Vec<f32> = time_series.iter().map(|x| x - series_mean).collect();

    // Create cumulative sum
    let mut cumsum = vec![0.0; centered_series.len()];
    cumsum[0] = centered_series[0];
    for i in 1..centered_series.len() {
        cumsum[i] = cumsum[i-1] + centered_series[i];
    }

    // Define window sizes (powers of 2 from 4 to N/4)
    let mut window_sizes = Vec::new();
    let mut size = 4;
    while size <= centered_series.len() / 4 {
        window_sizes.push(size);
        size *= 2;
    }

    if window_sizes.len() < 3 {
        return None;
    }

    let mut log_sizes = Vec::new();
    let mut log_fluctuations = Vec::new();

    for &window_size in &window_sizes {
        let mut fluctuations = Vec::new();

        // Divide series into non-overlapping windows
        let num_windows = cumsum.len() / window_size;

        for w in 0..num_windows {
            let start = w * window_size;
            let end = start + window_size;

            if end <= cumsum.len() {
                let window = &cumsum[start..end];

                // Fit linear trend
                let n = window.len() as f32;
                let x_mean = (n - 1.0) / 2.0;
                let y_mean = window.iter().sum::<f32>() / n;

                let mut numerator = 0.0;
                let mut denominator = 0.0;

                for (i, &y) in window.iter().enumerate() {
                    let x = i as f32;
                    numerator += (x - x_mean) * (y - y_mean);
                    denominator += (x - x_mean).powi(2);
                }

                let slope = if denominator != 0.0 { numerator / denominator } else { 0.0 };
                let intercept = y_mean - slope * x_mean;

                // Calculate detrended fluctuation
                let mut sum_sq_dev = 0.0;
                for (i, &y) in window.iter().enumerate() {
                    let trend = slope * i as f32 + intercept;
                    sum_sq_dev += (y - trend).powi(2);
                }

                fluctuations.push(sum_sq_dev / n);
            }
        }

        if !fluctuations.is_empty() {
            let avg_fluctuation = fluctuations.iter().sum::<f32>() / fluctuations.len() as f32;
            log_sizes.push((window_size as f32).ln());
            log_fluctuations.push(avg_fluctuation.sqrt().ln());
        }
    }

    // Linear regression to find alpha (slope)
    if log_sizes.len() < 2 {
        return None;
    }

    let n = log_sizes.len() as f32;
    let x_mean = log_sizes.iter().sum::<f32>() / n;
    let y_mean = log_fluctuations.iter().sum::<f32>() / n;

    let mut numerator = 0.0;
    let mut denominator = 0.0;

    for i in 0..log_sizes.len() {
        numerator += (log_sizes[i] - x_mean) * (log_fluctuations[i] - y_mean);
        denominator += (log_sizes[i] - x_mean).powi(2);
    }

    if denominator == 0.0 {
        return None;
    }

    Some(numerator / denominator)
}

// ============================================================================
// ADVANCED METRICS
// ============================================================================

// https://en.wikipedia.org/wiki/Jerk_(physics)
fn calculate_jerk(points: &[CenterOfPressurePoint]) -> Option<f32> {
    if points.len() < 4 {
        return None;
    }

    let mut jerks = Vec::new();

    for i in 3..points.len() {
        // Calculate time intervals
        let dt1 = (points[i-2].timestamp - points[i-3].timestamp).num_milliseconds() as f32 / 1000.0;
        let dt2 = (points[i-1].timestamp - points[i-2].timestamp).num_milliseconds() as f32 / 1000.0;
        let dt3 = (points[i].timestamp - points[i-1].timestamp).num_milliseconds() as f32 / 1000.0;

        if dt1 > 0.0 && dt2 > 0.0 && dt3 > 0.0 {
            // Calculate velocities
            let v1_x = (points[i-2].x - points[i-3].x) / dt1;
            let v1_y = (points[i-2].y - points[i-3].y) / dt1;

            let v2_x = (points[i-1].x - points[i-2].x) / dt2;
            let v2_y = (points[i-1].y - points[i-2].y) / dt2;

            let v3_x = (points[i].x - points[i-1].x) / dt3;
            let v3_y = (points[i].y - points[i-1].y) / dt3;

            // Calculate accelerations
            let a1_x = (v2_x - v1_x) / dt2;
            let a1_y = (v2_y - v1_y) / dt2;

            let a2_x = (v3_x - v2_x) / dt3;
            let a2_y = (v3_y - v2_y) / dt3;

            // Calculate jerk (rate of change of acceleration)
            let jerk_x = (a2_x - a1_x) / dt3;
            let jerk_y = (a2_y - a1_y) / dt3;

            let jerk_magnitude = (jerk_x.powi(2) + jerk_y.powi(2)).sqrt();
            jerks.push(jerk_magnitude);
        }
    }

    if jerks.is_empty() {
        return None;
    }

    // Return RMS jerk
    let mean_square_jerk = jerks.iter().map(|j| j.powi(2)).sum::<f32>() / jerks.len() as f32;
    Some(mean_square_jerk.sqrt())
}