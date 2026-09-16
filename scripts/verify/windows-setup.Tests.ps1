# Exercise the real setup entry point in child processes with simulated dependencies.
# No packages, registry settings, or user profiles are changed.
$ErrorActionPreference = 'Stop'
$source = Get-Content (Join-Path $PSScriptRoot '../../setup/setup.ps1') -Raw
$tokens = $null
$parseErrors = $null
$null = [System.Management.Automation.Language.Parser]::ParseInput($source, [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count) { throw ($parseErrors -join "`n") }
$engine = (Get-Process -Id $PID).Path
$tempDir = Join-Path ([IO.Path]::GetTempPath()) ([guid]::NewGuid().ToString())
$null = New-Item -ItemType Directory -Path $tempDir
try {
  foreach ($case in @(
    @{ Name = 'installed'; Mode = 'success'; Exit = 0; Text = 'Required dependencies verified' },
    @{ Name = 'installer failure'; Mode = 'throw'; Exit = 1; Text = 'simulated installer failure' },
    @{ Name = 'failed post-install check'; Mode = 'unavailable'; Exit = 1; Text = 'verification failed' },
    @{ Name = 'required item deselected'; Mode = 'deselected'; Exit = 1; Text = 'Nothing selected' },
    @{ Name = 'required item missing at final check'; Mode = 'regression'; Exit = 1; Text = 'Required dependency unavailable' }
  )) {
    $mocks = @'
function Refresh-Path {}
$script:installed = $false
$script:checks = 0
$Deps = @(
  @{ Id = 'fake'; Label = 'Test dependency'; Kind = 'required'
     Check = {
       $script:checks++
       $ready = $script:installed -and $mode -ne 'unavailable'
       if ($mode -eq 'regression' -and $script:checks -ge 3) { $ready = $false }
       @{ Ok = $ready; Detail = 'test dependency check' }
     }
     Install = {
       if ($mode -eq 'throw') { throw 'simulated installer failure' }
       $script:installed = $true
     }
  },
  @{ Id = 'optional'; Label = 'Optional dependency'; Kind = 'optional'
     Check = { @{ Ok = $false; Detail = 'optional unavailable' } }
     Install = { throw 'Optional installer should not run' }
  }
)
function Pick-Items { return @($false, $false, $false, $false) }
'@
    $marker = '# --- Main -----------------------------------------------------------------------'
    $injected = '$mode = ''' + $case.Mode + "'`n" + $mocks + "`n" + $marker
    $scriptPath = Join-Path $tempDir 'setup.ps1'
    Set-Content -Path $scriptPath -Value $source.Replace($marker, $injected)
    $arguments = @('-NoProfile', '-File', $scriptPath)
    if ($case.Mode -ne 'deselected') { $arguments += '-Yes' }
    $output = & $engine @arguments 2>&1 | Out-String
    if ($LASTEXITCODE -ne $case.Exit -or $output -notmatch [regex]::Escape($case.Text)) {
      throw "$($case.Name): unexpected exit/output ($LASTEXITCODE):`n$output"
    }
    if ($case.Exit -ne 0 -and $output -match 'Required dependencies verified') {
      throw "$($case.Name): incorrectly reported success"
    }
    Write-Host "PASS: $($case.Name)"
  }
} finally { Remove-Item -Recurse -Force $tempDir }
