use std::path::Path;
use std::time::Duration;
use toolkit_core::file_system::ExistingSessionFileSystem;
use toolkit_core::processing::file_writer::SessionConfigurationFileFormat;

const SETTINGS: &str =
    include_str!("../../../tests/fixtures/recording/tbt-2024-01-01T00-00-00.settings.json");

#[test]
fn recorded_settings_load_without_losing_fields_or_precision() {
    let path = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../tests/fixtures/recording/tbt-2024-01-01T00-00-00.settings.json");
    let session = ExistingSessionFileSystem::load(&path).unwrap();
    assert_eq!(session.user.name, "Fixture User");
    assert_eq!(session.session_stats.duration, Duration::from_secs(1));
    assert_eq!(session.device_names.len(), 1);
    let original: serde_json::Value = serde_json::from_str(SETTINGS).unwrap();
    assert_eq!(serde_json::to_value(&session).unwrap(), original);
}

#[test]
fn malformed_settings_are_rejected() {
    let mut document: serde_json::Value = serde_json::from_str(SETTINGS).unwrap();
    document["session_stats"]["duration"] = serde_json::json!("one second");
    assert!(serde_json::from_value::<SessionConfigurationFileFormat>(document).is_err());
}
