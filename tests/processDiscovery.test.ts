import { ProcessManager } from '../src/process/ProcessManager';
import { ConfiguredApp, ProcessInfo } from '../src/shared/types';

export function testProcessDiscoveryAndMatching() {
  const manager = new ProcessManager();
  
  // Test 1: Construction must not inject fake PIDs/processes. A real scan is
  // required before the manager can claim that an application is running.
  const procs = manager.getDiscoveredProcesses();
  if (procs.length !== 0) {
    throw new Error('ProcessManager must not seed synthetic running processes.');
  }

  // Test 2: Process matching & PID reconnect
  const initialApp: ConfiguredApp = {
    id: 'test_discord',
    executable: 'discord.exe',
    executablePath: 'C:\\Users\\User\\AppData\\Local\\Discord\\app-1.0.9015\\Discord.exe',
    displayName: 'Discord Voice & Video',
    category: 'Voice & Chat',
    pid: 9812,
    isRunning: true,
    hasAudioSession: true,
    outputDeviceId: 'mock_out',
    volume: 75,
    volumeStep: 5,
    isMuted: false,
    peakMeter: 0,
    inputDeviceId: 'mock_in',
    micEnabled: true,
    micState: 'active',
    shortcuts: { volumeUp: 'Ctrl + Alt + Up' }
  };

  // Simulate Discord closing and reopening with new PID 12044
  const updatedProcesses: ProcessInfo[] = [
    {
      pid: 12044,
      name: 'discord.exe',
      displayName: 'Discord Voice & Video',
      executablePath: 'C:\\Users\\User\\AppData\\Local\\Discord\\app-1.0.9015\\Discord.exe',
      category: 'Voice & Chat',
      isRunning: true,
      hasAudioSession: true
    }
  ];

  const matched = manager.matchSavedApps([initialApp], updatedProcesses);
  if (matched.length !== 1) throw new Error('Expected 1 matched app');
  if (matched[0].pid !== 12044) throw new Error(`Expected new PID 12044, got ${matched[0].pid}`);
  if (matched[0].volume !== 75) throw new Error('Saved volume was wiped on PID reconnect');
  if (matched[0].shortcuts.volumeUp !== 'Ctrl + Alt + Up') throw new Error('Saved shortcuts wiped on PID reconnect');

  // Test 3: Process exited
  const offlineMatched = manager.matchSavedApps([initialApp], []);
  if (offlineMatched[0].isRunning !== false) throw new Error('App should be marked offline');
  if (offlineMatched[0].pid !== null) throw new Error('PID should be null when offline');
  if (offlineMatched[0].volume !== 75) throw new Error('Volume should still be preserved when offline');

  console.log('✓ testProcessDiscoveryAndMatching passed');
}
