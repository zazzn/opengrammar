<#
.SYNOPSIS
  Build the OGrammar desktop installer with Inno Setup.
.DESCRIPTION
  Stages the release binary next to OGrammar.iss and compiles it into
  Output\OGrammar-<version>-setup.exe. Requires Inno Setup 6 (ISCC.exe).
.EXAMPLE
  pwsh desktop\installer\build-installer.ps1
  pwsh desktop\installer\build-installer.ps1 -Exe C:\path\to\ograms-hotkey.exe -Version 0.9.0
#>
param(
  # Release binary. Defaults to the repo's custom CARGO_TARGET_DIR location.
  [string]$Exe = "$env:LOCALAPPDATA\ograms-cargo-target\release\ograms-hotkey.exe",
  [string]$Version = "0.9.0"
)
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not (Test-Path $Exe)) {
  throw "Binary not found: $Exe`nBuild it first:  cargo build --release --manifest-path desktop\ograms-hotkey\Cargo.toml"
}
Copy-Item $Exe (Join-Path $here "OGrammar.exe") -Force

$iscc = @(
  "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe",
  "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
  "$env:ProgramFiles\Inno Setup 6\ISCC.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $iscc) { throw "ISCC.exe not found. Install Inno Setup 6 (winget install JRSoftware.InnoSetup)." }

& $iscc "/DAppVersion=$Version" (Join-Path $here "OGrammar.iss")
Write-Host "Installer -> $(Join-Path $here 'Output')\OGrammar-$Version-setup.exe"
