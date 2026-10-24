import { logger } from '../logger/Logger';

export interface MicEngineStatus {
  virtualDriverInstalled: boolean;
  activeHooks: number;
  engineReady: boolean;
  physicalMicDetected: boolean;
  silentEndpointId?: string;
  silentEndpointName?: string;
}

export class MicrophoneManager {
  private engineStatus: MicEngineStatus = {
    virtualDriverInstalled: false,
    activeHooks: 0,
    engineReady: true,
    physicalMicDetected: true
  };

  public async getStatus(): Promise<MicEngineStatus> {
    if (typeof window !== 'undefined' && window.electronAPI) {
      try {
        const nativeStatus = await window.electronAPI.getMicrophoneEngineStatus();
        this.engineStatus = {
          ...this.engineStatus,
          virtualDriverInstalled: nativeStatus.virtualDriverInstalled,
          activeHooks: nativeStatus.activeHooks,
          engineReady: nativeStatus.engineReady,
          silentEndpointId: nativeStatus.silentEndpointId,
          silentEndpointName: nativeStatus.silentEndpointName
        };
      } catch (err) {
        logger.warn('microphone', 'Could not query native microphone engine status', { error: String(err) });
      }
    }
    return { ...this.engineStatus };
  }

  public async setAppMicrophone(pid: number | null, executablePath: string, enabled: boolean, restoreDeviceId = ""): Promise<boolean> {
    logger.info('microphone', `Per-App Mic Toggle: ${executablePath} (PID ${pid ?? 'offline'}) -> ${enabled ? 'ENABLED' : 'MUTED'}`);

    if (typeof window !== 'undefined' && window.electronAPI && pid !== null) {
      try {
        const ok = await window.electronAPI.setAppMicrophoneState(pid, executablePath, enabled, restoreDeviceId);
        logger.info('microphone', `Microphone engine responded: ${ok ? 'Success' : 'Routing failed'}`);
        return ok;
      } catch (err) {
        logger.error('microphone', `Failed to apply per-app mic mute on ${executablePath}`, { error: String(err) });
        return false;
      }
    }

    return false;
  }
  public async getLastError(): Promise<string> {
    if (typeof window !== 'undefined' && window.electronAPI) {
      try {
        return await window.electronAPI.getLastMicrophoneError();
      } catch (err) {
        return `Could not retrieve native microphone diagnostics: ${String(err)}`;
      }
    }
    return 'The application is not running in the Windows desktop host.';
  }

}
