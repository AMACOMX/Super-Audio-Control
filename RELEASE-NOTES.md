# Super Audio Control 1.0.0

This is the cleaned first-release source package with the current feature set preserved.

## Included

- Branded splash, executable/window/tray icons, and the Ko-fi icon link.
- Per-application volume, mute, device preferences, microphone mute, global shortcuts, process scanning, and app-card refresh.
- Optional VB-CABLE installer available from Settings → Audio.
- Interactive Windows x64 installer (NSIS) by default, optional portable executable, and self-contained .NET 10 audio bridge.

## Cleanup

- Aligned product/package/lockfile version at `1.0.0`.
- Removed unused direct dependencies and moved the bundled/built renderer tools into development dependencies. The packaged app has zero production npm dependencies because the main process and renderer are bundled.
- Removed the unbuilt C++/N-API prototype, its optional loader, its packaging rules, obsolete AI Studio/Gemini metadata and environment template, redundant Bun lockfile, duplicated tray image, obsolete packaging wrapper, and historical versioned hotfix notes.
- Consolidated duplicated endpoint enumeration IPC handlers.
- Reduced synchronous diagnostic I/O by tracking log size in-process instead of calling `stat` for every log line.
- Ensured status notifications use a single auto-dismiss timer and cannot clear newer notifications.
- Removed unused imports and made the npm clean command portable across Windows/Linux shells.

## Verification

- 30 TypeScript/TSX files transpiled with zero syntax errors.
- All six automated test functions passed.
- Package metadata and lockfile both report version `1.0.0`; unused direct packages and production dependencies are absent.
- A complete `npm ci`, .NET publication, and Windows portable package build could not be verified in this Linux environment because npm dependency installation timed out. Run `build.ps1 -Clean -Release` on Windows before treating this package as a final signed release.
