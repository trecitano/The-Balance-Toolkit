fn main() {
    println!("cargo:rerun-if-changed=build.rs");
    // The lsl-sys build script links `bcrypt` on Windows but not the multimedia
    // timer and IP helper libraries that liblsl also calls, so any binary that
    // links the core without the Tauri shell fails with unresolved externals.
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows") {
        println!("cargo:rustc-link-lib=dylib=winmm");
        println!("cargo:rustc-link-lib=dylib=iphlpapi");
    }
}
