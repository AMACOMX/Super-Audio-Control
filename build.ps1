# Super Audio Control 1.0.0 - canonical Windows build script.
# Keep this file as the single source of truth for installer and portable builds.
[CmdletBinding()]
param(
    [switch]$Clean,
    [switch]$Release,
    [switch]$Portable
)

$ErrorActionPreference = 'Stop'
try { Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force -ErrorAction SilentlyContinue } catch { }
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.ServicePointManager]::SecurityProtocol } catch { }

$ProjectRoot = $PSScriptRoot
$ToolsRoot = Join-Path $ProjectRoot '.tools'
$PackagePath = Join-Path $ProjectRoot 'package.json'
$LockPath = Join-Path $ProjectRoot 'package-lock.json'
$BridgeProject = Join-Path $ProjectRoot 'scripts\AudioBridge.csproj'
$BuilderConfig = Join-Path $ProjectRoot 'electron-builder.yml'

if (-not (Test-Path -LiteralPath $PackagePath)) {
    throw ('package.json was not found in the project directory: {0}' -f $ProjectRoot)
}
if (-not [Environment]::OSVersion.Platform.ToString().StartsWith('Win')) {
    throw 'This build script must run on Windows 10 or Windows 11 x64.'
}
if (-not [Environment]::Is64BitOperatingSystem) {
    throw 'Only Windows x64 is supported by this build.'
}

$PackageMetadata = Get-Content -Raw -LiteralPath $PackagePath | ConvertFrom-Json
if ([string]$PackageMetadata.version -ne '1.0.0') {
    throw ('This release project must remain at version 1.0.0; package.json reports {0}.' -f [string]$PackageMetadata.version)
}
if (-not (Test-Path -LiteralPath $LockPath)) { throw 'package-lock.json is missing.' }
if (-not (Test-Path -LiteralPath $BridgeProject)) { throw 'scripts\AudioBridge.csproj is missing.' }
if (-not (Test-Path -LiteralPath $BuilderConfig)) { throw 'electron-builder.yml is missing.' }

# Parse-check every PowerShell script with Windows PowerShell's own parser before build steps.
# This catches syntax damage early and avoids spending time downloading/building before failing.
$PowerShellFiles = @((Get-Item -LiteralPath $PSCommandPath)) + @(Get-ChildItem -LiteralPath (Join-Path $ProjectRoot 'scripts') -Filter '*.ps1' -File -ErrorAction SilentlyContinue)
foreach ($PowerShellFile in $PowerShellFiles) {
    $ParseTokens = $null
    $ParseErrors = $null
    [void][System.Management.Automation.Language.Parser]::ParseFile($PowerShellFile.FullName, [ref]$ParseTokens, [ref]$ParseErrors)
    if ($ParseErrors -and $ParseErrors.Count -gt 0) {
        $FirstParseError = $ParseErrors[0]
        throw ('PowerShell syntax error in {0}, line {1}: {2}' -f $PowerShellFile.FullName, $FirstParseError.Extent.StartLineNumber, $FirstParseError.Message)
    }
}

New-Item -ItemType Directory -Force -Path $ToolsRoot | Out-Null
Set-Location $ProjectRoot

function Invoke-CheckedCommand {
    param(
        [Parameter(Mandatory = $true)][string]$Label,
        [Parameter(Mandatory = $true)][string]$Executable,
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )
    Write-Host ''
    Write-Host ('>>> {0}' -f $Label) -ForegroundColor Cyan
    & $Executable @Arguments
    $CommandExitCode = $LASTEXITCODE
    if ($null -eq $CommandExitCode) { $CommandExitCode = 0 }
    if ($CommandExitCode -ne 0) {
        throw ('{0} failed with exit code {1}.' -f $Label, $CommandExitCode)
    }
}

