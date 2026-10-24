import { execFile } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { AudioSessionInfo, AudioDevice, ProcessInfo } from '../shared/types';
import { categorizeProcess } from '../shared/categories';

const execFileAsync = util.promisify(execFile);

export class WindowsCoreAudioBridge {
  private static binaryPath: string | null = null;
  private static scriptPath: string | null = null;
  private static lastMicError = 'No microphone operation has been attempted yet.';
  private static lastEndpointError = 'No per-application endpoint routing attempt has been made yet.';
  private static microphoneMethodByPid = new Map<number, 'session' | 'endpoint'>();

  public static init(): void {
    if (process.platform !== 'win32') return;

    try {
      // 1. Check for compiled native audio_bridge.exe
      const exeCandidates = [
        path.join(__dirname, 'audio_bridge.exe'),
        path.join(__dirname, '../dist/audio_bridge.exe'),
        path.join(process.cwd(), 'dist/audio_bridge.exe'),
        process.resourcesPath ? path.join(process.resourcesPath, 'dist/audio_bridge.exe') : '',
        process.resourcesPath ? path.join(process.resourcesPath, 'app.asar.unpacked/dist/audio_bridge.exe') : '',
        process.resourcesPath ? path.join(process.resourcesPath, 'app.asar.unpacked/audio_bridge.exe') : '',
        process.resourcesPath ? path.join(process.resourcesPath, 'audio_bridge.exe') : ''
      ].filter(Boolean);

      for (const p of exeCandidates) {
        if (fs.existsSync(p)) {
          this.binaryPath = p;
          console.log('[CoreAudioBridge] Native audio_bridge.exe found at:', p);
          break;
        }
      }

      // 2. Prepare coreAudio.ps1 script
      const tempScriptPath = path.join(app.getPath('temp'), 'super_audio_coreAudio.ps1');
      const scriptCandidates = [
        path.join(__dirname, '../../scripts/coreAudio.ps1'),
        path.join(__dirname, '../scripts/coreAudio.ps1'),
        path.join(process.cwd(), 'scripts/coreAudio.ps1'),
        process.resourcesPath ? path.join(process.resourcesPath, 'scripts/coreAudio.ps1') : ''
      ].filter(Boolean);

      let content = '';
      for (const p of scriptCandidates) {
        if (fs.existsSync(p)) {
          try {
            content = fs.readFileSync(p, 'utf8');
            break;
          } catch {}
        }
      }

      if (content) {
        fs.writeFileSync(tempScriptPath, content, 'utf8');
        this.scriptPath = tempScriptPath;
      } else {
        for (const p of scriptCandidates) {
          if (fs.existsSync(p)) {
            this.scriptPath = p;
            break;
          }
        }
      }
    } catch (err) {
      console.warn('[CoreAudioBridge] Init warning:', err);
    }
  }

  private static getScriptPath(): string {
    if (this.scriptPath && fs.existsSync(this.scriptPath)) {
      return this.scriptPath;
    }
    const tempPath = path.join(app.getPath('temp'), 'super_audio_coreAudio.ps1');
    if (fs.existsSync(tempPath)) {
      this.scriptPath = tempPath;
      return tempPath;
    }
    return path.join(process.cwd(), 'scripts/coreAudio.ps1');
  }

