import { execFile } from 'child_process';
import util from 'util';
import { ProcessInfo, AudioDevice } from '../shared/types';
import { categorizeProcess } from '../shared/categories';

const execFileAsync = util.promisify(execFile);

/**
 * Enumerate running user applications on Windows using PowerShell.
 */
export async function scanWindowsProcesses(): Promise<ProcessInfo[]> {
  const excluded = /^(idle|system|registry|svchost|fontdrvhost|dwm|smss|csrss|wininit|services|lsass|winlogon|sihost|taskhostw|runtimebroker|conhost)$/i;

  // First fallback: PowerShell. Use an explicitly-created array and tolerate
  // protected processes whose executable path or window title cannot be read.
  try {
    const psScript = String.raw`
      $ErrorActionPreference = 'Stop'
      $items = @(Get-Process -ErrorAction SilentlyContinue | Where-Object {
        $_.Id -gt 4 -and $_.ProcessName -notmatch '^(idle|system|registry|svchost|fontdrvhost|dwm|smss|csrss|wininit|services|lsass|winlogon|sihost|taskhostw|runtimebroker|conhost)$'
      } | ForEach-Object {
        $exePath = ''; $title = ''
        try { $exePath = [string]$_.Path } catch {}
        try { $title = [string]$_.MainWindowTitle } catch {}
        [PSCustomObject]@{ Id = [int]$_.Id; ProcessName = [string]$_.ProcessName; Path = $exePath; MainWindowTitle = $title; WorkingSet64 = [long]$_.WorkingSet64 }
      })
      ConvertTo-Json -InputObject @($items) -Compress -Depth 3
    `;
    const { stdout } = await execFileAsync('powershell.exe', [
      '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', psScript
    ], {
      timeout: 15000,
      windowsHide: true,
      maxBuffer: 15 * 1024 * 1024
    });

    if (stdout && stdout.trim()) {
      const parsed: any = JSON.parse(stdout.trim().replace(/^\uFEFF/, ''));
      const items = Array.isArray(parsed) ? parsed : (parsed ? [parsed] : []);
      const results: ProcessInfo[] = [];
      const seenPids = new Set<number>();
      for (const item of items) {
        if (!item || !item.ProcessName) continue;
        const pid = Number(item.Id);
        if (!Number.isInteger(pid) || pid <= 4 || seenPids.has(pid)) continue;
        const rawName = String(item.ProcessName).trim();
        if (!rawName || excluded.test(rawName)) continue;
        const exeName = rawName.toLowerCase().endsWith('.exe') ? rawName : `${rawName}.exe`;
        const title = String(item.MainWindowTitle || '').trim();
        const catInfo = categorizeProcess(exeName, title);
        seenPids.add(pid);
        results.push({
          pid,
          name: exeName,
          displayName: catInfo.displayName || title || exeName.replace(/\.exe$/i, ''),
          executablePath: item.Path ? String(item.Path) : '',
          category: catInfo.category,
          isRunning: true,
          hasAudioSession: false,
          memoryMb: Number.isFinite(Number(item.WorkingSet64)) ? Math.round(Number(item.WorkingSet64) / (1024 * 1024)) : undefined
        });
      }
      if (results.length > 0) return results;
    }
  } catch (err) {
    console.warn('[WindowsSystem] PowerShell process scan failed; trying tasklist.exe:', String(err));
  }

  // Second fallback: tasklist.exe is present on supported Windows versions and
  // has no dependency on PowerShell's object serialization or script policy.
  try {
    const { stdout } = await execFileAsync('tasklist.exe', ['/FO', 'CSV', '/NH'], {
      timeout: 12000,
      windowsHide: true,
      maxBuffer: 15 * 1024 * 1024
    });
    const results: ProcessInfo[] = [];
    const seenPids = new Set<number>();
    for (const line of String(stdout || '').split(/\r?\n/)) {
      const match = line.match(/^"((?:[^"]|"")*)","(\d+)","((?:[^"]|"")*)","(\d+)","((?:[^"]|"")*)"/);
      if (!match) continue;
      const rawName = match[1].replace(/""/g, '"').trim();
      const pid = Number(match[2]);
      if (!rawName || !Number.isInteger(pid) || pid <= 4 || seenPids.has(pid)) continue;
      const baseName = rawName.toLowerCase().endsWith('.exe') ? rawName.slice(0, -4) : rawName;
      if (excluded.test(baseName)) continue;
      const exeName = rawName.toLowerCase().endsWith('.exe') ? rawName : `${rawName}.exe`;
      const catInfo = categorizeProcess(exeName);
      const memoryText = match[5].replace(/,/g, '');
      const memoryKb = Number.parseInt(memoryText.replace(/[^0-9]/g, ''), 10);
      seenPids.add(pid);
      results.push({
        pid,
        name: exeName,
        displayName: catInfo.displayName || exeName.replace(/\.exe$/i, ''),
        executablePath: '',
        category: catInfo.category,
        isRunning: true,
        hasAudioSession: false,
        memoryMb: Number.isFinite(memoryKb) ? Math.round(memoryKb / 1024) : undefined
      });
    }
    if (results.length) {
      console.info(`[WindowsSystem] tasklist.exe fallback found ${results.length} real processes.`);
      return results;
    }
  } catch (err) {
    console.warn('[WindowsSystem] tasklist.exe process scan failed:', String(err));
  }

  return [];
}

