fn main() {
    #[cfg(target_os = "macos")]
    {
        println!("cargo:warning=➡️ Detected macOS. Building macos-wii-balance-pair...");

        let profile = std::env::var("PROFILE").unwrap_or_else(|_| "debug".to_string());
        let mut args = vec!["build"];

        if profile == "release" {
            args.push("--release");
        }

        let status = std::process::Command::new("cargo")
            .args(&args)
            .current_dir("../macos-wii-balance-pair")
            .status()
            .expect("Failed to execute cargo build for macos-wii-balance-pair");

        if !status.success() {
            panic!("macos-wii-balance-pair build failed");
        }
    }

    tauri_build::build()
}