  /**
   * Enumerate real Windows processes through the bundled native bridge.
   * Returns an empty list if the bridge is unavailable so callers can use
   * independent fallbacks; never fabricates PIDs or executable paths.
   */
  public static async scanProcesses(): Promise<ProcessInfo[]> {
    if (!(this.binaryPath && fs.existsSync(this.binaryPath))) {
      console.warn('[CoreAudioBridge] Native process scan unavailable: audio_bridge.exe was not resolved.');
      return [];
    }
    try {
      const { stdout } = await execFileAsync(this.binaryPath, ['listprocesses'], {
        windowsHide: true,
        timeout: 10000,
        maxBuffer: 15 * 1024 * 1024
      });
      const trimmed = String(stdout || '').trim().replace(/^\uFEFF/, '');
      // Accept the JSON array even if a future bridge version adds harmless
      // informational text before/after it. Diagnostics belong on stderr.
      const jsonStart = trimmed.indexOf('[');
      const jsonEnd = trimmed.lastIndexOf(']');
      const jsonText = jsonStart >= 0 && jsonEnd >= jsonStart
        ? trimmed.slice(jsonStart, jsonEnd + 1)
        : trimmed;
      const parsed = JSON.parse(jsonText);
      const rows = Array.isArray(parsed) ? parsed : [];
      const result: ProcessInfo[] = [];
      const seenPids = new Set<number>();
      for (const row of rows) {
        const pid = Number(row?.pid);
        if (!Number.isInteger(pid) || pid <= 4 || seenPids.has(pid)) continue;
        const rawName = String(row?.name || '').trim();
        if (!rawName) continue;
        const name = rawName.toLowerCase().endsWith('.exe') ? rawName : `${rawName}.exe`;
        const windowTitle = String(row?.windowTitle || '').trim();
        const categorized = categorizeProcess(name, windowTitle);
        seenPids.add(pid);
        result.push({
          pid,
          name,
          displayName: categorized.displayName || windowTitle || name.replace(/\.exe$/i, ''),
          executablePath: String(row?.executablePath || ''),
          category: categorized.category,
          isRunning: true,
          hasAudioSession: false,
          memoryMb: Number.isFinite(Number(row?.memoryMb)) ? Number(row.memoryMb) : undefined
        });
      }
      result.sort((a, b) => a.name.localeCompare(b.name) || a.pid - b.pid);
      if (result.length === 0) {
        console.warn(`[CoreAudioBridge] Native process scan returned ${rows.length} rows but normalized to zero valid processes.`);
      } else {
        console.log(`[CoreAudioBridge] Native process scan found ${result.length} processes.`);
      }
      return result;
    } catch (err) {
      console.warn('[CoreAudioBridge] Native process scan failed; using fallback scanner:', String(err));
      return [];
    }
  }

  /**
   * Set process volume (0 - 100).
   */
  public static async setVolume(pid: number, volumePercent: number, processName = ''): Promise<boolean> {
    const scalar = (Math.max(0, Math.min(100, volumePercent)) / 100.0).toFixed(3);

    // Fast path: compiled native binary (runs in ~3ms)
    if (this.binaryPath && fs.existsSync(this.binaryPath)) {
      try {
        const args = ['setvolume', String(pid), scalar];
        if (processName) args.push(processName);
        const { stdout } = await execFileAsync(this.binaryPath, args, { windowsHide: true, timeout: 2000 });
        return stdout.trim().toLowerCase() === 'true';
      } catch (err) {
        console.warn('[CoreAudioBridge] binary setVolume error, falling back to ps1:', err);
      }
    }

    // Do not fall back to the legacy PowerShell implementation for control operations.
    // The standalone WASAPI bridge is the source of truth for per-session controls.
    return false;
  }

  /**
   * Set process mute state.
   */
  public static async setMute(pid: number, isMuted: boolean, processName = ''): Promise<boolean> {
    // Fast path: compiled native binary
    if (this.binaryPath && fs.existsSync(this.binaryPath)) {
      try {
        const args = ['setmute', String(pid), isMuted ? '1' : '0'];
        if (processName) args.push(processName);
        const { stdout } = await execFileAsync(this.binaryPath, args, { windowsHide: true, timeout: 2000 });
        return stdout.trim().toLowerCase() === 'true';
      } catch (err) {
        console.warn('[CoreAudioBridge] binary setMute error, falling back to ps1:', err);
      }
    }

    return false;
  }

