# Architecture

## Runtime layout

- **Renderer (`src/App.tsx`, `src/renderer/components/`)**: dashboard, app cards, device selection UI, settings, shortcuts, status and diagnostics.
- **Preload (`src/main/preload.ts`)**: exposes a narrow, typed IPC API via `contextBridge`; the renderer does not receive unrestricted Node.js access.
- **Electron main (`src/main/index.ts`)**: window/splash/tray lifecycle, settings/configuration files, fixed external links, IPC handlers, and global shortcut ownership/dispatch.
- **Core Audio bridge (`scripts/AudioBridge.cs`, `scripts/AudioBridge.csproj`)**: self-contained Windows x64 executable for process discovery, Core Audio endpoints and sessions, volume/mute operations, and best-effort per-app endpoint preferences.
- **Bridge wrapper (`src/main/windowsCoreAudioBridge.ts`)**: invokes the bundled bridge, normalizes responses, and applies safe fallbacks for discovery/device enumeration.
- **Managers (`src/audio`, `src/microphone`, `src/hotkeys`, `src/process`, `src/settings`, `src/logger`, `src/tray`)**: renderer-side service classes and related state/IPC helpers.
- **PowerShell fallback (`scripts/coreAudio.ps1`, `src/main/windowsSystem.ts`)**: fallback process/device discovery when the compiled bridge cannot return usable data.
- **Tests (`tests/`)**: categorization, configuration, discovery, endpoint enumeration, and hotkey normalization/conflict checks.

## Audio operation safety

1. The app enumerates real endpoints and real Windows audio sessions; it does not fabricate process IDs or endpoint IDs.
2. Playback volume/mute uses Windows audio sessions when the target exposes a controllable session.
3. Microphone mute first tries a controllable capture-session mute, verifies the state, and remembers which method worked for unmute. If needed, it can fall back to the optional silent VB-CABLE capture endpoint.
4. Input/output device selection persists per-application preferences via Windows' internal audio-policy API. This interface is undocumented; applications may override preferences, and Windows may reject a change. The machine-wide default is not changed as a fallback.
5. No failure path globally mutes the physical microphone.

## Resource use

- The renderer and Electron main/preload code are bundled for release; there are no production npm dependencies required by the bundled JavaScript.
- The .NET bridge is published as a self-contained single-file executable so target PCs do not require the .NET runtime or SDK.
- The unused C++/N-API prototype has been removed from the release source and package configuration.
- Process/device discovery runs at startup or on explicit refresh; the app does not continuously poll all processes in a tight loop.
- Diagnostic writes are bounded to a 50 MB log file.

## Versioning

The product, npm package, lockfile, and portable executable use semantic version `1.0.0` for this cleaned first release. Update `package.json` and regenerate `package-lock.json` together for future releases.