function Get-WorkingNode {
    $NodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
    if (-not $NodeCommand) { $NodeCommand = Get-Command node -ErrorAction SilentlyContinue }
    if ($NodeCommand) {
        try {
            $DetectedNodeVersion = (& $NodeCommand.Source --version 2>$null | Out-String).Trim()
            if ($DetectedNodeVersion -match '^v(\d+)\.(\d+)\.(\d+)$') {
                $NodeMajor = [int]$Matches[1]
                $NodeMinor = [int]$Matches[2]
                if (($NodeMajor -gt 22) -or (($NodeMajor -eq 22) -and ($NodeMinor -ge 12))) {
                    $NodeDirectory = Split-Path -Parent $NodeCommand.Source
                    $NpmCommand = Join-Path $NodeDirectory 'npm.cmd'
                    if (Test-Path -LiteralPath $NpmCommand) {
                        return @{ Node = $NodeCommand.Source; Npm = $NpmCommand; Dir = $NodeDirectory; Version = $DetectedNodeVersion }
                    }
                }
            }
        } catch { }
    }

    $CachedNodeFolders = @(Get-ChildItem -LiteralPath $ToolsRoot -Directory -Filter 'node-v22.*-win-x64' -ErrorAction SilentlyContinue | Where-Object {
        if ($_.Name -match '^node-v22\.(\d+)\.(\d+)-win-x64$') { [int]$Matches[1] -ge 12 } else { $false }
    })
    $CachedNode = $CachedNodeFolders | Sort-Object { [version](($_.Name -replace '^node-v', '') -replace '-win-x64$', '') } -Descending | Select-Object -First 1
    if ($CachedNode) {
        $CachedNodeExe = Join-Path $CachedNode.FullName 'node.exe'
        $CachedNpmCmd = Join-Path $CachedNode.FullName 'npm.cmd'
        if ((Test-Path -LiteralPath $CachedNodeExe) -and (Test-Path -LiteralPath $CachedNpmCmd)) {
            $CachedVersion = (& $CachedNodeExe --version 2>$null | Out-String).Trim()
            return @{ Node = $CachedNodeExe; Npm = $CachedNpmCmd; Dir = $CachedNode.FullName; Version = $CachedVersion }
        }
    }

    Write-Host 'Compatible Node.js 22.12+ was not found. Downloading an official Node.js 22 x64 ZIP...' -ForegroundColor Yellow
    $NodeIndexPath = Join-Path $ToolsRoot 'node-index.json'
    Invoke-WebRequest -UseBasicParsing -Uri 'https://nodejs.org/dist/index.json' -OutFile $NodeIndexPath
    $NodeIndex = Get-Content -Raw -LiteralPath $NodeIndexPath | ConvertFrom-Json
    $NodeRelease = $NodeIndex | Where-Object { $_.version -match '^v22\.' } | Select-Object -First 1
    if (-not $NodeRelease) { throw 'Could not resolve a Node.js 22 release from nodejs.org.' }

    $NodeVersion = [string]$NodeRelease.version
    $NodeArchiveName = 'node-{0}-win-x64.zip' -f $NodeVersion
    $NodeBaseUrl = 'https://nodejs.org/dist/{0}' -f $NodeVersion
    $NodeArchivePath = Join-Path $ToolsRoot $NodeArchiveName
    $NodeSumsPath = Join-Path $ToolsRoot 'SHASUMS256.txt'
    Invoke-WebRequest -UseBasicParsing -Uri ('{0}/{1}' -f $NodeBaseUrl, $NodeArchiveName) -OutFile $NodeArchivePath
    Invoke-WebRequest -UseBasicParsing -Uri ('{0}/SHASUMS256.txt' -f $NodeBaseUrl) -OutFile $NodeSumsPath
    $NodeSumLine = Get-Content -LiteralPath $NodeSumsPath | Where-Object { $_ -match ('\s\*?{0}$' -f [Regex]::Escape($NodeArchiveName)) } | Select-Object -First 1
    if (-not $NodeSumLine) { throw ('Could not find the official SHA-256 for {0}.' -f $NodeArchiveName) }
    $ExpectedNodeHash = (($NodeSumLine.Trim() -split '\s+')[0]).ToLowerInvariant()
    $ActualNodeHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $NodeArchivePath).Hash.ToLowerInvariant()
    if ($ActualNodeHash -ne $ExpectedNodeHash) {
        Remove-Item -LiteralPath $NodeArchivePath -Force -ErrorAction SilentlyContinue
        throw ('SHA-256 verification failed for {0}.' -f $NodeArchiveName)
    }
    Expand-Archive -LiteralPath $NodeArchivePath -DestinationPath $ToolsRoot -Force
    Remove-Item -LiteralPath $NodeArchivePath -Force -ErrorAction SilentlyContinue
    $NodeDirectory = Join-Path $ToolsRoot ('node-{0}-win-x64' -f $NodeVersion)
    $NodeExe = Join-Path $NodeDirectory 'node.exe'
    $NpmCmd = Join-Path $NodeDirectory 'npm.cmd'
    if (-not (Test-Path -LiteralPath $NodeExe) -or -not (Test-Path -LiteralPath $NpmCmd)) { throw 'The downloaded Node.js archive is missing node.exe or npm.cmd.' }
    $InstalledNodeVersion = (& $NodeExe --version 2>$null | Out-String).Trim()
    return @{ Node = $NodeExe; Npm = $NpmCmd; Dir = $NodeDirectory; Version = $InstalledNodeVersion }
}

