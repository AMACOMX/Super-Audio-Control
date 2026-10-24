import { AudioSessionInfo } from '../shared/types';
import { logger } from '../logger/Logger';

export class AudioManager {
  public async setVolume(pid: number, volume: number, processName = ''): Promise<boolean> {
    const clamped = Math.max(0, Math.min(100, Math.round(volume)));
    logger.info('session', `Setting session volume: ${processName || 'PID ' + pid} -> ${clamped}%`);

    if (typeof window !== 'undefined' && window.electronAPI) {
      try {
        return await window.electronAPI.setAppVolume(pid, clamped, processName);
      } catch (err) {
        logger.error('session', `Failed to set session volume for PID ${pid}`, { error: String(err) });
        return false;
      }
    }
    return false;
  }

  public async setMute(pid: number, isMuted: boolean, processName = ''): Promise<boolean> {
    logger.info('session', `Setting session mute: ${processName || 'PID ' + pid} -> ${isMuted ? 'MUTED' : 'UNMUTED'}`);

    if (typeof window !== 'undefined' && window.electronAPI) {
      try {
        return await window.electronAPI.setAppMute(pid, isMuted, processName);
      } catch (err) {
        logger.error('session', `Failed to set mute for PID ${pid}`, { error: String(err) });
        return false;
      }
    }
    return false;
  }

  public async routeOutputDevice(pid: number, executablePath: string, deviceId: string): Promise<boolean> {
    logger.info('session', `Routing audio output: ${executablePath} (PID ${pid}) -> Endpoint ${deviceId}`);

    if (typeof window !== 'undefined' && window.electronAPI) {
      try {
        return await window.electronAPI.setAppAudioEndpoint(pid, deviceId, 'render', executablePath);
      } catch (err) {
        logger.error('session', `Failed to route audio device for ${executablePath}`, { error: String(err) });
        return false;
      }
    }
    return true;
  }

  public async routeInputDevice(pid: number, executablePath: string, deviceId: string): Promise<boolean> {
    logger.info('microphone', `Routing audio input: ${executablePath} (PID ${pid}) -> Endpoint ${deviceId}`);

    if (typeof window !== 'undefined' && window.electronAPI) {
      try {
        return await window.electronAPI.setAppAudioEndpoint(pid, deviceId, 'capture', executablePath);
      } catch (err) {
        logger.error('microphone', `Failed to route input device for ${executablePath}`, { error: String(err) });
        return false;
      }
    }
    return false;
  }

  public async getSessions(): Promise<AudioSessionInfo[]> {
    if (typeof window !== 'undefined' && window.electronAPI) {
      try {
        return await window.electronAPI.getAudioSessions();
      } catch (err) {
        logger.error('session', 'Failed to retrieve audio sessions', { error: String(err) });
      }
    }
    return [];
  }
}
