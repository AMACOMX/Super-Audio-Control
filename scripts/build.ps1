# Compatibility entry point for older documentation/scripts. Canonical build logic lives at project root.
[CmdletBinding()]
param([switch]$Clean, [switch]$Release, [switch]$Portable)
$ErrorActionPreference = 'Stop'
$RootBuildScript = Join-Path (Split-Path -Parent $PSScriptRoot) 'build.ps1'
& $RootBuildScript @PSBoundParameters
if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
