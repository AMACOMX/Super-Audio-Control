# Super Audio Control 1.0.0 — tester handoff

## Create the installer

On Windows 10/11 x64, extract the source ZIP to a writable folder and run:

```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force
.\build.ps1 -Clean -Release
```

The script downloads missing build tools, restores npm packages, checks types/tests, publishes the self-contained Windows audio bridge, and creates:

`release\SuperAudioControl-Setup-1.0.0.exe`

To build the optional portable version instead, add `-Portable`; that creates `release\SuperAudioControl.exe`.

## What to send testers

Send only `SuperAudioControl-Setup-1.0.0.exe` for normal installation. Testers do not need Node.js or the .NET SDK. The installer creates a Start Menu entry and desktop shortcut and can be uninstalled from Windows Settings. User settings are intentionally retained when uninstalling.

The installer is not code-signed. Windows SmartScreen or security software may show an unfamiliar-app warning; testers should verify that the installer came directly from you before proceeding.

VB-CABLE is optional. If a tester chooses to install it from within the app, Windows will request administrator approval and a restart may be required. It is not silently installed.

## Ask testers to report

- Windows version and whether the install/uninstall completed.
- Whether the app starts, finds running apps, and the per-card refresh works.
- Which application was being tested and whether it had an active audio session.
- Whether volume, per-app device routing, microphone mute, and global shortcuts worked.
- The exact diagnostic message if a feature fails.

Please do not send diagnostic logs that contain personal information or private application paths unless you are comfortable sharing them.