  /**
   * Return whether a safe silent capture endpoint (normally VB-CABLE Output) exists.
   */
  public static async getMicrophoneStatus(): Promise<{
    virtualDriverInstalled: boolean;
    activeHooks: number;
    engineReady: boolean;
    silentEndpointId?: string;
    silentEndpointName?: string;
  }> {
    const engineReady = !!(this.binaryPath && fs.existsSync(this.binaryPath));
    try {
      const endpoints = await this.getEndpoints();
      const candidates = endpoints?.recording || [];
      const silent = candidates.find((d) =>
        /CABLE Output|VB-Audio Cable|VB-Audio.*Cable|Virtual Audio Cable|Silent Microphone|SAC Silent Mic/i.test(d.name)
      );
      return {
        virtualDriverInstalled: !!silent,
        activeHooks: 0,
        engineReady,
        silentEndpointId: silent?.id,
        silentEndpointName: silent?.name
      };
    } catch (err) {
      console.warn('[CoreAudioBridge] Mic status query failed:', err);
      return { virtualDriverInstalled: false, activeHooks: 0, engineReady };
    }
  }

  /**
   * Per-app microphone mute is implemented by routing the selected app to a silent
   * virtual capture endpoint (typically VB-CABLE's "CABLE Output"). Unmute restores
   * the app's previously selected physical capture endpoint. The physical/default
   * microphone is never muted by this method.
   */
  public static getLastMicrophoneError(): string {
    return this.lastMicError;
  }

  /**
   * Launch the bundled VB-CABLE installer only on explicit user request. Windows
   * requires elevation to install an audio driver; this method never elevates or
   * installs anything silently. The vendor's installer can require a reboot.
   */
  public static async installSilentCaptureDriver(): Promise<{ success: boolean; message: string }> {
    const zipName = 'VBCABLE_Driver_Pack45.zip';
    const candidates = [
      process.resourcesPath ? path.join(process.resourcesPath, 'app.asar.unpacked', 'vendor', 'vb-cable', zipName) : '',
      path.join(__dirname, '../../vendor/vb-cable', zipName),
      path.join(process.cwd(), 'vendor/vb-cable', zipName)
    ].filter(Boolean);
    const archivePath = candidates.find((candidate) => fs.existsSync(candidate));
    if (!archivePath) {
      const message = 'The bundled VB-CABLE installer was not found. Rebuild the app while connected to the internet, or download the official driver from https://vb-audio.com/Cable/.';
      this.lastMicError = message;
      return { success: false, message };
    }

    const installRoot = path.join(app.getPath('temp'), `SuperAudioControl-VBCABLE-${Date.now()}`);
    try {
      fs.mkdirSync(installRoot, { recursive: true });
      const quotePowerShell = (value: string) => `'${value.replace(/'/g, "''")}'`;
      const zipArg = quotePowerShell(archivePath);
      const destArg = quotePowerShell(installRoot);
      const script = [
        "$ErrorActionPreference = 'Stop'",
        `$zip = ${zipArg}`,
        `$destination = ${destArg}`,
        'Expand-Archive -LiteralPath $zip -DestinationPath $destination -Force',
        "$installer = Get-ChildItem -LiteralPath $destination -Filter 'VBCABLE_Setup_x64.exe' -Recurse -File | Select-Object -First 1 -ExpandProperty FullName",
        "if (-not $installer) { throw 'VBCABLE_Setup_x64.exe was not found in the vendor archive.' }",
        '$process = Start-Process -FilePath $installer -Verb RunAs -PassThru -Wait',
        'if ($process.ExitCode -ne 0) { exit $process.ExitCode }',
        'exit 0'
      ].join('; ');

      await execFileAsync('powershell.exe', [
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-Command', script
      ], { windowsHide: true, timeout: 10 * 60 * 1000 });

      const message = 'VB-CABLE setup was closed. Restart Windows to finish installing the microphone-routing driver, then open Super Audio Control and click Audio Devices. VB-CABLE is donationware from VB-Audio: https://vb-audio.com/Services/licensing.htm.';
      this.lastMicError = '';
      return { success: true, message };
    } catch (err) {
      const detail = String((err as NodeJS.ErrnoException & { stderr?: string; stdout?: string }).stderr || (err as Error).message || err).trim();
      const message = `VB-CABLE setup could not be completed. Approve the Windows administrator prompt and finish the vendor installer. ${detail}`;
      this.lastMicError = message;
      console.warn('[CoreAudioBridge] VB-CABLE installation was not completed:', detail);
      return { success: false, message };
    }
  }

