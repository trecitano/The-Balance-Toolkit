<#
.SYNOPSIS
  The Balance Toolkit development environment setup for Windows.
.DESCRIPTION
  Checks every dependency and offers a checklist of the missing ones (all
  ticked by default) to install with winget. Run from a normal PowerShell:
    powershell -ExecutionPolicy Bypass -File setup\setup.ps1
  or, once mise is installed, from any platform: mise run setup
.PARAMETER Check
  Only report what is installed and what is missing.
.PARAMETER Yes
  Install the default selection without prompting.
.PARAMETER All
  Install everything missing, including optional items.
#>
[CmdletBinding()]
param(
  [switch]$Check,
  [switch]$Yes,
  [switch]$All
)
$ErrorActionPreference = 'Stop'
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')

function Info($m) { Write-Host "==> $m" -ForegroundColor Cyan }
function Ok($m)   { Write-Host "  [OK] $m" -ForegroundColor Green }
function Bad($m)  { Write-Host "  [--] $m" -ForegroundColor Red }
function Warn($m) { Write-Host "  [!!] $m" -ForegroundColor Yellow }

function Get-VersionFrom([string]$text) {
  if ($text -match '(\d+)\.(\d+)(\.(\d+))?') { return [version]($Matches[0] + $(if (-not $Matches[3]) { '.0' })) }
  return $null
}

function Refresh-Path {
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
              [Environment]::GetEnvironmentVariable('Path', 'User')
  foreach ($d in @("$env:LOCALAPPDATA\mise\shims", "$env:USERPROFILE\.cargo\bin", "$env:ProgramFiles\CMake\bin")) {
    if ((Test-Path $d) -and ($env:Path -notlike "*$d*")) { $env:Path = "$d;$env:Path" }
  }
}

# Run a native command and collect its stdout and stderr lines with its exit code.
# Windows PowerShell 5.1 turns anything a native command writes to stderr into a
# terminating error when that stream is redirected while $ErrorActionPreference is
# 'Stop', even if the command exits 0. Every native call whose output is captured
# or discarded goes through here so a chatty tool cannot abort the script.
function Invoke-Native([string]$Exe, [string[]]$Arguments) {
  $ErrorActionPreference = 'Continue'
  $output = @(& $Exe @Arguments 2>&1 | ForEach-Object { "$_" })
  return @{ ExitCode = $LASTEXITCODE; Output = $output }
}

function Require-Winget {
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    throw 'winget is required. Install "App Installer" from the Microsoft Store, then rerun.'
  }
}

function Winget-Install([string]$id, [string[]]$extra = @()) {
  Require-Winget
  & winget install --id $id --exact --source winget --accept-source-agreements --accept-package-agreements @extra
  $installExitCode = $LASTEXITCODE
  Refresh-Path
  if ($installExitCode -ne 0) { throw "winget install $id failed (exit $installExitCode). See the installer output above; for logs run winget --logs." }
}

# --- Checks -------------------------------------------------------------------
$script:PostNotes = @()

function Check-BuildTools {
  $vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
  if (-not (Test-Path $vswhere)) { return @{ Ok = $false; Detail = 'Visual Studio Installer not found' } }
  $r = Invoke-Native $vswhere @('-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath', '-latest')
  $path = $r.Output | Where-Object { $_ } | Select-Object -First 1
  if ($r.ExitCode -eq 0 -and $path) { return @{ Ok = $true; Detail = $path } }
  return @{ Ok = $false; Detail = '"Desktop development with C++" workload not installed' }
}
function Install-BuildTools {
  Winget-Install 'Microsoft.VisualStudio.2022.BuildTools' @('--override',
    '--quiet --wait --norestart --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended')
  $script:PostNotes += 'Visual Studio Build Tools were installed. A reboot may be required before building.'
}

