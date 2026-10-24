import { HotkeyManager } from '../src/hotkeys/HotkeyManager';
import { ConfiguredApp } from '../src/shared/types';

export function testHotkeyConflictDetection() {
  const manager = new HotkeyManager();

  const app1: ConfiguredApp = {
    id: 'app_discord',
    executable: 'discord.exe',
    executablePath: 'C:\\Discord.exe',
    displayName: 'Discord',
    category: 'Voice & Chat',
    pid: 1000,
    isRunning: true,
    hasAudioSession: true,
    outputDeviceId: 'out1',
    volume: 80,
    volumeStep: 5,
    isMuted: false,
    peakMeter: 0,
    inputDeviceId: 'in1',
    micEnabled: true,
    micState: 'active',
    shortcuts: {
      volumeUp: 'Ctrl + Alt + Up',
      volumeMute: 'Ctrl + Alt + M'
    }
  };

  const app2: ConfiguredApp = {
    id: 'app_chrome',
    executable: 'chrome.exe',
    executablePath: 'C:\\chrome.exe',
    displayName: 'Chrome',
    category: 'Browsers',
    pid: 2000,
    isRunning: true,
    hasAudioSession: true,
    outputDeviceId: 'out1',
    volume: 80,
    volumeStep: 5,
    isMuted: false,
    peakMeter: 0,
    inputDeviceId: 'in1',
    micEnabled: true,
    micState: 'active',
    shortcuts: {
      volumeUp: 'Ctrl + Shift + Up'
    }
  };

  // Test conflict when Chrome tries to use Discord's volume mute shortcut
  const conflict = manager.detectConflict('Ctrl + Alt + M', 'app_chrome', 'volumeMute', [app1, app2]);
  if (!conflict) {
    throw new Error('Failed to detect key conflict for Ctrl + Alt + M');
  }
  if (conflict.appName !== 'Discord') {
    throw new Error(`Expected conflict app name 'Discord', got '${conflict.appName}'`);
  }

  // Test non-conflicting shortcut
  const noConflict = manager.detectConflict('Ctrl + Shift + N', 'app_chrome', 'microphoneMute', [app1, app2]);
  if (noConflict !== null) {
    throw new Error('False positive conflict reported for unique shortcut');
  }

  console.log('✓ testHotkeyConflictDetection passed');
}


export function testHotkeyNormalization() {
  const manager = new HotkeyManager();
  const cases: Array<[string, string]> = [
    ['Ctrl + Up', 'Ctrl+Up'],
    ['Ctrl+Alt+Right', 'Ctrl+Alt+Right'],
    ['CTRL + N', 'Ctrl+N'],
    ['Win + Shift + Escape', 'Shift+Win+Escape'],
    ['Ctrl + Plus', 'Ctrl+Plus']
  ];
  for (const [input, expected] of cases) {
    const actual = manager.normalizeShortcut(input);
    if (actual !== expected) throw new Error(`normalizeShortcut(${input}) expected ${expected}, got ${actual}`);
  }
  if (manager.normalizeShortcut('Ctrl + ') !== '') throw new Error('Invalid accelerator was not rejected.');
  console.log('✓ testHotkeyNormalization passed');
}
