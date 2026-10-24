# Troubleshooting — 1.0.0

## Build fails during npm installation

- Confirm the build computer has internet access and npm can reach its configured registry.
- The build script checks for Windows x64 optional dependency records before using `npm ci`; when the lockfile lacks them, it uses `npm install --include=optional` to reconcile the graph.
- If an install fails, read the first npm error above the PowerShell stack trace. Do not continue to packaging after a non-zero dependency-install exit code.
- After changing direct dependencies, run `npm install --package-lock-only --ignore-scripts --no-audit --no-fund` to update the lockfile, then review the resulting diff.

## Application scans no processes

- Use **Scan Apps** or **Add Running App** to refresh the list.
- If the native bridge scan fails, the app falls back to PowerShell and `tasklist.exe`. Protected/system processes may not expose executable paths or icons.
- A process can be visible before it creates an audio session; volume and session mute controls only work when Windows exposes a matching controllable session.

## Input/output selection is rejected

- Start audio playback or microphone capture in the target app, then refresh the app card and retry.
- Some apps keep their own device selection. Choose **System Default** inside the target app and restart it before testing per-app preference changes.
- The internal Windows audio-policy interface used for per-app device preferences is undocumented and may reject or ignore specific app/device combinations. Super Audio Control does not change the system-wide default endpoint as a fallback.
- If it still fails, copy the full status diagnostic and the related lines from **Settings → Diagnostics → Open Log Folder**.

## Microphone mute doesn't work for one app

- Try while the application is actively capturing microphone audio. Windows needs to expose a controllable capture session for session mute.
- VB-CABLE is an optional fallback, installed from **Settings → Audio**. Driver installation requires the user's explicit action and normal Windows UAC approval; Windows may request a restart.
- If a session isn't available and Windows rejects per-app capture routing, the app reports failure. It never globally mutes the physical microphone as a fallback.

## Global shortcut doesn't fire

- Check **Settings → Hotkeys** and verify that global shortcuts are enabled.
- Another application or Windows may already own that key combination. Choose a different accelerator if registration fails.
- A shortcut's displayed key combination is only a saved preference; the app logs and reports whether Windows/Electron accepted the registration.

## Log file location

Open **Settings → Diagnostics → Open Log Folder**. The app tries to write `super-audio-control.log` beside the portable executable; if that folder is read-only, it writes under the per-user app-data logs directory. The log is cleared on normal startup and capped at 50 MB.