function Get-WorkingDotNet {
    $DotNetCommand = Get-Command dotnet.exe -ErrorAction SilentlyContinue
    if (-not $DotNetCommand) { $DotNetCommand = Get-Command dotnet -ErrorAction SilentlyContinue }
    if ($DotNetCommand) {
        try {
            $DetectedDotNetVersion = (& $DotNetCommand.Source --version 2>$null | Out-String).Trim()
            if ($DetectedDotNetVersion -match '^(\d+)\.' -and [int]$Matches[1] -ge 10) {
                return @{ Exe = $DotNetCommand.Source; Dir = (Split-Path -Parent $DotNetCommand.Source); Version = $DetectedDotNetVersion }
            }
        } catch { }
    }

    $LocalDotNetExe = Join-Path $ToolsRoot 'dotnet\dotnet.exe'
    if (Test-Path -LiteralPath $LocalDotNetExe) {
        try {
            $LocalDotNetVersion = (& $LocalDotNetExe --version 2>$null | Out-String).Trim()
            if ($LocalDotNetVersion -match '^(\d+)\.' -and [int]$Matches[1] -ge 10) {
                return @{ Exe = $LocalDotNetExe; Dir = (Split-Path -Parent $LocalDotNetExe); Version = $LocalDotNetVersion }
            }
        } catch { }
    }

    Write-Host 'The .NET 10 SDK was not found. Installing a private SDK under .tools\dotnet...' -ForegroundColor Yellow
    $DotNetInstaller = Join-Path $ToolsRoot 'dotnet-install.ps1'
    Invoke-WebRequest -UseBasicParsing -Uri 'https://dot.net/v1/dotnet-install.ps1' -OutFile $DotNetInstaller
    $DotNetDirectory = Join-Path $ToolsRoot 'dotnet'
    New-Item -ItemType Directory -Force -Path $DotNetDirectory | Out-Null
    $PowerShellExe = Join-Path $PSHOME 'powershell.exe'
    if (-not (Test-Path -LiteralPath $PowerShellExe)) { $PowerShellExe = (Get-Command powershell.exe -ErrorAction Stop).Source }
    & $PowerShellExe -NoProfile -ExecutionPolicy Bypass -File $DotNetInstaller -Channel '10.0' -Architecture 'x64' -InstallDir $DotNetDirectory -NoPath -Quality 'GA'
    $InstallExitCode = $LASTEXITCODE
    if (($InstallExitCode -ne 0) -or (-not (Test-Path -LiteralPath (Join-Path $DotNetDirectory 'dotnet.exe')))) {
        throw ('The .NET 10 SDK installation failed with exit code {0}. Check network access and retry.' -f $InstallExitCode)
    }
    $InstalledDotNetExe = Join-Path $DotNetDirectory 'dotnet.exe'
    $InstalledDotNetVersion = (& $InstalledDotNetExe --version 2>$null | Out-String).Trim()
    if ($InstalledDotNetVersion -notmatch '^(\d+)\.' -or [int]$Matches[1] -lt 10) {
        throw ('The downloaded .NET SDK is not version 10 or newer: {0}' -f $InstalledDotNetVersion)
    }
    return @{ Exe = $InstalledDotNetExe; Dir = $DotNetDirectory; Version = $InstalledDotNetVersion }
}

Write-Host '============================================================' -ForegroundColor Cyan
if ($Portable) { $BuildKind = 'PORTABLE WINDOWS BUILD' } else { $BuildKind = 'WINDOWS INSTALLER BUILD' }
Write-Host (' SUPER AUDIO CONTROL 1.0.0 - {0}' -f $BuildKind) -ForegroundColor Cyan
Write-Host (' Project: {0}' -f $ProjectRoot) -ForegroundColor Gray
Write-Host '============================================================' -ForegroundColor Cyan

