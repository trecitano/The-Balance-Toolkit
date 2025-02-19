# Tauri Development Environment Setup Guide

This guide walks you through setting up a complete development environment for Tauri with Rust.

## System Requirements

### Windows
- Windows 10/11
- PowerShell or Command Prompt with administrator privileges

### macOS
- macOS 10.15 or later
- Terminal access
- Homebrew (recommended)

## Step 1: Install Node.js
Download and install Node.js LTS version from https://nodejs.org/

## Step 2: Install Rust

### Windows
1. Download the Rust installer:
   - Visit https://rustup.rs/
   - Download and run `rustup-init.exe`
   - Follow the installation prompts

2. Install Microsoft Visual Studio C++ Build Tools:
   - Download from: https://visualstudio.microsoft.com/visual-cpp-build-tools/
   - Install "Desktop development with C++"
   - This may require a system restart

3. Install WebView2:
   - Download from: https://developer.microsoft.com/en-us/microsoft-edge/webview2/

### macOS
1. Open Terminal and run:
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```
2. Install Xcode Command Line Tools:
```bash
xcode-select --install
```

## Step 3: Verify Installations

Run these commands to verify your installations:

```bash
# Check Rust
rustc --version
cargo --version

# Check Node.js
node --version
npm --version
```

## Step 4: Create a New Tauri Project

1. Create a new project:
```bash
npm create tauri-app
```

2. Follow the prompts:
- ✔ Project name · balance-toolkit-app
- ✔ Identifier · React
- ✔ Choose which language to use for your frontend · TypeScript / JavaScript - (pnpm, yarn, npm, deno, bun)
- ✔ Choose your package manager · npm
- ✔ Choose your UI template · React - (https://react.dev/)
- ✔ Choose your UI flavor · TypeScript

3. Navigate to the project and install dependencies:
```bash
cd balance-toolkit-app
npm install
```

## Running Your Application

Development mode:
```bash
npm run tauri dev
```

Build for production:
```bash
npm run tauri build
```

## Troubleshooting

### Common Issues

1. Rust Build Failures
   - Ensure all Visual Studio components are properly installed (Windows)
   - Check that Xcode Command Line Tools are installed (macOS)
   - Try running `rustup update`

2. WebView2 Issues (Windows)
   - Reinstall WebView2 Runtime
   - Check system environment variables

3. Build Issues
   - Check that all dependencies are installed
   - Try cleaning and rebuilding:
     ```bash
     npm run tauri clean
     npm run dev
     ```

### Getting Help

- Tauri Discord: https://discord.com/invite/tauri
- Rust Forum: https://users.rust-lang.org

## Additional Resources

- [Tauri Official Documentation](https://tauri.app/v1/guides/)
- [Rust Documentation](https://www.rust-lang.org/learn)

## License

[MIT License](LICENSE)