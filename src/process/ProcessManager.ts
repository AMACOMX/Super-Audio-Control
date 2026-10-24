import { ProcessInfo, ConfiguredApp } from '../shared/types';
import { categorizeProcess } from '../shared/categories';
import { logger } from '../logger/Logger';

export class ProcessManager {
  private discoveredProcesses: ProcessInfo[] = [];

  public async scanProcesses(): Promise<ProcessInfo[]> {
    logger.info('process', 'Enumerating Windows processes...');

    if (typeof window !== 'undefined' && window.electronAPI) {
      try {
        const procs = await window.electronAPI.scanProcesses();
        if (Array.isArray(procs)) {
          // Empty means the native scan currently found no processes; do not
          // keep stale PIDs that could target an unrelated process later.
          this.discoveredProcesses = procs;
          logger.info('process', `Found ${procs.length} running processes via Windows host scan.`);
          return [...procs];
        }
      } catch (err) {
        logger.error('process', 'Native process enumeration failed', { error: String(err) });
      }
    }

    this.discoveredProcesses = [];
    logger.warn('process', 'Windows process enumeration is unavailable; returning no synthetic processes.');
    return [];
  }

  public getDiscoveredProcesses(): ProcessInfo[] {
    return [...this.discoveredProcesses];
  }

  /**
   * Reconnects saved application configurations with newly detected running processes.
   * Matches by executable name and path. If PID changed, updates PID while retaining
   * volume, mute, mic, routing, and hotkey configurations!
   */
  public matchSavedApps(savedApps: ConfiguredApp[], runningProcs: ProcessInfo[]): ConfiguredApp[] {
    return savedApps.map(app => {
      // Find matching process by path or executable name
      const matchingProc = runningProcs.find(p => 
        (p.executablePath && app.executablePath && p.executablePath.toLowerCase() === app.executablePath.toLowerCase()) ||
        p.name.toLowerCase() === app.executable.toLowerCase()
      );

      if (matchingProc) {
        return {
          ...app,
          pid: matchingProc.pid,
          isRunning: true,
          hasAudioSession: matchingProc.hasAudioSession,
          category: matchingProc.category || app.category
        };
      } else {
        // App is currently not running, but we retain all configurations!
        return {
          ...app,
          pid: null,
          isRunning: false,
          hasAudioSession: false
        };
      }
    });
  }

  public createConfiguredAppFromProcess(proc: ProcessInfo, defaultOutputId: string, defaultInputId: string): ConfiguredApp {
    const { category, displayName } = categorizeProcess(proc.name, proc.displayName);
    return {
      id: `app_${proc.name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`,
      executable: proc.name,
      executablePath: proc.executablePath,
      displayName: displayName || proc.displayName,
      category,
      pid: proc.pid,
      isRunning: true,
      hasAudioSession: proc.hasAudioSession,
      outputDeviceId: defaultOutputId,
      volume: 80,
      volumeStep: 5,
      isMuted: false,
      peakMeter: 0,
      inputDeviceId: defaultInputId,
      micEnabled: true,
      micState: 'active',
      micStatusMessage: 'Mic Live & Active',
      shortcuts: {
        volumeUp: undefined,
        volumeDown: undefined,
        volumeMute: undefined,
        microphoneMute: undefined
      }
    };
  }
}