if ($Clean) {
    Write-Host 'Removing previous generated output...' -ForegroundColor Yellow
    foreach ($GeneratedFolder in @('dist', 'build', 'release')) {
        $GeneratedPath = Join-Path $ProjectRoot $GeneratedFolder
        if (Test-Path -LiteralPath $GeneratedPath) { Remove-Item -LiteralPath $GeneratedPath -Recurse -Force }
    }
}

$Node = Get-WorkingNode
$DotNet = Get-WorkingDotNet
$env:PATH = [string]::Concat([string]$Node.Dir, ';', [string]$DotNet.Dir, ';', [string]$env:PATH)
Write-Host ('Node.js: {0}' -f $Node.Version) -ForegroundColor Green
try { Write-Host ('npm: {0}' -f ((& $Node.Npm --version 2>$null | Out-String).Trim())) -ForegroundColor Green } catch { }
Write-Host ('.NET SDK: {0}' -f $DotNet.Version) -ForegroundColor Green

# Validate and stage the optional VB-CABLE driver package. The runtime installer
# still requires an explicit user choice and Windows UAC approval.
$VendorDirectory = Join-Path $ProjectRoot 'vendor\vb-cable'
New-Item -ItemType Directory -Force -Path $VendorDirectory | Out-Null
$DriverZip = Join-Path $VendorDirectory 'VBCABLE_Driver_Pack45.zip'
$DriverUrl = 'https://download.vb-audio.com/Download_CABLE/VBCABLE_Driver_Pack45.zip'
$DriverArchiveValid = $false
if (Test-Path -LiteralPath $DriverZip) {
    try {
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $DriverArchive = [System.IO.Compression.ZipFile]::OpenRead($DriverZip)
        try { $DriverArchiveValid = [bool]($DriverArchive.Entries | Where-Object { $_.FullName -match '(^|/)VBCABLE_Setup_x64\.exe$' } | Select-Object -First 1) }
        finally { $DriverArchive.Dispose() }
    } catch { $DriverArchiveValid = $false }
}
if (-not $DriverArchiveValid) {
    Write-Host 'Downloading the official VB-Audio VB-CABLE driver package...' -ForegroundColor Yellow
    $PartialDriverZip = '{0}.download' -f $DriverZip
    Remove-Item -LiteralPath $PartialDriverZip -Force -ErrorAction SilentlyContinue
    Invoke-WebRequest -UseBasicParsing -Uri $DriverUrl -OutFile $PartialDriverZip
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $DownloadedDriverArchive = [System.IO.Compression.ZipFile]::OpenRead($PartialDriverZip)
    try {
        $DriverHasX64Setup = [bool]($DownloadedDriverArchive.Entries | Where-Object { $_.FullName -match '(^|/)VBCABLE_Setup_x64\.exe$' } | Select-Object -First 1)
        if (-not $DriverHasX64Setup) { throw 'The downloaded VB-CABLE archive does not contain the expected x64 installer.' }
    } finally { $DownloadedDriverArchive.Dispose() }
    Move-Item -LiteralPath $PartialDriverZip -Destination $DriverZip -Force
}
$VendorNoticeLines = @(
    'Third-party driver: VB-Audio VB-CABLE'
    'Official origin: https://vb-audio.com/Cable/'
    'VB-CABLE is donationware. Licensing details: https://vb-audio.com/Services/licensing.htm'
    'Super Audio Control is not affiliated with VB-Audio.'
    'The driver is optional and is installed only after explicit user action and Windows administrator approval.'
    'A Windows restart may be required after installing the driver.'
)
$VendorNotice = $VendorNoticeLines -join [Environment]::NewLine
Set-Content -LiteralPath (Join-Path $VendorDirectory 'NOTICE.txt') -Value $VendorNotice -Encoding UTF8

# npm ci is intentionally not used here because the committed lockfile has
# historically been missing platform-specific optional package records. npm
# install reconciles the lock while installing optional Windows x64 packages.
if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot 'node_modules'))) {
    New-Item -ItemType Directory -Force -Path (Join-Path $ProjectRoot 'node_modules') | Out-Null
}
Invoke-CheckedCommand -Label 'Install npm dependencies' -Executable $Node.Npm -Arguments @('install', '--include=optional', '--no-audit', '--no-fund')
Invoke-CheckedCommand -Label 'TypeScript type check' -Executable $Node.Npm -Arguments @('run', 'lint')
Invoke-CheckedCommand -Label 'Automated test suite' -Executable $Node.Npm -Arguments @('test')
Invoke-CheckedCommand -Label 'Build renderer and Electron main/preload' -Executable $Node.Npm -Arguments @('run', 'build')