  private static summarizeMicError(raw: string): string {
    const detail = String(raw || '').trim();
    if (!detail) return 'Windows rejected the per-app microphone route without returning diagnostics.';
    if (/0x80070057|E_INVALIDARG/i.test(detail)) {
      const captureLine = detail.split(/\r?\n/).map(line => line.trim()).find(line => /\[SetMicMute\] Capture-session mute unavailable:/i.test(line));
      const captureHint = captureLine ? ` Capture-session detail: ${captureLine.replace(/^.*?Capture-session mute unavailable:\s*/i, '')}` : '';
      return `Windows rejected the per-app endpoint fallback (HRESULT 0x80070057: E_INVALIDARG). VB-CABLE is detected, so this is not a missing-driver issue.${captureHint} The app did not mute the physical microphone globally. If session mute is not exposed by this app, a different capture-routing architecture is required.`;
    }
    const useful = detail.split(/\r?\n/).map(line => line.trim()).filter(line => line && (/\[SetMicMute\]|\[SetEndpoint\]|0x[0-9a-f]{8}/i.test(line)));
    const selected = useful.length ? useful[useful.length - 1] : detail.split(/\r?\n/).filter(Boolean).slice(-1)[0];
    return String(selected || detail).slice(0, 700);
  }

  /**
   * Per-app microphone mute uses Windows per-application capture routing to send
   * the selected app to an installed silent capture endpoint. This is not a native
   * per-process mic-mute API; apps that explicitly pin their own input device may
   * need to be restarted or changed to use the Windows/default input device.
   */
  public static async setMicrophoneState(pid: number, executablePath: string, enabled: boolean, restoreDeviceId = ''): Promise<boolean> {
    const procName = executablePath ? path.basename(executablePath) : '';

    if (!pid || pid <= 0) {
      this.lastMicError = 'The application is not running. Start it before changing microphone routing.';
      console.warn('[CoreAudioBridge] ' + this.lastMicError);
      return false;
    }

    if (!(this.binaryPath && fs.existsSync(this.binaryPath))) {
      this.lastMicError = 'The native audio bridge is missing. Rebuild the application with scripts\\build.ps1.';
      console.warn('[CoreAudioBridge] ' + this.lastMicError);
      return false;
    }

    const previousMethod = this.microphoneMethodByPid.get(pid);
    let resolvedRestoreDeviceId = restoreDeviceId;
    // Session-level unmute does not require a virtual endpoint or a restore device.
    // Only validate a physical restore endpoint when endpoint routing was used before
    // or when the operation is a first-time unmute with no stored method.
    if (enabled && previousMethod !== 'session') {
      const endpoints = await this.getEndpoints();
      const captureDevices = endpoints?.recording || [];
      const restoreIsPresent = !!resolvedRestoreDeviceId && resolvedRestoreDeviceId !== 'default'
        && captureDevices.some((device) => device.id === resolvedRestoreDeviceId);
      if (!restoreIsPresent) {
        resolvedRestoreDeviceId = captureDevices.find((device) => device.isDefault)?.id || '';
      }
      if (!resolvedRestoreDeviceId) {
        this.lastMicError = 'Windows did not report an active microphone endpoint to restore. Refresh Audio Devices, enable a recording device in Windows Sound settings, and try again.';
        console.warn('[CoreAudioBridge] ' + this.lastMicError);
        return false;
      }
    }

    try {
      // The native bridge tries per-app capture-session mute first. VB-CABLE routing
      // is attempted only if Windows does not expose a muteable capture session.
      const muteArg = enabled ? '0' : '1';
      const preferredMethod = enabled ? (previousMethod || 'auto') : 'auto';
      const { stdout, stderr } = await execFileAsync(
        this.binaryPath,
        ['setmicmute', String(pid), muteArg, procName, resolvedRestoreDeviceId, preferredMethod],
        { windowsHide: true, timeout: 5000 }
      );
      const response = stdout.trim().toLowerCase();
      if (response === 'true' || response.startsWith('true:')) {
        const method = response.includes(':') ? response.split(':')[1] : 'endpoint';
        if (enabled) this.microphoneMethodByPid.delete(pid);
        else this.microphoneMethodByPid.set(pid, method === 'session' ? 'session' : 'endpoint');
        this.lastMicError = '';
        return true;
      }

      this.lastMicError = WindowsCoreAudioBridge.summarizeMicError(stderr || stdout || 'Windows did not accept the per-app microphone route.');
      console.warn('[CoreAudioBridge] setmicmute failed:', this.lastMicError);
      return false;
    } catch (err) {
      const nativeErr = err as NodeJS.ErrnoException & { stderr?: string; stdout?: string };
      const detail = String(nativeErr.stderr || nativeErr.stdout || nativeErr.message || err).trim();
      this.lastMicError = WindowsCoreAudioBridge.summarizeMicError(detail || 'The native microphone routing operation failed without returning diagnostics.');
      console.warn('[CoreAudioBridge] Per-app microphone route failed:', this.lastMicError);
      return false;
    }
  }

