# Wii Balance Board Data Processing Guide

## Overview

This guide provides comprehensive preprocessing steps and metrics calculations for analyzing postural sway data from the Wii Balance Board (WBB) based on established research protocols, including handling of time jitters and irregular sampling rates.

## Table of Contents

1. [Raw Data Structure](#1-raw-data-structure)
2. [Time Jitters and Irregular Sampling](#2-time-jitters-and-irregular-sampling)
3. [Preprocessing Steps](#3-preprocessing-steps)
4. [Center of Pressure Calculations](#4-center-of-pressure-calculations)
5. [Basic Sway Metrics](#5-basic-sway-metrics)
6. [Area-Based Metrics](#6-area-based-metrics)
7. [Frequency Domain Analysis](#7-frequency-domain-analysis)
8. [Detrended Fluctuation Analysis](#8-detrended-fluctuation-analysis)
9. [Weight Distribution Metrics](#9-weight-distribution-metrics)
10. [Advanced Metrics](#10-advanced-metrics)
11. [Testing Protocols](#11-testing-protocols)
12. [Implementation Notes](#12-implementation-notes)
13. [References](#references)
14. [Notes](#notes)

---

## 1. Raw Data Structure

The Wii Balance Board provides 4 pressure sensor readings:

- **TR** = Top Right pressure sensor
- **TL** = Top Left pressure sensor  
- **BR** = Bottom Right pressure sensor
- **BL** = Bottom Left pressure sensor

### Board Specifications
- **Board Dimensions**: 433mm × 238mm (typical WBB dimensions) (Should be configured in Settings menu)
- **Sampling Rate**: 30 Hz (dt = 0.0333 seconds)

---

## 2. Time Jitters and Irregular Sampling

### Common Issues
- Bluetooth packet drops causing missing samples
- Variable sampling intervals (jitter)
- Actual sampling rates deviating from nominal 30 Hz
- Timestamp inconsistencies affecting velocity and frequency calculations

### Detection Methods

#### Sampling Rate Analysis
```rust
let dt_actual: Vec<f64> = timestamps.windows(2).map(|w| w[1] - w[0]).collect();
let mean_dt = dt_actual.iter().sum::<f64>() / dt_actual.len() as f64;
let variance = dt_actual.iter().map(|x| (x - mean_dt).powi(2)).sum::<f64>() / dt_actual.len() as f64;
let std_dt = variance.sqrt();
let actual_fs = 1.0 / mean_dt;
```

#### Jitter Detection (3-sigma rule)
```rust
let dt_threshold = mean_dt + 3.0 * std_dt;
let jitter_indices: Vec<usize> = dt_actual.iter()
    .enumerate()
    .filter_map(|(i, &dt)| if dt > dt_threshold { Some(i) } else { None })
    .collect();
```

#### Missing Sample Detection
```rust
let expected_dt = 1.0 / 30.0;
let gap_indices: Vec<usize> = dt_actual.iter()
    .enumerate()
    .filter_map(|(i, &dt)| if dt > 1.5 * expected_dt { Some(i) } else { None })
    .collect();
let missing_samples: Vec<i32> = gap_indices.iter()
    .map(|&i| (dt_actual[i] / expected_dt).round() as i32 - 1)
    .collect();
```

### Preprocessing Solutions

#### Method A: Linear Time Correction
```rust
fn linspace(start: f64, end: f64, num: usize) -> Vec<f64> {
    if num <= 1 {
        return vec![start];
    }
    let step = (end - start) / (num - 1) as f64;
    (0..num).map(|i| start + i as f64 * step).collect()
}

let corrected_timestamps = linspace(timestamps[0], timestamps[timestamps.len() - 1], n_samples);
```

#### Method B: Median Filter Smoothing
```rust
fn median_filter(data: &[f64], window: usize) -> Vec<f64> {
    let mut result = Vec::new();
    let half_window = window / 2;
    
    for i in 0..data.len() {
        let start = if i >= half_window { i - half_window } else { 0 };
        let end = std::cmp::min(i + half_window + 1, data.len());
        
        let mut window_data: Vec<f64> = data[start..end].to_vec();
        window_data.sort_by(|a, b| a.partial_cmp(b).unwrap());
        
        let median = if window_data.len() % 2 == 0 {
            (window_data[window_data.len() / 2 - 1] + window_data[window_data.len() / 2]) / 2.0
        } else {
            window_data[window_data.len() / 2]
        };
        result.push(median);
    }
    result
}

let dt_smooth = median_filter(&dt_raw, 5);
let mut corrected_timestamps = vec![timestamps[0]];
let mut cumsum = timestamps[0];
for &dt in &dt_smooth {
    cumsum += dt;
    corrected_timestamps.push(cumsum);
}
```

#### Data Interpolation for Missing Samples
```rust
fn linear_interpolate(x: &[f64], y: &[f64], x_new: &[f64]) -> Vec<f64> {
    let mut result = Vec::new();
    
    for &xi in x_new {
        if xi <= x[0] {
            result.push(y[0]);
        } else if xi >= x[x.len() - 1] {
            result.push(y[y.len() - 1]);
        } else {
            // Find the two points to interpolate between
            let mut i = 0;
            while i < x.len() - 1 && x[i + 1] < xi {
                i += 1;
            }
            
            let t = (xi - x[i]) / (x[i + 1] - x[i]);
            let yi = y[i] + t * (y[i + 1] - y[i]);
            result.push(yi);
        }
    }
    result
}

let regular_timestamps = linspace(start_time, end_time, n_samples);
let cop_x_interp = linear_interpolate(&timestamps, &cop_data_x, &regular_timestamps);
let cop_y_interp = linear_interpolate(&timestamps, &cop_data_y, &regular_timestamps);
```

### Quality Assessment Metrics

#### Timing Quality Indicators
- `mean_sampling_rate = 1.0 / mean_dt`
- `jitter_percentage = std_dt / mean_dt * 100.0`
- `max_gap_ms = dt_actual.iter().fold(0.0, |a, &b| a.max(b)) * 1000.0`
- `dropped_samples_est = dt_actual.iter().filter(|&&dt| dt > 1.5 * nominal_dt).count()`
- `timing_regularity = 1.0 - (std_dt / mean_dt)`

#### Quality Flags
- **high_jitter**: `std_dt / mean_dt > 0.1` (>10% jitter)
- **missing_samples**: `dt_actual.iter().any(|&dt| dt > 2.0 * nominal_dt)` (Large gaps)
- **low_sampling_rate**: `mean_dt > 1.2 * nominal_dt` (<25 Hz actual)
- **data_spikes**: `z_score > 3.0` for COP values
- **insufficient_duration**: `(timestamps[timestamps.len() - 1] - timestamps[0]) < 15.0` (<15s)

---

## 3. Preprocessing Steps

### Data Synchronization and Filtering
- **Sampling Rate**: 30 Hz (dt = 0.0333 seconds)
- **Filtering**: Use raw unfiltered data (as per research protocols)
- **Time Synchronization**: Use cross-correlation if comparing with other devices

### Calibration
1. Zero the device before each measurement
2. Apply calibration using known weights (e.g., 20.4 kg reference)
3. Ensure consistent foot positioning between trials

### Data Quality Control
- Remove trials where participants violated position requirements
- Exclude trials with arm support or raised foot touching floor
- Typical measurement duration: 20-30 seconds per trial
- Average 3 trials for improved reliability

---

## 4. Center of Pressure Calculations

### Total Weight
```rust
let total_weight = tr + tl + br + bl;
```

### COP in Medial-Lateral Direction (X-axis)
```rust
let cop_x = ((tr + br) - (tl + bl)) * (board_width / 2.0) / total_weight;
```

### COP in Anterior-Posterior Direction (Y-axis)
```rust
let cop_y = ((tr + tl) - (br + bl)) * (board_length / 2.0) / total_weight;
```

---

## 5. Basic Sway Metrics

### Root Mean Square (RMS)
```rust
let mean_cop_x = cop_x.iter().sum::<f64>() / cop_x.len() as f64;
let mean_cop_y = cop_y.iter().sum::<f64>() / cop_y.len() as f64;

let rms_x = (cop_x.iter()
    .map(|x| (x - mean_cop_x).powi(2))
    .sum::<f64>() / cop_x.len() as f64)
    .sqrt();
    
let rms_y = (cop_y.iter()
    .map(|y| (y - mean_cop_y).powi(2))
    .sum::<f64>() / cop_y.len() as f64)
    .sqrt();
```

### Mean Velocity
```rust
let mv_x = cop_x.windows(2)
    .map(|w| (w[1] - w[0]).abs())
    .sum::<f64>() / ((cop_x.len() - 1) as f64 * dt);
    
let mv_y = cop_y.windows(2)
    .map(|w| (w[1] - w[0]).abs())
    .sum::<f64>() / ((cop_y.len() - 1) as f64 * dt);
```

### Robust Velocity Calculation (for irregular sampling)
```rust
let dt_vec: Vec<f64> = timestamps.windows(2).map(|w| w[1] - w[0]).collect();
let dt_clamped: Vec<f64> = dt_vec.iter().map(|&dt| dt.max(1e-6)).collect(); // Minimum threshold

let dcop_x: Vec<f64> = cop_data_x.windows(2).map(|w| w[1] - w[0]).collect();
let dcop_y: Vec<f64> = cop_data_y.windows(2).map(|w| w[1] - w[0]).collect();

let vel_x: Vec<f64> = dcop_x.iter()
    .zip(dt_clamped.iter())
    .map(|(dcop, dt)| dcop.abs() / dt)
    .collect();
    
let vel_y: Vec<f64> = dcop_y.iter()
    .zip(dt_clamped.iter())
    .map(|(dcop, dt)| dcop.abs() / dt)
    .collect();

// Remove outliers using z-score > 3
fn remove_outliers(data: &[f64], threshold: f64) -> Vec<f64> {
    let mean = data.iter().sum::<f64>() / data.len() as f64;
    let variance = data.iter().map(|x| (x - mean).powi(2)).sum::<f64>() / data.len() as f64;
    let std_dev = variance.sqrt();
    
    data.iter()
        .filter(|&&x| ((x - mean) / std_dev).abs() <= threshold)
        .cloned()
        .collect()
}

let vel_x_filtered = remove_outliers(&vel_x, 3.0);
let vel_y_filtered = remove_outliers(&vel_y, 3.0);
```

### Total Path Length
```rust
let path_length = cop_x.windows(2)
    .zip(cop_y.windows(2))
    .map(|(x_window, y_window)| {
        let dx = x_window[1] - x_window[0];
        let dy = y_window[1] - y_window[0];
        (dx * dx + dy * dy).sqrt()
    })
    .sum::<f64>();
```

### Velocity Moment
```rust
let velocity_moment = cop_x.windows(2)
    .zip(cop_y.windows(2))
    .map(|(x_window, y_window)| {
        let dx = x_window[1] - x_window[0];
        let dy = y_window[1] - y_window[0];
        (dx * dx + dy * dy).sqrt()
    })
    .sum::<f64>() / ((cop_x.len() - 1) as f64 * dt);
```

---

## 6. Area-Based Metrics

### 95% Confidence Ellipse Area
```rust
use std::f64::consts::PI;

// Calculate standard deviations
let variance_x = cop_x.iter().map(|x| (x - mean_cop_x).powi(2)).sum::<f64>() / cop_x.len() as f64;
let variance_y = cop_y.iter().map(|y| (y - mean_cop_y).powi(2)).sum::<f64>() / cop_y.len() as f64;
let sigma_x = variance_x.sqrt();
let sigma_y = variance_y.sqrt();

// Calculate correlation coefficient
let covariance = cop_x.iter()
    .zip(cop_y.iter())
    .map(|(x, y)| (x - mean_cop_x) * (y - mean_cop_y))
    .sum::<f64>() / cop_x.len() as f64;
let r = covariance / (sigma_x * sigma_y);

let area_95 = PI * 2.45 * sigma_x * sigma_y * (1.0 - r * r).sqrt();
```

**Where:**
- `sigma_x` = standard deviation of cop_x
- `sigma_y` = standard deviation of cop_y  
- `r` = correlation coefficient between cop_x and cop_y

### Convex Hull Area
Calculate the area of the smallest convex polygon containing all COP points.

---

## 7. Frequency Domain Analysis

### Regular Sampling - Power Spectral Density
```rust
// Using rustfft crate for FFT computation
use rustfft::{FftPlanner, num_complex::Complex};

fn compute_psd(data: &[f64]) -> Vec<f64> {
    let mut planner = FftPlanner::new();
    let fft = planner.plan_fft_forward(data.len());
    
    let mean = data.iter().sum::<f64>() / data.len() as f64;
    let mut input: Vec<Complex<f64>> = data.iter()
        .map(|&x| Complex::new(x - mean, 0.0))
        .collect();
    
    fft.process(&mut input);
    
    input.iter().map(|c| c.norm_sqr()).collect()
}

let psd_x = compute_psd(&cop_x);
let psd_y = compute_psd(&cop_y);
```

### Irregular Sampling - Lomb-Scargle Periodogram
```rust
// Implementation of Lomb-Scargle periodogram
fn lomb_scargle(times: &[f64], values: &[f64], frequencies: &[f64]) -> Vec<f64> {
    let n = values.len() as f64;
    let mean_val = values.iter().sum::<f64>() / n;
    let variance = values.iter().map(|v| (v - mean_val).powi(2)).sum::<f64>() / n;
    
    frequencies.iter().map(|&freq| {
        let omega = 2.0 * std::f64::consts::PI * freq;
        
        let tau = {
            let sum_sin2 = times.iter().map(|&t| (2.0 * omega * t).sin()).sum::<f64>();
            let sum_cos2 = times.iter().map(|&t| (2.0 * omega * t).cos()).sum::<f64>();
            (sum_sin2 / sum_cos2).atan() / (2.0 * omega)
        };
        
        let cos_sum: f64 = times.iter().zip(values.iter())
            .map(|(&t, &v)| (v - mean_val) * (omega * (t - tau)).cos())
            .sum();
        let sin_sum: f64 = times.iter().zip(values.iter())
            .map(|(&t, &v)| (v - mean_val) * (omega * (t - tau)).sin())
            .sum();
            
        let cos2_sum: f64 = times.iter()
            .map(|&t| (omega * (t - tau)).cos().powi(2))
            .sum();
        let sin2_sum: f64 = times.iter()
            .map(|&t| (omega * (t - tau)).sin().powi(2))
            .sum();
            
        0.5 * ((cos_sum.powi(2) / cos2_sum) + (sin_sum.powi(2) / sin2_sum)) / variance
    }).collect()
}

let mean_fs = 1.0 / (timestamps.windows(2).map(|w| w[1] - w[0]).sum::<f64>() / (timestamps.len() - 1) as f64);
let freqs = linspace(0.1, mean_fs / 2.0, 1000);
let psd_x = lomb_scargle(&timestamps, &cop_x, &freqs);
let psd_y = lomb_scargle(&timestamps, &cop_y, &freqs);
```

### Center of Spectrum
```rust
let f_center_x = freqs.iter().zip(psd_x.iter())
    .map(|(f, p)| f * p)
    .sum::<f64>() / psd_x.iter().sum::<f64>();
    
let f_center_y = freqs.iter().zip(psd_y.iter())
    .map(|(f, p)| f * p)
    .sum::<f64>() / psd_y.iter().sum::<f64>();
```

### Mean Power Frequency
```rust
let mpf_x = freqs.iter().zip(psd_x.iter())
    .map(|(f, p)| f * p)
    .sum::<f64>() / psd_x.iter().sum::<f64>();
    
let mpf_y = freqs.iter().zip(psd_y.iter())
    .map(|(f, p)| f * p)
    .sum::<f64>() / psd_y.iter().sum::<f64>();
```

---

## 8. Detrended Fluctuation Analysis (DFA)

### Regular Sampling DFA

#### Step 1: Integration
```rust
let mut y_x = Vec::new();
let mut y_y = Vec::new();
let mut cumsum_x = 0.0;
let mut cumsum_y = 0.0;

for (i, (&cop_x_val, &cop_y_val)) in cop_x.iter().zip(cop_y.iter()).enumerate() {
    if i == 0 {
        y_x.push(0.0);
        y_y.push(0.0);
    } else {
        cumsum_x += cop_x_val - mean_cop_x;
        cumsum_y += cop_y_val - mean_cop_y;
        y_x.push(cumsum_x);
        y_y.push(cumsum_y);
    }
}
```

#### Step 2: Fluctuation Function
```rust
fn linear_detrend(data: &[f64]) -> Vec<f64> {
    let n = data.len() as f64;
    let x_mean = (n - 1.0) / 2.0;
    let y_mean = data.iter().sum::<f64>() / n;
    
    let slope = data.iter().enumerate()
        .map(|(i, &y)| (i as f64 - x_mean) * (y - y_mean))
        .sum::<f64>() / data.iter().enumerate()
        .map(|(i, _)| (i as f64 - x_mean).powi(2))
        .sum::<f64>();
    
    data.iter().enumerate()
        .map(|(i, &y)| y - (y_mean + slope * (i as f64 - x_mean)))
        .collect()
}

fn fluctuation_function(y: &[f64], window_size: usize) -> f64 {
    let n_windows = y.len() / window_size;
    let mut total_variance = 0.0;
    
    for i in 0..n_windows {
        let start = i * window_size;
        let end = (i + 1) * window_size;
        let window = &y[start..end];
        
        let detrended = linear_detrend(window);
        let variance = detrended.iter().map(|x| x.powi(2)).sum::<f64>();
        total_variance += variance;
    }
    
    (total_variance / (n_windows * window_size) as f64).sqrt()
}

// For window size n:
let f_x_n = fluctuation_function(&y_x, n);
let f_y_n = fluctuation_function(&y_y, n);
```

#### Step 3: Scaling Exponents
```rust
fn calculate_scaling_exponent(window_sizes: &[usize], fluctuations: &[f64]) -> f64 {
    let n = window_sizes.len() as f64;
    let log_n: Vec<f64> = window_sizes.iter().map(|&w| (w as f64).ln()).collect();
    let log_f: Vec<f64> = fluctuations.iter().map(|&f| f.ln()).collect();
    
    let x_mean = log_n.iter().sum::<f64>() / n;
    let y_mean = log_f.iter().sum::<f64>() / n;
    
    let numerator = log_n.iter().zip(log_f.iter())
        .map(|(x, y)| (x - x_mean) * (y - y_mean))
        .sum::<f64>();
        
    let denominator = log_n.iter()
        .map(|x| (x - x_mean).powi(2))
        .sum::<f64>();
    
    numerator / denominator
}

// Calculate for multiple window sizes
let window_sizes: Vec<usize> = (5..=25).collect(); // Short-term
let fluctuations_x: Vec<f64> = window_sizes.iter().map(|&n| fluctuation_function(&y_x, n)).collect();
let fluctuations_y: Vec<f64> = window_sizes.iter().map(|&n| fluctuation_function(&y_y, n)).collect();

let alpha_x = calculate_scaling_exponent(&window_sizes, &fluctuations_x);
let alpha_y = calculate_scaling_exponent(&window_sizes, &fluctuations_y);
```

#### Scaling Regions
- **Short-term**: n = 5-25 samples (0.16-0.82s at 30Hz)
- **Long-term**: n = 65-355 samples (2.15-11.85s at 30Hz)

### Irregular Sampling DFA
Use time-based windows instead of sample-based:
- Define window sizes in seconds (0.16 to 11.85s)
- Find segments based on time duration
- Apply detrending within time windows
- Calculate fluctuation for each time-based segment

---

## 9. Weight Distribution Metrics

### Asymmetry Indices
```rust
let lr_asymmetry = ((tr + br) - (tl + bl)) / total_weight * 100.0;
let fb_asymmetry = ((tr + tl) - (br + bl)) / total_weight * 100.0;
```

### Individual Sensor Percentages
```rust
let tr_percent = tr / total_weight * 100.0;
let tl_percent = tl / total_weight * 100.0;
let br_percent = br / total_weight * 100.0;
let bl_percent = bl / total_weight * 100.0;
```

---

## 10. Advanced Metrics

### Jerk (Rate of Change of Acceleration)
```rust
let mut jerk_x = Vec::new();
let mut jerk_y = Vec::new();

for i in 2..(cop_x.len() - 1) {
    let jerk_x_val = (cop_x[i + 1] - 3.0 * cop_x[i] + 3.0 * cop_x[i - 1] - cop_x[i - 2]) / dt.powi(3);
    let jerk_y_val = (cop_y[i + 1] - 3.0 * cop_y[i] + 3.0 * cop_y[i - 1] - cop_y[i - 2]) / dt.powi(3);
    
    jerk_x.push(jerk_x_val);
    jerk_y.push(jerk_y_val);
}
```

### Romberg Quotient (Eyes Open vs Eyes Closed)
```rust
let romberg_rms = rms_eyes_closed / rms_eyes_open;
let romberg_velocity = mv_eyes_closed / mv_eyes_open;
```

---

## 11. Testing Protocols

### Standard Testing Positions

#### 1. Normal Standing (NS)
- **Setup**: Feet 20cm apart, parallel
- **Duration**: 30 seconds
- **Conditions**: Eyes open (EO) and eyes closed (EC)

#### 2. Semi-Tandem Position (ST)
- **Setup**: One foot in front, feet on both sides of midline
- **Duration**: 20 seconds each
- **Conditions**: 
  - Dominant foot in front (SDF)
  - Non-dominant foot in front (SNF)

#### 3. Tandem Position (TP)
- **Setup**: One foot directly ahead of other
- **Duration**: 20 seconds each
- **Conditions**:
  - Dominant foot in front (TDF)
  - Non-dominant foot in front (TNF)

#### 4. One-Leg Standing (1L)
- **Setup**: Standing on dominant limb, other foot at mid-calf level
- **Duration**: 20 seconds each
- **Conditions**: Eyes open (1EO) and eyes closed (1EC)

---

## 12. Implementation Notes

### Reliability Considerations

#### Excellent reliability (ICC: 0.953-0.998)
- AP direction, long-term DFA scaling

#### Lower reliability (ICC: 0.352-0.877)
- ML direction, short-term DFA scaling

> **Recommendation**: Focus on AP direction and long-term scaling regions for critical analyses

### Technical Specifications
- **Sampling Rate**: 30 Hz (dt = 1/30 = 0.0333 seconds)
- **Coordinate System**: Define consistently (typically: +X = right, +Y = forward)
- **Units**: Ensure pressure units are consistent (Newtons or kg)
- **Board Dimensions**: Verify actual dimensions for your specific WBB model

### Data Quality
- Perform multiple trials (typically 3) and average results
- Maintain consistent environmental conditions
- Test at same time of day when possible
- Ensure proper calibration before each session

### Robust Processing Pipeline

1. **Raw 4-sensor data** → COP calculation
2. **Assess timing quality** and generate quality flags
3. **Apply appropriate preprocessing**:
   - High jitter: Interpolate to regular grid
   - Missing samples: Gap filling with spline interpolation
   - Minor jitter: Timestamp smoothing
4. **Calculate metrics** using appropriate methods:
   - Robust methods for irregular sampling
   - Standard methods for good quality data
5. **Apply quality control filters**
6. **Calculate specialized metrics** as needed
7. **Report quality metrics** alongside balance metrics

### Quality-Based Processing Decisions

#### For high jitter or missing samples:
```rust
if high_jitter || missing_samples {
    // Use interpolation to regular grid (30 Hz)
    interpolate_to_regular_grid(30.0);
} else if jitter_percentage > 5.0 {
    // Use timestamp smoothing
    apply_timestamp_smoothing();
} else {
    // Use data as-is
}
```

#### For analysis methods:
```rust
if high_jitter {
    // Use robust velocity calculation methods
    use_robust_velocity_calculation();
    // Use Lomb-Scargle periodogram for frequency analysis
    use_lomb_scargle_periodogram();
    // Use time-based DFA windows
    use_time_based_dfa_windows();
} else {
    // Use standard calculation methods
    use_standard_methods();
}
```

---

## References

Based on research protocols from:
- Dunsky et al. (2017) - Balance Performance Is Task Specific in Older Adults
- Meade et al. (2020) - Comparison of portable balance board for measures of persistence
- Ha et al. (2014) - Reliability of Good Balance System for postural sway measurement
- Stawicki et al. (2021) - Does Regular Dancing Improve Static Balance?

---

## Notes

> **Important**: This guide provides the mathematical framework for WBB data analysis. Actual implementation should include proper error handling, data validation, and consideration of specific research requirements. Always assess data quality first and choose appropriate processing methods based on the quality metrics.

### For severely compromised data (multiple quality flags), consider:
- Excluding the trial from analysis
- Using only the most reliable metrics (AP long-term DFA)
- Reporting quality limitations with results