/**
 * Enumerate Windows Core Audio endpoints using MMDevices registry & WMI sound devices.
 */
export async function scanWindowsAudioDevices(): Promise<{ playback: AudioDevice[]; recording: AudioDevice[] }> {
  try {
    const psScript = `
      $out = @{ playback = @(); recording = @() }
      try {
        $renderPath = "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\MMDevices\\Audio\\Render"
        if (Test-Path $renderPath) {
          Get-ChildItem $renderPath -ErrorAction SilentlyContinue | ForEach-Object {
            $props = Get-ItemProperty "$($_.PSPath)\\Properties" -ErrorAction SilentlyContinue
            $name = $props.'{a45c254e-df1c-4efd-8020-67d146a850e0},2'
            $adapter = $props.'{b3f8fa53-0004-438e-9003-51a46e139bfc},6'
            $state = (Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue).DeviceState
            if ($state -eq 1 -and $name) {
              $out.playback += [PSCustomObject]@{
                id = "{0.0.0.00000000}." + $_.PSChildName
                name = [string]$name
                adapterName = if ($adapter) { [string]$adapter } else { "Windows Audio Device" }
                flow = "render"
                state = "active"
                isDefault = ($out.playback.Count -eq 0)
                channels = 2
                sampleRate = 48000
              }
            }
          }
        }

        $capturePath = "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\MMDevices\\Audio\\Capture"
        if (Test-Path $capturePath) {
          Get-ChildItem $capturePath -ErrorAction SilentlyContinue | ForEach-Object {
            $props = Get-ItemProperty "$($_.PSPath)\\Properties" -ErrorAction SilentlyContinue
            $name = $props.'{a45c254e-df1c-4efd-8020-67d146a850e0},2'
            $adapter = $props.'{b3f8fa53-0004-438e-9003-51a46e139bfc},6'
            $state = (Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue).DeviceState
            if ($state -eq 1 -and $name) {
              $out.recording += [PSCustomObject]@{
                id = "{0.0.1.00000000}." + $_.PSChildName
                name = [string]$name
                adapterName = if ($adapter) { [string]$adapter } else { "Windows Audio Device" }
                flow = "capture"
                state = "active"
                isDefault = ($out.recording.Count -eq 0)
                channels = 2
                sampleRate = 48000
              }
            }
          }
        }

        if ($out.playback.Count -eq 0) {
          Get-CimInstance Win32_SoundDevice -ErrorAction SilentlyContinue | ForEach-Object {
            if ($_.Status -eq 'OK') {
              $out.playback += [PSCustomObject]@{
                id = "{0.0.0.00000000}." + $_.DeviceID
                name = [string]$_.Name
                adapterName = [string]$_.Manufacturer
                flow = "render"
                state = "active"
                isDefault = ($out.playback.Count -eq 0)
                channels = 2
                sampleRate = 48000
              }
            }
          }
        }
      } catch {}
      $out | ConvertTo-Json -Compress -Depth 4
    `.trim();

    const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psScript], {
      timeout: 6000,
      windowsHide: true,
      maxBuffer: 5 * 1024 * 1024
    });

    if (stdout && stdout.trim().length > 0) {
      const parsed = JSON.parse(stdout.trim());
      const playback: AudioDevice[] = Array.isArray(parsed.playback) ? parsed.playback : (parsed.playback ? [parsed.playback] : []);
      const recording: AudioDevice[] = Array.isArray(parsed.recording) ? parsed.recording : (parsed.recording ? [parsed.recording] : []);

      // Keep the native result authoritative even when one or both flows are
      // empty. Never create endpoint IDs that do not exist on this PC.
      return { playback, recording };
    }
  } catch (err) {
    console.warn('[WindowsSystem] Native audio device scan warning:', err);
  }

  return { playback: [], recording: [] };
}