  /**
   * Persist a per-application playback/capture endpoint using Windows' internal
   * AudioPolicyConfig factory. This is the same mechanism used by Windows'
   * App volume and device preferences UI and by EarTrumpet.
   */
  public static getLastEndpointError(): string {
    return this.lastEndpointError;
  }

  private static summarizeEndpointError(detail: string): string {
    const lines = String(detail || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const useful = lines.filter((line) => /\[SetEndpoint\]|activation failed|0x[0-9a-f]{8}|exception/i.test(line));
    const selected = useful.length ? useful.slice(-3) : lines.slice(-2);
    const message = selected.join(' | ').replace(/\s+/g, ' ').trim();
    return (message || 'The Windows audio-policy bridge returned no diagnostic details.').slice(-1800);
  }

  /**
   * Persist a per-application playback/capture endpoint using Windows' internal
   * AudioPolicyConfig factory. This interface is not a documented public API,
   * so return its actual failure diagnostics instead of reporting false success.
   */
  public static async setAppEndpoint(pid: number, deviceId: string, flow: string, processName = ''): Promise<boolean> {
    if (!pid || !deviceId) {
      this.lastEndpointError = `Invalid route request: PID=${pid}, endpointIdPresent=${Boolean(deviceId)}.`;
      return false;
    }

    if (this.binaryPath && fs.existsSync(this.binaryPath)) {
      try {
        const flowValue = flow === 'capture' || flow === 'input' ? '1' : '0';
        const { stdout, stderr } = await execFileAsync(this.binaryPath, ['setendpoint', String(pid), flowValue, deviceId, processName || ''], {
          windowsHide: true, timeout: 5000, maxBuffer: 2 * 1024 * 1024
        });
        const success = stdout.trim().toLowerCase() === 'true';
        if (success) {
          this.lastEndpointError = '';
          return true;
        }
        this.lastEndpointError = WindowsCoreAudioBridge.summarizeEndpointError(stderr || stdout);
        console.warn('[CoreAudioBridge] setAppEndpoint failed:', this.lastEndpointError);
        return false;
      } catch (err) {
        const nativeErr = err as NodeJS.ErrnoException & { stderr?: string; stdout?: string };
        this.lastEndpointError = WindowsCoreAudioBridge.summarizeEndpointError(nativeErr.stderr || nativeErr.stdout || nativeErr.message || String(err));
        console.warn('[CoreAudioBridge] binary setEndpoint failed:', this.lastEndpointError);
        return false;
      }
    }

    this.lastEndpointError = 'The native audio_bridge.exe was not found; per-application endpoint routing is unavailable.';
    console.warn('[CoreAudioBridge]', this.lastEndpointError);
    return false;
  }

  /**
   * Query real default and active endpoints directly from Windows WASAPI.
   */
  public static async getEndpoints(): Promise<{ playback: AudioDevice[]; recording: AudioDevice[] } | null> {
    // Fast path: compiled native binary
    if (this.binaryPath && fs.existsSync(this.binaryPath)) {
      try {
        const { stdout } = await execFileAsync(this.binaryPath, ['getendpoints'], { windowsHide: true, timeout: 3000 });
        const res = this.parseEndpoints(stdout);
        if (res) return res;
      } catch (err) {
        console.warn('[CoreAudioBridge] binary getEndpoints error, falling back to ps1:', err);
      }
    }

    // PowerShell path
    try {
      const script = this.getScriptPath();
      const { stdout } = await execFileAsync('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy', 'Bypass',
        '-File', script,
        '-Action', 'GetEndpoints'
      ], {
        timeout: 5000,
        windowsHide: true
      });
      return this.parseEndpoints(stdout);
    } catch (err) {
      console.warn('[CoreAudioBridge] getEndpoints error:', err);
    }
    return null;
  }

