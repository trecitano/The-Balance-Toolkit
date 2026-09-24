use super::*;

fn point(millis: i64, x: f32, y: f32) -> CenterOfPressurePoint {
    CenterOfPressurePoint {
        timestamp: DateTime::from_timestamp_millis(1_700_000_000_000 + millis).unwrap(),
        x,
        y,
        z: 80.0,
    }
}

fn close(actual: f32, expected: f32) {
    assert!((actual - expected).abs() < 1e-5, "{actual} != {expected}");
}

#[test]
fn stationary_load_has_no_sway_or_dynamic_instability() {
    let points: Vec<_> = (0..10).map(|i| point(i * 100, 0.0, 0.0)).collect();
    let sway = calculate_basic_sway_metrics(&points).unwrap();
    close(sway.v_cop_x, 0.0);
    close(sway.v_cop_y, 0.0);
    close(sway.total_path_length, 0.0);
    close(
        calculate_dpsi_metrics(&points, Some(80.0)).unwrap().dpsi,
        0.0,
    );
}

#[test]
fn known_motion_has_velocity_in_normalized_units_per_second() {
    let points = [
        point(0, -0.5, 0.0),
        point(500, 0.0, 0.0),
        point(1000, 0.5, 0.0),
    ];
    let sway = calculate_basic_sway_metrics(&points).unwrap();
    close(sway.v_cop_x, 1.0);
    close(sway.v_cop_y, 0.0);
    close(sway.total_path_length, 1.0);
    close(sway.mean_velocity, 1.0);
}

#[test]
fn uneven_intervals_preserve_average_velocity_and_velocity_moment() {
    let points = [
        point(0, 0.0, 0.0),
        point(1000, 1.0, 0.0),
        point(1000, 1.0, 0.0), // A duplicate timestamp contributes no interval.
        point(3000, 1.0, 2.0),
        point(3500, 0.0, 2.0),
    ];
    let sway = calculate_basic_sway_metrics(&points).unwrap();
    close(sway.v_cop_x, 1.0);
    close(sway.v_cop_y, 1.0 / 3.0);
    close(sway.mean_velocity, 4.0 / 3.0);
    close(sway.total_path_length, 4.0);
    close(sway.velocity_moment, 4.0 / 3.5);
}

#[test]
fn interpolation_preserves_linear_motion_and_timestamps() {
    let points = [point(0, -0.5, 0.0), point(1000, 0.5, 1.0)];
    for interpolate in [
        linear_interpolation,
        cubic_interpolation,
        polynomial_interpolation,
    ] {
        let result = interpolate(
            &points,
            points[0].timestamp,
            points[1].timestamp,
            &TimeDelta::milliseconds(250),
        );
        assert_eq!(result.len(), 5);
        for (i, p) in result.iter().enumerate() {
            close(p.x, -0.5 + i as f32 * 0.25);
            close(p.y, i as f32 * 0.25);
            close(p.z, 80.0);
            assert_eq!(
                p.timestamp,
                points[0].timestamp + TimeDelta::milliseconds(i as i64 * 250)
            );
        }
    }
}

#[test]
fn insufficient_or_duplicate_timestamps_do_not_produce_velocity() {
    assert!(calculate_basic_sway_metrics(&[]).is_none());
    assert!(calculate_basic_sway_metrics(&[point(0, 0.0, 0.0)]).is_none());
    assert!(calculate_basic_sway_metrics(&[point(0, 0.0, 0.0), point(0, 1.0, 0.0)]).is_none());
}

#[test]
fn fft_recovers_known_frequency_and_amplitude_after_reusing_its_state() {
    let mut state = SpectrumState::default();
    // 10 ms samples: 100 points give 1 Hz bins, 200 points give 0.5 Hz bins. A 1 Hz sine
    // lands exactly on a bin either way, so its amplitude must come back unattenuated. The
    // offset checks that the mean is removed before windowing.
    for count in [100, 200, 100] {
        let points: Vec<_> = (0..count)
            .map(|i| {
                point(
                    i * 10,
                    12.0 + 3.0 * (2.0 * PI * i as f32 / 100.0).sin(),
                    0.0,
                )
            })
            .collect();
        let spectrum = compute_fft_amplitude_spectrum(&points, 2.0, &mut state).unwrap();
        let peak = spectrum
            .amplitude_x
            .iter()
            .enumerate()
            .max_by(|a, b| a.1.total_cmp(b.1))
            .unwrap()
            .0;
        close(spectrum.freqs_hz[peak], 1.0);
        assert!(
            (spectrum.amplitude_x[peak] - 3.0).abs() < 1e-3,
            "peak amplitude {} != 3.0 mm",
            spectrum.amplitude_x[peak]
        );
        assert!(
            spectrum.amplitude_x[0].abs() < 1e-3,
            "DC leaked: {}",
            spectrum.amplitude_x[0]
        );
        assert!(spectrum.amplitude_y.iter().all(|value| value.abs() < 1e-5));
        for (x, xy) in spectrum.amplitude_x.iter().zip(&spectrum.amplitude_xy) {
            close(*x, *xy);
        }
    }
}

