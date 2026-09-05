use chrono::{DateTime, TimeDelta, Utc};
use serde::Deserialize;
use std::time::Duration;
use toolkit_core::actors::balance_board_actor::BalanceBoardCalibratedReading;
use toolkit_core::processing::board_hid_reader_mock::MockBoardGen;

#[derive(Deserialize)]
struct Case {
    name: String,
    reading: [f32; 4],
    tare: [f32; 4],
    expected: [f32; 4],
    weight: f32,
    cop: [f32; 2],
}

fn reading(values: [f32; 4]) -> BalanceBoardCalibratedReading {
    BalanceBoardCalibratedReading {
        timestamp: DateTime::<Utc>::from_timestamp(1_700_000_000, 0).unwrap(),
        mac_address: 0x37fea12bfdf4,
        top_right: values[0],
        bottom_right: values[1],
        top_left: values[2],
        bottom_left: values[3],
    }
}

#[test]
fn shared_sensor_fixtures_preserve_tare_weight_and_cop() {
    let cases: Vec<Case> =
        serde_json::from_str(include_str!("../../../tests/fixtures/sensors.json")).unwrap();
    assert!(!cases.is_empty());
    for case in cases {
        let original = reading(case.reading);
        let result = original.apply_tare(&reading(case.tare));
        assert_eq!(
            [
                result.top_right,
                result.bottom_right,
                result.top_left,
                result.bottom_left
            ],
            case.expected,
            "{}",
            case.name
        );
        assert_eq!(result.timestamp, original.timestamp);
        assert_eq!(result.mac_address, original.mac_address);
        assert!((case.expected.iter().sum::<f32>() - case.weight).abs() < 1e-5);
        let cop = result.calculate_cop();
        assert!((cop.x - case.cop[0]).abs() < 1e-5, "{}: x", case.name);
        assert!((cop.y - case.cop[1]).abs() < 1e-5, "{}: y", case.name);
    }
}

#[test]
fn near_zero_load_does_not_divide_by_a_tiny_weight() {
    let cop = reading([0.01, 0.0, 0.0, 0.0]).calculate_cop();
    assert_eq!((cop.x, cop.y), (0.0, 0.0));
}

#[test]
fn seeded_mock_is_independent_of_wall_clock_and_sample_order() {
    let first = MockBoardGen::seeded(42, 7);
    let second = MockBoardGen::seeded(42, 7);
    let other = MockBoardGen::seeded(42, 8);
    let start = reading([0.0; 4]).timestamp;
    for millis in [0, 10, 250, 1000, 10] {
        let timestamp = start + TimeDelta::milliseconds(millis);
        let a = first.sample_at(Duration::from_millis(millis as u64), timestamp);
        let b = second.sample_at(Duration::from_millis(millis as u64), timestamp);
        assert_eq!(a.to_byte_array(), b.to_byte_array());
        assert_eq!(a.timestamp, timestamp);
        assert_eq!(a.mac_address, 42);
        assert!(
            [a.top_right, a.bottom_right, a.top_left, a.bottom_left]
                .iter()
                .all(|v| v.is_finite() && *v >= 0.0)
        );
    }
    assert_ne!(
        first.sample_at(Duration::ZERO, start).to_byte_array(),
        other.sample_at(Duration::ZERO, start).to_byte_array()
    );
}
