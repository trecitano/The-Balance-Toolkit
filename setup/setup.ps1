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

function Require-Winget {
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    throw 'winget is required. Install "App Installer" from the Microsoft Store, then rerun.'
  }
}

function Winget-Install([string]$id, [string[]]$extra = @()) {
  Require-Winget
  & winget install --id $id --exact --accept-source-agreements --accept-package-agreements @extra
  if ($LASTEXITCODE -ne 0) { throw "winget install $id failed ($LASTEXITCODE)" }
  Refresh-Path
}

# --- Checks -------------------------------------------------------------------
$script:PostNotes = @()

function Check-BuildTools {
  $vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
  if (-not (Test-Path $vswhere)) { return @{ Ok = $false; Detail = 'Visual Studio Installer not found' } }
  $path = & $vswhere -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath -latest 2>$null
  if ($path) { return @{ Ok = $true; Detail = $path } }
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
  return @{ Ok = $true; Detail = "mise $(Get-VersionFrom (& mise --version))" }
}
function Install-Mise {
  Winget-Install 'jdx.mise'
  $script:PostNotes += 'mise was installed. Activate it in PowerShell so bun/cargo resolve automatically:'
  $script:PostNotes += '  Add-Content $PROFILE ''mise activate pwsh | Out-String | Invoke-Expression'''
}

# Tools declared in the repository mise.toml that are not installed at the pinned version.
function Get-MissingTools {
  Push-Location $RepoRoot
  try {
    $missing = @()
    foreach ($l in @(& mise ls --missing 2>$null)) {
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
  try { $bun = & mise current bun 2>$null; $rust = & mise current rust 2>$null } finally { Pop-Location }
  return @{ Ok = $true; Detail = "bun $bun, rust $rust" }
}
function Install-Toolchain {
  if (-not (Get-Command mise -ErrorAction SilentlyContinue)) { throw 'Install mise before the toolchain.' }
  Push-Location $RepoRoot
  try {
    & mise trust --quiet mise.toml
    & mise install --yes
    if ($LASTEXITCODE -ne 0) { throw 'mise install failed' }
  } finally { Pop-Location }
  Refresh-Path
}

function Check-CMake {
  $c = Get-Command cmake -ErrorAction SilentlyContinue
  if (-not $c) { return @{ Ok = $false; Detail = 'cmake not found' } }
  return @{ Ok = $true; Detail = "cmake $(Get-VersionFrom (& cmake --version))" }
}
function Install-CMake { Winget-Install 'Kitware.CMake' }

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

function Check-EdgeDriver {
  $d = Get-Command msedgedriver.exe -ErrorAction SilentlyContinue
  if (-not $d) { return @{ Ok = $false; Detail = 'needed only for end-to-end tests' } }
  return @{ Ok = $true; Detail = $d.Source }
}
function Install-EdgeDriver {
  throw 'msedgedriver.exe must match your Edge version. Download it from https://developer.microsoft.com/microsoft-edge/tools/webdriver/ and put it on PATH.'
}

function Check-PythonClients {
  $venv = Join-Path $RepoRoot 'scripts\.venv\Scripts\python.exe'
  if (-not (Test-Path $venv)) { return @{ Ok = $false; Detail = 'scripts\.venv not created (uv sync)' } }
  if (-not (Get-Command mise -ErrorAction SilentlyContinue)) { return @{ Ok = $false; Detail = 'needs mise' } }
  Push-Location (Join-Path $RepoRoot 'scripts')
  try { & mise exec -- uv sync --locked --check *> $null; $ok = ($LASTEXITCODE -eq 0) } finally { Pop-Location }
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
if ($selected.Count -eq 0) { Warn 'Nothing selected. Nothing was installed.'; exit 0 }

Write-Host ''
$failed = @()
foreach ($d in $selected) {
  Info "Installing: $($d.Label)"
  try {
    & $d.Install
    $r = & $d.Check
    if ($r.Ok) { Ok "$($d.Label)  $($r.Detail)" }
    else { Warn "$($d.Label): installed, but the check still fails ($($r.Detail)). A new terminal may be needed." }
  } catch {
    Bad "$($d.Label) failed: $($_.Exception.Message)"
    $failed += $d
  }
  Write-Host ''
}

Info 'Summary'
Run-Checks
Report
if ($script:PostNotes.Count -gt 0) { Write-Host ''; foreach ($n in $script:PostNotes) { Warn $n } }
if ($failed.Count -gt 0) { Write-Host ''; Write-Host "Error: $($failed.Count) item(s) failed. See INSTALL.md for manual steps." -ForegroundColor Red; exit 1 }
Write-Host ''
Ok 'Done. Next: cd apps/tauri; bun install; bun run tauri dev'
