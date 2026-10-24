# Build guide — 1.0.0

## Requirements

- Windows 10 or Windows 11, x64.
- Internet access during the first build to download toolchains/dependencies and the optional VB-CABLE driver package.
- A writable folder for the project and its `.tools` cache.

You do not need to preinstall Node.js or the .NET SDK; the build script bootstraps compatible versions locally when necessary.

## Build the Windows installer

Open PowerShell in the project root and run:

```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force
.\build.ps1 -Clean -Release
```

Or run `build.bat` from File Explorer. It opens a console, invokes the same PowerShell build script, and pauses at the end so build errors remain visible.

The root `build.ps1` is the single canonical build entry point. It first runs a native PowerShell parser check over the project scripts, so syntax errors are reported before downloading tools or compiling. The older `scripts\build.ps1` path is only a compatibility wrapper.

The build performs these steps:

1. Checks Windows x64 and locates or downloads Node.js 22.12+ and the .NET 10 SDK under `.tools`.
2. Installs npm dependencies with optional platform packages enabled; it skips `npm ci` if the committed lockfile lacks required Windows optional-package entries, allowing npm to reconcile the lockfile rather than failing with `EUSAGE`.
3. Runs `npm run lint` and `npm test`.
4. Builds the Vite renderer and bundles Electron main/preload code.
5. Publishes `scripts/AudioBridge.csproj` as a self-contained Windows x64 single-file executable.
6. Downloads and validates the optional official VB-CABLE driver archive for the Settings driver-install flow.
7. Packages the interactive NSIS Windows installer with Electron Builder. The installer creates Start Menu and desktop shortcuts, supports choosing the install directory, and keeps user settings when uninstalled.

Expected output: `release\SuperAudioControl-Setup-1.0.0.exe`.

## Useful commands

```powershell
npm run lint
npm test
npm run build
.\scripts\verify-environment.ps1
.\scripts\clean.ps1
```

`npm run build` only builds the renderer/main/preload files; use `build.ps1` for the complete Windows installer including the self-contained native bridge. To produce the portable executable instead, run `build.ps1 -Clean -Release -Portable`.

## Reproducibility note

`package.json` and `package-lock.json` are maintained together. Platform-specific optional dependency records can vary with npm version and host OS, so the Windows build script checks them before choosing `npm ci`. Do not work around a failed install by ignoring the exit code; resolve dependency or registry errors before packaging.