#[test]
fn readings_are_converted_to_millimetres_using_half_board_sizes() {
    let settings = ProcessingSettings {
        balance_board_x_size: 400.0,
        balance_board_y_size: 200.0,
        ..ProcessingSettings::default()
    };
    let scale = BoardScale::from_settings(&settings);
    // Left sensors carry 30 kg, right sensors 10 kg: normalised CoP x = -0.5.
    // Front sensors carry 30 kg, back sensors 10 kg: normalised CoP y = +0.5.
    let reading = BalanceBoardCalibratedReading {
        timestamp: DateTime::from_timestamp_millis(1_700_000_000_000).unwrap(),
        mac_address: 0,
        top_right: 5.0,
        bottom_right: 5.0,
        top_left: 25.0,
        bottom_left: 5.0,
    };
    let cop = balance_board_reading_to_cop(reading, scale);
    close(cop.x, -0.5 * 200.0);
    close(cop.y, 0.5 * 100.0);
    close(cop.z, 40.0);
}

#[test]
fn area_polygons_are_reported_in_normalized_board_coordinates() {
    let settings = ProcessingSettings {
        balance_board_x_size: 400.0,
        balance_board_y_size: 200.0,
        ..ProcessingSettings::default()
    };
    let scale = BoardScale::from_settings(&settings);
    // A circle of radius 50 mm in the millimetre frame.
    let points: Vec<_> = (0..64)
        .map(|i| {
            let t = 2.0 * PI * i as f32 / 64.0;
            point(i * 10, 50.0 * t.cos(), 50.0 * t.sin())
        })
        .collect();
    let area = calculate_area_metrics(&points, scale).unwrap();
    // The hull touches x = ±50 mm and y = ±50 mm, which is ±0.25 and ±0.5 when normalised.
    let max_x = area
        .convex_hull_polygon
        .iter()
        .map(|p| p.0)
        .fold(f32::MIN, f32::max);
    let max_y = area
        .convex_hull_polygon
        .iter()
        .map(|p| p.1)
        .fold(f32::MIN, f32::max);
    assert!((max_x - 0.25).abs() < 1e-3, "{max_x}");
    assert!((max_y - 0.5).abs() < 1e-3, "{max_y}");
    // The ellipse of a circular cloud has equal semi-axes in millimetres, so the normalised
    // outline is twice as tall as it is wide.
    let ell_x = area
        .confidence_ellipse_polygon
        .iter()
        .map(|p| p.0)
        .fold(f32::MIN, f32::max);
    let ell_y = area
        .confidence_ellipse_polygon
        .iter()
        .map(|p| p.1)
        .fold(f32::MIN, f32::max);
    assert!((ell_y / ell_x - 2.0).abs() < 1e-2, "{ell_x} {ell_y}");
}

#[test]
fn dpsi_vertical_term_is_a_fraction_of_the_baseline_weight() {
    let mut points: Vec<_> = (0..4).map(|i| point(i * 10, 3.0, 4.0)).collect();
    // Load alternates 10% above and below the baseline.
    for (i, p) in points.iter_mut().enumerate() {
        p.z = if i % 2 == 0 { 88.0 } else { 72.0 };
    }
    let dpsi = calculate_dpsi_metrics(&points, Some(80.0)).unwrap();
    close(dpsi.mlsi, 3.0);
    close(dpsi.apsi, 4.0);
    close(dpsi.vsi, 0.1);
    close(dpsi.dpsi, (9.0_f32 + 16.0 + 0.01).sqrt());
}

#[test]
fn dpsi_is_undefined_for_an_empty_board() {
    let mut points: Vec<_> = (0..4).map(|i| point(i * 10, 0.0, 0.0)).collect();
    points.iter_mut().for_each(|p| p.z = 0.0);
    assert!(calculate_dpsi_metrics(&points, None).is_none());
    assert!(calculate_dpsi_metrics(&points, Some(0.0)).is_none());
}
