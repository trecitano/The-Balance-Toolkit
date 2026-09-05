use serde_json::{Value, json};
use std::fs::{self, File};
use std::path::{Path, PathBuf};
use std::process::{Command, Output, Stdio};
use std::time::{Duration, Instant};
use tempfile::TempDir;
use toolkit_core::processing::file_writer::SessionConfigurationFileFormat;
use toolkit_core::types::GeneralSettings;

const BOARD: &str = "37:fe:a1:2b:fd:f4";

struct Sandbox {
    directory: TempDir,
}

impl Sandbox {
    fn new() -> Self {
        let directory = tempfile::tempdir().unwrap();
        let settings = GeneralSettings {
            is_demo_mode: true,
            store_files_default_directory: directory.path().join("sessions"),
            ..GeneralSettings::default()
        };
        fs::write(
            directory.path().join("settings.json"),
            serde_json::to_vec_pretty(&settings).unwrap(),
        )
        .unwrap();
        Self { directory }
    }

    fn path(&self) -> &Path {
        self.directory.path()
    }

    fn run(&self, args: &[&str]) -> Output {
        // Files avoid a full stdout pipe deadlocking the child during a sample stream.
        let stdout = self.path().join("stdout.log");
        let stderr = self.path().join("stderr.log");
        let mut child = Command::new(env!("CARGO_BIN_EXE_tbt"))
            .args(args)
            .env("TBT_APP_DIR", self.path())
            .env("TBT_LOG", "warn")
            .stdin(Stdio::null())
            .stdout(File::create(&stdout).unwrap())
            .stderr(File::create(&stderr).unwrap())
            .spawn()
            .unwrap();
        let deadline = Instant::now() + Duration::from_secs(25);
        let status = loop {
            if let Some(status) = child.try_wait().unwrap() {
                break status;
            }
            if Instant::now() > deadline {
                let _ = child.kill();
                let _ = child.wait();
                panic!(
                    "tbt {args:?} timed out:\n{}",
                    fs::read_to_string(&stderr).unwrap()
                );
            }
            std::thread::sleep(Duration::from_millis(20));
        };
        Output {
            status,
            stdout: fs::read(stdout).unwrap(),
            stderr: fs::read(stderr).unwrap(),
        }
    }

    fn succeeds(&self, args: &[&str]) -> Output {
        let output = self.run(args);
        assert!(
            output.status.success(),
            "tbt {args:?}: {}",
            String::from_utf8_lossy(&output.stderr)
        );
        output
    }

    fn recording(&self, directory: &Path) -> (PathBuf, SessionConfigurationFileFormat) {
        let files: Vec<_> = fs::read_dir(directory)
            .unwrap()
            .map(|e| e.unwrap().path())
            .filter(|path| path.to_string_lossy().ends_with(".settings.json"))
            .collect();
        assert_eq!(
            files.len(),
            1,
            "Expected one complete recording in {directory:?}"
        );
        let session: SessionConfigurationFileFormat =
            serde_json::from_slice(&fs::read(&files[0]).unwrap()).unwrap();
        assert!(session.session_stats.duration > Duration::ZERO);
        for mapping in session.device_file_mappings.values() {
            let csv = fs::read_to_string(directory.join(&mapping.raw_file_name)).unwrap();
            assert!(
                csv.lines().count() > 1,
                "Raw recording must contain samples"
            );
            assert_eq!(
                csv.lines().next(),
                Some("timestamp,top_right,bottom_right,top_left,bottom_left")
            );
            assert!(directory.join(&mapping.processed_file_name).is_file());
        }
        (files[0].clone(), session)
    }
}

fn events(output: &Output) -> Vec<Value> {
    String::from_utf8_lossy(&output.stdout)
        .lines()
        .map(|line| serde_json::from_str(line).expect("stdout must contain only JSON Lines"))
        .collect()
}

#[test]
fn mock_recording_and_replay_finish_with_valid_files() {
    let sandbox = Sandbox::new();
    let devices: Value =
        serde_json::from_slice(&sandbox.succeeds(&["--json", "devices", "list"]).stdout).unwrap();
    assert!(
        devices
            .as_array()
            .unwrap()
            .iter()
            .any(|d| d["isConnected"] == true)
    );
    let output = sandbox.succeeds(&[
        "session",
        "run",
        BOARD,
        "--duration",
        "2",
        "--live",
        "samples",
    ]);
    let events = events(&output);
    let raw: Vec<_> = events.iter().filter(|e| e["event"] == "raw").collect();
    assert!(!raw.is_empty());
    assert!(events.iter().any(|e| e["event"] == "processed"));
    assert!(
        raw.windows(2)
            .all(|pair| pair[0]["timestampMicros"].as_i64() <= pair[1]["timestampMicros"].as_i64())
    );
    assert!(
        raw.iter()
            .all(|e| e["macAddress"] == BOARD && e["weightKg"].as_f64().unwrap() > 0.0)
    );
    let (settings, _) = sandbox.recording(&sandbox.path().join("sessions"));
    let replay_output = sandbox.path().join("replay");
    sandbox.succeeds(&[
        "replay",
        "run",
        settings.to_str().unwrap(),
        "--output",
        replay_output.to_str().unwrap(),
        "--live",
        "none",
    ]);
    sandbox.recording(&replay_output);
}

#[test]
fn committed_recording_replays_the_expected_sensor_values() {
    let sandbox = Sandbox::new();
    let fixture = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../tests/fixtures/recording/tbt-2024-01-01T00-00-00.settings.json");
    let output = sandbox.succeeds(&[
        "replay",
        "run",
        fixture.to_str().unwrap(),
        "--live",
        "samples",
    ]);
    let raw: Vec<_> = events(&output)
        .into_iter()
        .filter(|e| e["event"] == "raw")
        .map(|e| {
            json!([
                e["topRight"],
                e["bottomRight"],
                e["topLeft"],
                e["bottomLeft"]
            ])
        })
        .collect();
    assert_eq!(
        raw,
        vec![
            json!([20.0, 20.0, 20.0, 20.0]),
            json!([24.0, 24.0, 16.0, 16.0]),
            json!([28.0, 28.0, 12.0, 12.0]),
            json!([24.0, 24.0, 16.0, 16.0]),
            json!([20.0, 20.0, 20.0, 20.0])
        ]
    );
    sandbox.recording(&sandbox.path().join("sessions"));
}

#[test]
fn recording_failure_returns_nonzero_instead_of_claiming_success() {
    let sandbox = Sandbox::new();
    // A slash in an accepted board name makes the CSV writer fail inside our temp directory.
    sandbox.succeeds(&["devices", "rename", BOARD, "missing-parent/board"]);
    let output = sandbox.run(&["session", "run", BOARD, "--duration", "1", "--live", "none"]);
    assert!(
        !output.status.success(),
        "Failed recording must not return exit code zero"
    );
    assert!(String::from_utf8_lossy(&output.stderr).contains("not finalised"));
    assert!(!String::from_utf8_lossy(&output.stderr).contains("panicked"));
}

#[test]
fn invalid_input_fails_without_creating_recordings() {
    let sandbox = Sandbox::new();
    let output = sandbox.run(&["settings", "set", "unknownKey", "42"]);
    assert!(!output.status.success());
    assert!(String::from_utf8_lossy(&output.stderr).contains("Unknown setting"));
    assert!(!sandbox.path().join("sessions").exists());
}
