# Entry point kept at the repository root for convenience; the real setup lives in setup\windows\.
& "$PSScriptRoot\setup\windows\setup.ps1" @args
exit $LASTEXITCODE
