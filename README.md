# Super Audio Control 1.0.0

Super Audio Control is a Windows desktop utility for controlling audio sessions per application. It is built with Electron, React, TypeScript, and a self-contained .NET Windows Core Audio/WASAPI bridge.

## Features

- Per-application playback volume and mute controls when Windows exposes a controllable audio session.
- Per-application playback and capture endpoint preferences through Windows' audio-policy mechanism.
- Per-application microphone mute: the bridge first attempts to mute a controllable capture session and verifies the resulting state. If that is unavailable, it can try the optional VB-CABLE silent-capture route. It never falls back to muting the physical/default microphone globally.
- Configurable global volume-up, volume-down, volume-mute, and microphone-mute shortcuts.
- Running-process discovery, Add Running App, and per-app refresh.
- Device rescanning, app categories, settings persistence, diagnostics, tray controls, and startup/minimize options.
- Branded splash, app/taskbar/tray icons, and an icon-only Ko-fi link to <https://ko-fi.com/amacomx>.
- Interactive Windows x64 installer by default, with an optional portable executable. End-user computers do not need Node.js or the .NET SDK.

## Build

Supported build target: Windows 10/11 x64. Run PowerShell from the project folder:

```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force
.\build.ps1 -Clean -Release
```

The root `build.ps1` is the canonical build entry point. It checks PowerShell script syntax before doing any downloads, then bootstraps build-only Node.js and .NET SDK tools under `.tools` when needed, installs npm dependencies, performs the TypeScript check and automated tests, publishes the self-contained `audio_bridge.exe`, downloads the official optional VB-CABLE installer archive, and packages an interactive Windows installer by default. Use `-Portable` to build the portable executable instead.

Installer output: `release\SuperAudioControl-Setup-1.0.0.exe`. Portable output (with `-Portable`): `release\SuperAudioControl.exe`.

An internet connection is required on the build computer for missing toolchains, npm packages, and the optional driver package. Installation of VB-CABLE remains optional and is never started without an explicit user action and Windows' normal UAC approval.

See [BUILD.md](BUILD.md) for build details, [FRIEND-TESTING.md](FRIEND-TESTING.md) for tester handoff instructions, and [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common problems.

## Important Windows audio limitations

Per-application endpoint selection uses Windows' internal audio-policy interface, which is undocumented and can be rejected or ignored by some applications. Apps that explicitly select and hold an audio endpoint may need to be configured to use Windows/System Default and restarted before they honor a changed preference. An idle app may not have an active audio session until it starts playback or capture.

Session mute depends on Windows exposing a controllable session for the target process. VB-CABLE is an optional fallback, not a requirement for every feature. When an operation fails, the app reports the failure rather than claiming the device was changed or muting the physical microphone globally.

## Configuration and logs

Application configuration and settings are stored in Electron's per-user application data directory. The diagnostic log is written beside the portable executable when writable, otherwise under the user's application-data logs directory. The current log is cleared at normal startup and capped at 50 MB. Use **Settings → Diagnostics** to open the log folder.

## Third-party driver notice

VB-CABLE is a third-party component by VB-Audio, distributed as an optional component. Official source: <https://vb-audio.com/Cable/>. Licensing/donation details: <https://vb-audio.com/Services/licensing.htm>. Super Audio Control is not affiliated with VB-Audio.

## Support the project

Ko-fi: <https://ko-fi.com/amacomx>