function Check-WebView2 {
  $keys = @(
    'HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}',
    'HKLM:\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}',
    'HKCU:\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}')
  foreach ($k in $keys) {
    $v = (Get-ItemProperty -Path $k -ErrorAction SilentlyContinue).pv
    if ($v) { return @{ Ok = $true; Detail = "WebView2 $v" } }
  }
  return @{ Ok = $false; Detail = 'WebView2 runtime not found' }
}
function Install-WebView2 { Winget-Install 'Microsoft.EdgeWebView2Runtime' }

function Check-Mise {
  $m = Get-Command mise -ErrorAction SilentlyContinue
  if (-not $m) { return @{ Ok = $false; Detail = 'mise not found' } }
  $r = Invoke-Native mise @('--version')
  return @{ Ok = $true; Detail = "mise $(Get-VersionFrom ($r.Output -join "`n"))" }
}
function Install-Mise {
  Winget-Install 'jdx.mise'
}

# Tools declared in the repository mise.toml that are not installed at the pinned version.
function Get-MissingTools {
  Push-Location $RepoRoot
  try {
    $missing = @()
    foreach ($l in (Invoke-Native mise @('ls', '--missing')).Output) {
      if ($l -match '^(\S+)\s+(\S+)\s+\(missing\)' -and $l -like '*mise.toml*') { $missing += "$($Matches[1])@$($Matches[2])" }
    }
    return $missing
  } finally { Pop-Location }
}
function Check-Toolchain {
  if (-not (Get-Command mise -ErrorAction SilentlyContinue)) { return @{ Ok = $false; Detail = 'needs mise' } }
  $missing = Get-MissingTools
  if ($missing.Count -gt 0) { return @{ Ok = $false; Detail = "missing or outdated: $($missing -join ' ')" } }
  Push-Location $RepoRoot
  try {
    $bun = (Invoke-Native mise @('current', 'bun')).Output -join ''
    $rust = (Invoke-Native mise @('current', 'rust')).Output -join ''
  } finally { Pop-Location }
  return @{ Ok = $true; Detail = "bun $bun, rust $rust" }
}
function Install-Toolchain {
  if (-not (Get-Command mise -ErrorAction SilentlyContinue)) { throw 'Install mise before the toolchain.' }
  # mise installs Rust through rustup. After installing a toolchain, rustup checks
  # for a newer rustup and, on Windows, that self-updater sometimes cannot launch
  # ("unable to run updater: The system cannot find the file specified"), which
  # makes rustup exit nonzero and mise report the install as failed even though
  # the toolchain is in place. Turn the check off; `rustup self update` still works.
  if (Get-Command rustup -ErrorAction SilentlyContinue) {
    $r = Invoke-Native rustup @('set', 'auto-self-update', 'disable')
    if ($r.ExitCode -ne 0) { Warn "Could not disable rustup's self-update check; continuing: $($r.Output -join ' ')" }
  }
  Push-Location $RepoRoot
  try {
    & mise trust --quiet mise.toml
    & mise install --yes
    $installExitCode = $LASTEXITCODE
  } finally { Pop-Location }
  Refresh-Path
  if ($installExitCode -ne 0) {
    # Trust what is on disk over the exit status: a post-install step (such as
    # the rustup self-update above) can fail after every pinned tool is installed.
    $missing = Get-MissingTools
    if ($missing.Count -gt 0) { throw "mise install failed; still missing: $($missing -join ' ')" }
    Warn "mise install exited with code $installExitCode, but every tool pinned in mise.toml is installed. See the output above."
  }
}

function Check-CMake {
  $c = Get-Command cmake -ErrorAction SilentlyContinue
  if (-not $c) { return @{ Ok = $false; Detail = 'cmake not found' } }
  $r = Invoke-Native cmake @('--version')
  $version = Get-VersionFrom ($r.Output -join "`n")
  if ($r.ExitCode -ne 0 -or -not $version) { return @{ Ok = $false; Detail = 'cmake --version failed' } }
  return @{ Ok = $true; Detail = "cmake $version" }
}
function Install-CMake {
  # Select the MSI rather than a portable installer. Its manifest adds CMake to
  # the machine PATH; --silent avoids an unfinished interactive installer.
  Winget-Install 'Kitware.CMake' @('--installer-type', 'wix', '--scope', 'machine', '--silent')
}

function Check-TauriDriver {
  $t = Get-Command tauri-driver -ErrorAction SilentlyContinue
  if (-not $t) { return @{ Ok = $false; Detail = 'needed only for end-to-end tests' } }
  return @{ Ok = $true; Detail = $t.Source }
}
function Install-TauriDriver {
  if (-not (Get-Command mise -ErrorAction SilentlyContinue)) { throw 'Install mise and the toolchain before tauri-driver.' }
  Push-Location $RepoRoot
  try { & mise exec -- cargo install tauri-driver --locked } finally { Pop-Location }
  if ($LASTEXITCODE -ne 0) { throw 'cargo install tauri-driver failed' }
}

# Edge WebDriver: msedgedriver.exe must have the same major version as the
# installed Edge. Microsoft publishes the driver on its own CDN, so the script
# downloads the build that matches Edge instead of sending the user to a page.
$EdgeDriverDir = Join-Path $env:LOCALAPPDATA 'the-balance-toolkit\msedgedriver'
$EdgeDriverPage = 'https://developer.microsoft.com/en-us/microsoft-edge/tools/webdriver/'

# Edge and its driver carry four-part versions (153.0.4234.48); the driver download
# URL needs all four, so these helpers do not go through Get-VersionFrom.
function Get-FullVersionFrom([string]$text) {
  if ($text -match '\d+\.\d+\.\d+\.\d+') { return [version]$Matches[0] }
  return Get-VersionFrom $text
}
function Get-EdgeVersion {
  foreach ($exe in @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
                     "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
                     "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe")) {
    if (Test-Path $exe) { return Get-FullVersionFrom (Get-Item $exe).VersionInfo.ProductVersion }
  }
  return $null
}
function Get-EdgeDriverVersion([string]$exe) {
  $r = Invoke-Native $exe @('--version')
  if ($r.ExitCode -ne 0) { return $null }
  return Get-FullVersionFrom ($r.Output -join "`n")
}
function Check-EdgeDriver {
  $d = Get-Command msedgedriver.exe -ErrorAction SilentlyContinue
  if (-not $d) { return @{ Ok = $false; Detail = 'needed only for end-to-end tests' } }
  $edge = Get-EdgeVersion
  $driver = Get-EdgeDriverVersion $d.Source
  if ($edge -and $driver -and $edge.Major -ne $driver.Major) {
    return @{ Ok = $false; Detail = "msedgedriver $driver does not match Edge $edge ($($d.Source))" }
  }
  return @{ Ok = $true; Detail = "msedgedriver $driver, $($d.Source)" }
}
function Install-EdgeDriver {
  $edge = Get-EdgeVersion
  if (-not $edge) { throw "Microsoft Edge was not found, so the matching msedgedriver.exe cannot be chosen. Download it from $EdgeDriverPage and put it on PATH." }
  $arch = switch ($env:PROCESSOR_ARCHITECTURE) { 'ARM64' { 'arm64' } 'x86' { 'win32' } default { 'win64' } }
  [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
  # The release endpoint answers with UTF-16 text, so decode it explicitly.
  $releaseUrl = "https://msedgedriver.microsoft.com/LATEST_RELEASE_$($edge.Major)_WINDOWS"
  try {
    $bytes = (Invoke-WebRequest -UseBasicParsing -Uri $releaseUrl).Content
    $version = Get-FullVersionFrom ([Text.Encoding]::Unicode.GetString($bytes))
  } catch { throw "Could not look up the msedgedriver release for Edge $($edge.Major) at $releaseUrl ($($_.Exception.Message)). Download it from $EdgeDriverPage and put it on PATH." }
  if (-not $version) { throw "No msedgedriver release is published for Edge $($edge.Major). Download one from $EdgeDriverPage and put it on PATH." }
  Info "Edge $edge; downloading msedgedriver $version ($arch) to $EdgeDriverDir"
  $zip = Join-Path $env:TEMP "edgedriver_$arch.zip"
  try {
    Invoke-WebRequest -UseBasicParsing -Uri "https://msedgedriver.microsoft.com/$version/edgedriver_$arch.zip" -OutFile $zip
    New-Item -ItemType Directory -Force $EdgeDriverDir | Out-Null
    Expand-Archive -Path $zip -DestinationPath $EdgeDriverDir -Force
  } finally { Remove-Item $zip -ErrorAction SilentlyContinue }
  $exe = Join-Path $EdgeDriverDir 'msedgedriver.exe'
  if (-not (Test-Path $exe)) { throw "The download did not contain msedgedriver.exe (looked in $EdgeDriverDir)." }
  $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
  if (($userPath -split ';') -notcontains $EdgeDriverDir) {
    [Environment]::SetEnvironmentVariable('Path', ($userPath.TrimEnd(';') + ';' + $EdgeDriverDir), 'User')
    $script:PostNotes += "$EdgeDriverDir was added to your user PATH for msedgedriver.exe. Open a new terminal to pick it up."
  }
  if ($env:Path -notlike "*$EdgeDriverDir*") { $env:Path = "$EdgeDriverDir;$env:Path" }
  Ok "msedgedriver $(Get-EdgeDriverVersion $exe) installed. Rerun this script after Edge updates to a new major version."
}

function Check-PythonClients {
  $venv = Join-Path $RepoRoot 'scripts\.venv\Scripts\python.exe'
  if (-not (Test-Path $venv)) { return @{ Ok = $false; Detail = 'scripts\.venv not created (uv sync)' } }
  if (-not (Get-Command mise -ErrorAction SilentlyContinue)) { return @{ Ok = $false; Detail = 'needs mise' } }
  Push-Location (Join-Path $RepoRoot 'scripts')
  try { $ok = (Invoke-Native mise @('exec', '--', 'uv', 'sync', '--locked', '--check')).ExitCode -eq 0 } finally { Pop-Location }
  if (-not $ok) { return @{ Ok = $false; Detail = 'scripts\.venv is out of date with uv.lock' } }
  $py = (Get-Content (Join-Path $RepoRoot 'scripts\.python-version') -ErrorAction SilentlyContinue | Select-Object -First 1)
  return @{ Ok = $true; Detail = "scripts\.venv, python $py" }
}
function Install-PythonClients {
  if (-not (Get-Command mise -ErrorAction SilentlyContinue)) { throw 'Install mise and the toolchain first (they provide uv).' }
  Push-Location (Join-Path $RepoRoot 'scripts')
  try { & mise exec -- uv sync --locked; if ($LASTEXITCODE -ne 0) { throw 'uv sync failed' } } finally { Pop-Location }
}

function Check-UnityHub {
  $hub = Join-Path $env:ProgramFiles 'Unity Hub\Unity Hub.exe'
  if (Test-Path $hub) { return @{ Ok = $true; Detail = $hub } }
  return @{ Ok = $false; Detail = 'not installed; Unity Editors are then installed from the Hub' }
}
function Install-UnityHub {
  Winget-Install 'Unity.UnityHub'
  $script:PostNotes += 'Unity Hub was installed. Open it, sign in, and install the Editor version your Unity project needs.'
}

$Deps = @(
  @{ Id = 'buildtools'; Label = 'Visual Studio C++ Build Tools'; Check = ${function:Check-BuildTools}; Install = ${function:Install-BuildTools}; Kind = 'required' },
  @{ Id = 'webview2';   Label = 'WebView2 Runtime';              Check = ${function:Check-WebView2};    Install = ${function:Install-WebView2};    Kind = 'required' },
  @{ Id = 'cmake';      Label = 'CMake (for liblsl)';            Check = ${function:Check-CMake};       Install = ${function:Install-CMake};       Kind = 'required' },
  @{ Id = 'mise';       Label = 'mise (toolchain manager)';       Check = ${function:Check-Mise};        Install = ${function:Install-Mise};        Kind = 'required' },
  @{ Id = 'tools';      Label = 'Toolchain pinned in mise.toml (bun, rust, uv)'; Check = ${function:Check-Toolchain};   Install = ${function:Install-Toolchain};   Kind = 'required' },
  @{ Id = 'tdriver';    Label = 'tauri-driver (e2e tests)';      Check = ${function:Check-TauriDriver}; Install = ${function:Install-TauriDriver}; Kind = 'optional' },
  @{ Id = 'edgedriver'; Label = 'msedgedriver (e2e tests)';      Check = ${function:Check-EdgeDriver};  Install = ${function:Install-EdgeDriver};  Kind = 'optional' },
  @{ Id = 'python';     Label = 'Python streaming clients (scripts\, uv sync)'; Check = ${function:Check-PythonClients}; Install = ${function:Install-PythonClients}; Kind = 'optional' },
  @{ Id = 'unity';      Label = 'Unity Hub';                     Check = ${function:Check-UnityHub};    Install = ${function:Install-UnityHub};    Kind = 'optional' }
)

function Run-Checks {
  foreach ($d in $Deps) { $r = & $d.Check; $d.Ok = $r.Ok; $d.Detail = $r.Detail }
}
function Report {
  foreach ($d in $Deps) {
    $tag = if ($d.Kind -eq 'optional') { ' (optional)' } else { '' }
    if ($d.Ok) { Ok "$($d.Label)$tag  $($d.Detail)" } else { Bad "$($d.Label)$tag  $($d.Detail)" }
  }
}

# --- Checkbox picker ------------------------------------------------------------
function Pick-Items([string[]]$labels, [bool[]]$defaults) {
  $picked = [bool[]]$defaults.Clone()
  $n = $labels.Count
  # Rows whose label starts with "##" are section headers: skipped by the cursor, never selectable.
  function Move-Cursor([int]$from, [int]$step) {
    $c = $from
    for ($t = 0; $t -lt $n; $t++) { $c = ($c + $step + $n) % $n; if (-not $labels[$c].StartsWith('##')) { return $c } }
    return $from
  }
  $cursor = 0
  while ($cursor -lt $n -and $labels[$cursor].StartsWith('##')) { $cursor++ }
  $top = [Console]::CursorTop
  [Console]::CursorVisible = $false
  try {
    while ($true) {
      [Console]::SetCursorPosition(0, $top)
      for ($i = 0; $i -lt $n; $i++) {
        if ($labels[$i].StartsWith('##')) {
          Write-Host (' ' + $labels[$i].Substring(3)).PadRight([Console]::WindowWidth - 1) -ForegroundColor White
          continue
        }
        $mark = if ($i -eq $cursor) { '>' } else { ' ' }
        $box = if ($picked[$i]) { '[x]' } else { '[ ]' }
        $color = if ($picked[$i]) { 'Green' } else { 'Gray' }
        Write-Host (" {0} " -f $mark) -NoNewline
        Write-Host $box -ForegroundColor $color -NoNewline
        Write-Host (" {0}" -f $labels[$i]).PadRight([Console]::WindowWidth - 8)
      }
      Write-Host '  Up/Down move - Space toggle - A all - N none - Enter confirm - Q quit'.PadRight([Console]::WindowWidth - 1) -ForegroundColor DarkGray
      # Re-anchor on the rows just drawn. Under ConPTY (Windows Terminal, current
      # conhost) the console buffer is only the visible window, so drawing at the
      # bottom scrolls it and the row remembered before drawing no longer points at
      # the checklist; redrawing there appended a new copy on every key press.
      $top = [Math]::Max(0, [Console]::CursorTop - ($n + 1))
      $key = [Console]::ReadKey($true)
      switch ($key.Key) {
        'UpArrow'   { $cursor = Move-Cursor $cursor -1 }
        'K'         { $cursor = Move-Cursor $cursor -1 }
        'DownArrow' { $cursor = Move-Cursor $cursor 1 }
        'J'         { $cursor = Move-Cursor $cursor 1 }
        'Spacebar'  { if (-not $labels[$cursor].StartsWith('##')) { $picked[$cursor] = -not $picked[$cursor] } }
        'A'         { for ($i = 0; $i -lt $n; $i++) { if (-not $labels[$i].StartsWith('##')) { $picked[$i] = $true } } }
        'N'         { for ($i = 0; $i -lt $n; $i++) { $picked[$i] = $false } }
        'Enter'     { return $picked }
        'Q'         { return $null }
        'Escape'    { return $null }
      }
    }
  } finally { [Console]::CursorVisible = $true }
}

# --- Main -----------------------------------------------------------------------
Refresh-Path
Write-Host 'The Balance Toolkit setup - platform: windows' -ForegroundColor White
Write-Host ''
Info 'Checking dependencies'
Run-Checks
Report
Write-Host ''

$missing = @($Deps | Where-Object { -not $_.Ok })
$requiredMissing = @($missing | Where-Object { $_.Kind -eq 'required' }).Count
if ($missing.Count -eq 0) { Ok 'Everything is installed.'; exit 0 }
if ($requiredMissing -eq 0) { Ok 'All required dependencies are installed. Only optional items are missing.' }
if ($Check) { exit [int]($requiredMissing -gt 0) }

# $rows[k] is the dependency for row k, or $null for a section header.
$labels = @(); $defaults = @(); $rows = @()
foreach ($section in @(@{ Kind = 'required'; Title = 'Required'; Tick = $true }, @{ Kind = 'optional'; Title = 'Optional'; Tick = [bool]$All })) {
  $items = @($missing | Where-Object { $_.Kind -eq $section.Kind })
  if ($items.Count -eq 0) { continue }
  $labels += "## $($section.Title)"; $defaults += $false; $rows += $null
  foreach ($d in $items) { $labels += $d.Label; $defaults += $section.Tick; $rows += $d }
}

if ($Yes -or $All) { $picked = $defaults }
else {
  Info 'Select what to install'
  $picked = Pick-Items $labels $defaults
  if ($null -eq $picked) { Warn 'Aborted. Nothing was installed.'; exit 1 }
}

$selected = @()
for ($i = 0; $i -lt $rows.Count; $i++) { if ($null -ne $rows[$i] -and $picked[$i]) { $selected += $rows[$i] } }
if ($selected.Count -eq 0) { Warn 'Nothing selected. Nothing was installed.'; exit [int]($requiredMissing -gt 0) }

Write-Host ''
$failed = @()
foreach ($d in $selected) {
  Info "Installing: $($d.Label)"
  try {
    & $d.Install
    $r = & $d.Check
    if ($r.Ok) { Ok "$($d.Label)  $($r.Detail)" }
    else { throw "Installation returned successfully, but verification failed: $($r.Detail)" }
  } catch {
    Bad "$($d.Label) failed: $($_.Exception.Message)"
    $failed += "$($d.Label): $($_.Exception.Message)"
  }
  Write-Host ''
}

Info 'Summary'
Run-Checks
Report
if ($script:PostNotes.Count -gt 0) { Write-Host ''; foreach ($n in $script:PostNotes) { Warn $n } }
$requiredMissing = @($Deps | Where-Object { $_.Kind -eq 'required' -and -not $_.Ok })
if ($failed.Count -gt 0 -or $requiredMissing.Count -gt 0) {
  Write-Host ''
  foreach ($failure in $failed) { Bad $failure }
  foreach ($d in $requiredMissing) { Bad "Required dependency unavailable: $($d.Label) ($($d.Detail))" }
  Write-Host 'Setup incomplete. Resolve the errors above, then rerun setup\setup.ps1; installed dependencies will be skipped.' -ForegroundColor Red
  exit 1
}
Write-Host ''
Ok 'Required dependencies verified. From the repository root, run: mise run dev:desktop'