  private static parseEndpoints(stdout: string): { playback: AudioDevice[]; recording: AudioDevice[] } | null {
    if (stdout && stdout.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(stdout.trim());
        if (Array.isArray(parsed.playback) && parsed.playback.length > 0) {
          return {
            playback: parsed.playback.map((d: any) => ({
              id: d.id,
              name: d.name,
              adapterName: 'Windows Audio Device',
              flow: 'render' as const,
              state: 'active' as const,
              isDefault: Boolean(d.isDefault),
              channels: 2,
              sampleRate: 48000
            })),
            recording: Array.isArray(parsed.recording) ? parsed.recording.map((d: any) => ({
              id: d.id,
              name: d.name,
              adapterName: 'Windows Audio Device',
              flow: 'capture' as const,
              state: 'active' as const,
              isDefault: Boolean(d.isDefault),
              channels: 2,
              sampleRate: 48000
            })) : []
          };
        }
      } catch {}
    }
    return null;
  }

  public static getStatus(): { available: boolean; path: string; exists: boolean } {
    const p = this.binaryPath || '';
    return { available: Boolean(p && fs.existsSync(p)), path: p, exists: Boolean(p && fs.existsSync(p)) };
  }

  /**
   * Enumerate real Windows audio sessions with live volume and mute states.
   */
  public static async diagnose(pid: number, processName = ''): Promise<any | null> {
    if (!(this.binaryPath && fs.existsSync(this.binaryPath))) return null;
    try {
      const { stdout } = await execFileAsync(this.binaryPath, ['doctor', String(pid), processName || ''], { windowsHide: true, timeout: 3000 });
      return JSON.parse(stdout.trim());
    } catch (err) {
      console.warn('[CoreAudioBridge] diagnose error:', err);
      return null;
    }
  }

  public static async getSessions(): Promise<AudioSessionInfo[]> {
    // Fast path: compiled native binary
    if (this.binaryPath && fs.existsSync(this.binaryPath)) {
      try {
        const { stdout } = await execFileAsync(this.binaryPath, ['getsessions'], { windowsHide: true, timeout: 3000 });
        const sessions = this.parseSessions(stdout);
        if (sessions.length > 0) return sessions;
      } catch (err) {
        console.warn('[CoreAudioBridge] binary getSessions error, falling back to ps1:', err);
      }
    }

    // PowerShell path
    try {
      const script = this.getScriptPath();
      const { stdout } = await execFileAsync('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy', 'Bypass',
        '-File', script,
        '-Action', 'GetSessions'
      ], {
        timeout: 5000,
        windowsHide: true,
        maxBuffer: 5 * 1024 * 1024
      });
      return this.parseSessions(stdout);
    } catch (err) {
      console.warn('[CoreAudioBridge] getSessions error:', err);
    }
    return [];
  }

  private static parseSessions(stdout: string): AudioSessionInfo[] {
    if (stdout && stdout.trim().startsWith('[')) {
      try {
        const rawSessions = JSON.parse(stdout.trim());
        return rawSessions.map((s: any) => ({
          sessionId: `session_${s.pid}`,
          pid: s.pid,
          processName: s.processName,
          displayName: s.displayName,
          executablePath: s.executablePath || s.processName,
          volume: s.volume ?? 80,
          isMuted: Boolean(s.isMuted),
          peakMeter: Number(s.peakMeter ?? 0),
          state: s.state === 1 ? 'active' as const : s.state === 2 ? 'expired' as const : 'inactive' as const,
          deviceId: s.deviceId || ''
        }));
      } catch {}
    }
    return [];
  }
}