$BridgeOutputDirectory = Join-Path $ProjectRoot 'dist\audio-bridge-publish'
$FinalBridgePath = Join-Path $ProjectRoot 'dist\audio_bridge.exe'
if (Test-Path -LiteralPath $BridgeOutputDirectory) { Remove-Item -LiteralPath $BridgeOutputDirectory -Recurse -Force }
Invoke-CheckedCommand -Label 'Publish self-contained Windows audio bridge' -Executable $DotNet.Exe -Arguments @(
    'publish', $BridgeProject, '--configuration', 'Release', '--runtime', 'win-x64', '--self-contained', 'true',
    '--output', $BridgeOutputDirectory, '-p:PublishSingleFile=true', '-p:IncludeNativeLibrariesForSelfExtract=true',
    '-p:DebugType=None', '-p:DebugSymbols=false'
)
$PublishedBridgePath = Join-Path $BridgeOutputDirectory 'audio_bridge.exe'
if (-not (Test-Path -LiteralPath $PublishedBridgePath)) {
    throw ('The .NET publish step completed without producing {0}.' -f $PublishedBridgePath)
}
Copy-Item -LiteralPath $PublishedBridgePath -Destination $FinalBridgePath -Force
Remove-Item -LiteralPath $BridgeOutputDirectory -Recurse -Force
Write-Host ('Self-contained audio bridge ready: {0}' -f $FinalBridgePath) -ForegroundColor Green

$BuilderCommand = Join-Path $ProjectRoot 'node_modules\.bin\electron-builder.cmd'
if (-not (Test-Path -LiteralPath $BuilderCommand)) { throw 'electron-builder.cmd was not installed. Check npm install output.' }
if ($Portable) {
    Invoke-CheckedCommand -Label 'Package portable Windows application' -Executable $BuilderCommand -Arguments @('--win', 'portable', '--x64', '--config', $BuilderConfig)
    $ArtifactPath = Join-Path $ProjectRoot 'release\SuperAudioControl.exe'
    $ArtifactLabel = 'Portable application'
    if (-not (Test-Path -LiteralPath $ArtifactPath)) {
        $PortableCandidates = @(Get-ChildItem -LiteralPath (Join-Path $ProjectRoot 'release') -Filter 'SuperAudioControl*.exe' -File -ErrorAction SilentlyContinue)
        if ($PortableCandidates.Count -gt 0) { $ArtifactPath = $PortableCandidates[0].FullName }
    }
} else {
    Invoke-CheckedCommand -Label 'Package interactive Windows installer' -Executable $BuilderCommand -Arguments @('--win', 'nsis', '--x64', '--config', $BuilderConfig)
    $InstallerFileName = 'SuperAudioControl-Setup-{0}.exe' -f [string]$PackageMetadata.version
    $ArtifactPath = Join-Path (Join-Path $ProjectRoot 'release') $InstallerFileName
    $ArtifactLabel = 'Windows installer'
    if (-not (Test-Path -LiteralPath $ArtifactPath)) {
        $InstallerCandidates = @(Get-ChildItem -LiteralPath (Join-Path $ProjectRoot 'release') -Filter 'SuperAudioControl-Setup*.exe' -File -ErrorAction SilentlyContinue)
        if ($InstallerCandidates.Count -gt 0) { $ArtifactPath = $InstallerCandidates[0].FullName }
    }
}
if (-not $ArtifactPath -or -not (Test-Path -LiteralPath $ArtifactPath)) {
    throw ('Packaging reported success but no {0} was created in the release directory.' -f $ArtifactLabel)
}

Write-Host ''
Write-Host '============================================================' -ForegroundColor Green
Write-Host 'BUILD FINISHED - Super Audio Control 1.0.0' -ForegroundColor Green
Write-Host ('{0}: {1}' -f $ArtifactLabel, $ArtifactPath) -ForegroundColor Cyan
Write-Host 'End-user PCs do not need Node.js or the .NET SDK.' -ForegroundColor Green
Write-Host 'VB-CABLE remains optional and requires explicit user action and Windows administrator approval.' -ForegroundColor Yellow
Write-Host '============================================================' -ForegroundColor Green
