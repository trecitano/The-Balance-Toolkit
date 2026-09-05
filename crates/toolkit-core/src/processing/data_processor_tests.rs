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
fn fft_finds_known_frequency_after_reusing_its_state() {
    let mut state = SpectrumState::default();
    for count in [100, 200, 100] {
        let points: Vec<_> = (0..count)
            .map(|i| point(i * 10, (2.0 * PI * i as f32 / 100.0).sin(), 0.0))
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
        assert!(spectrum.amplitude_y.iter().all(|value| value.abs() < 1e-5));
    }
}
