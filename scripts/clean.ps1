<#
.SYNOPSIS
  Remove generated Super Audio Control build output.
.DESCRIPTION
  Removes only generated build folders. Source, settings, cached toolchains, and
  the optional VB-CABLE package are preserved.
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$ProjectRoot = (Get-Item $PSScriptRoot).Parent.FullName
$targets = @('dist', 'build', 'release', 'coverage', '.vite')

foreach ($name in $targets) {
  $path = Join-Path $ProjectRoot $name
  if (Test-Path $path) {
    Remove-Item -LiteralPath $path -Recurse -Force
    Write-Host "Removed $name" -ForegroundColor Gray
  }
}

Write-Host 'Generated output cleaned. Cached tools and project sources were preserved.' -ForegroundColor Green
