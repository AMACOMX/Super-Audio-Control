<#
.SYNOPSIS
  Check the machine and project folder before building Super Audio Control.
.DESCRIPTION
  The main build script downloads Node.js and the .NET 10 SDK when needed, so
  they do not need to be installed globally. Visual Studio C++ Build Tools are
  not required by the maintained build.
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$ProjectRoot = (Get-Item $PSScriptRoot).Parent.FullName
$failed = $false

Write-Host 'Super Audio Control 1.0.0 — build preflight' -ForegroundColor Cyan
Write-Host "Project: $ProjectRoot" -ForegroundColor Gray

if (-not $env:OS -or $env:OS -notlike '*Windows*') {
  Write-Host 'ERROR: build must run on Windows 10/11 x64.' -ForegroundColor Red
  exit 1
}
if (-not [Environment]::Is64BitOperatingSystem) {
  Write-Host 'ERROR: only Windows x64 is supported.' -ForegroundColor Red
  exit 1
}
Write-Host 'Windows x64: OK' -ForegroundColor Green

foreach ($required in @('package.json', 'package-lock.json', 'scripts\AudioBridge.csproj', 'build.ps1', 'electron-builder.yml')) {
  if (Test-Path (Join-Path $ProjectRoot $required)) {
    Write-Host "Found $required" -ForegroundColor Green
  } else {
    Write-Host "ERROR: missing $required" -ForegroundColor Red
    $failed = $true
  }
}

try {
  $probe = Join-Path $ProjectRoot '.build-write-test.tmp'
  [System.IO.File]::WriteAllText($probe, 'ok')
  Remove-Item -LiteralPath $probe -Force
  Write-Host 'Project folder writable: OK' -ForegroundColor Green
} catch {
  Write-Host 'ERROR: project folder is not writable.' -ForegroundColor Red
  $failed = $true
}

$node = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $node) { $node = Get-Command node -ErrorAction SilentlyContinue }
if ($node) {
  Write-Host "Global Node.js detected: $((& $node.Source --version 2>$null | Out-String).Trim())" -ForegroundColor Gray
} else {
  Write-Host 'Global Node.js not found; build.ps1 will try to download a private copy.' -ForegroundColor Yellow
}

$dotnet = Get-Command dotnet.exe -ErrorAction SilentlyContinue
if (-not $dotnet) { $dotnet = Get-Command dotnet -ErrorAction SilentlyContinue }
if ($dotnet) {
  Write-Host ".NET SDK detected: $((& $dotnet.Source --version 2>$null | Out-String).Trim())" -ForegroundColor Gray
} else {
  Write-Host '.NET SDK not found; build.ps1 will try to download .NET 10.' -ForegroundColor Yellow
}

if ($failed) { exit 1 }
Write-Host 'Preflight passed. Network access is still required if tools or packages must be downloaded.' -ForegroundColor Green
