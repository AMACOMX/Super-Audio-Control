import { AudioDevice } from '../shared/types';
import { logger } from '../logger/Logger';

export class DeviceManager {
  // Only populate these arrays with device IDs returned by the Windows host.
  // Synthetic placeholders are dangerous here: endpoint routing requires real
  // Windows MMDevice IDs, and a fabricated VB-CABLE entry can make the UI claim
  // that per-app microphone routing is available when it is not.
  private playbackDevices: AudioDevice[] = [];
  private recordingDevices: AudioDevice[] = [];

  public async scanDevices(): Promise<{ playback: AudioDevice[]; recording: AudioDevice[] }> {
    logger.info('device', 'Scanning Windows Core Audio endpoints...');
    
    if (typeof window !== 'undefined' && window.electronAPI) {
      try {
        const res = await window.electronAPI.rescanAudioDevices();
        if (res) {
          // An empty native result is meaningful. Replace old data instead of
          // retaining stale/fabricated endpoint IDs from a prior scan.
          this.playbackDevices = Array.isArray(res.playback) ? res.playback : [];
          this.recordingDevices = Array.isArray(res.recording) ? res.recording : [];
          logger.info('device', `Core Audio returned ${this.playbackDevices.length} playback and ${this.recordingDevices.length} capture devices.`);
          return {
            playback: [...this.playbackDevices],
            recording: [...this.recordingDevices]
          };
        }
      } catch (err) {
        // The host call failed; clear stale endpoint IDs rather than returning
        // choices that may no longer exist on this computer.
        this.playbackDevices = [];
        this.recordingDevices = [];
        logger.error('device', 'Error enumerating native audio endpoints', { error: String(err) });
      }
    }

    // Web Audio IDs are not Windows MMDevice IDs. Use them only for browser
    // previews; never offer them to the Windows per-app routing backend.
    const isElectronHost = typeof window !== 'undefined' && Boolean(window.electronAPI);
    if (!isElectronHost && typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      try {
        const mediaDevs = await navigator.mediaDevices.enumerateDevices();
        const browserAudioInputs = mediaDevs.filter(d => d.kind === 'audioinput');
        const browserAudioOutputs = mediaDevs.filter(d => d.kind === 'audiooutput');

        if (browserAudioOutputs.length > 0) {
          this.playbackDevices = browserAudioOutputs.map((d, i) => ({
            id: d.deviceId || `{0.0.0.00000000}.{browser_out_${i}}`,
            name: d.label || `Audio Output ${i + 1}`,
            flow: 'render',
            state: 'active',
            isDefault: i === 0,
            channels: 2,
            sampleRate: 48000
          }));
        }

        if (browserAudioInputs.length > 0) {
          this.recordingDevices = browserAudioInputs.map((d, i) => ({
            id: d.deviceId || `{0.0.1.00000000}.{browser_in_${i}}`,
            name: d.label || `Microphone ${i + 1} (WASAPI)`,
            flow: 'capture',
            state: 'active',
            isDefault: i === 0,
            channels: 2,
            sampleRate: 48000
          }));
        }
      } catch {
        // Permission or environment restriction. Leave unavailable devices empty.
      }
    }

    logger.info('device', `Audio devices refreshed. Playback: ${this.playbackDevices.length}, Recording: ${this.recordingDevices.length}`);
    return {
      playback: [...this.playbackDevices],
      recording: [...this.recordingDevices]
    };
  }

  public getPlaybackDevices(): AudioDevice[] {
    return [...this.playbackDevices];
  }

  public getRecordingDevices(): AudioDevice[] {
    return [...this.recordingDevices];
  }

  public findDeviceById(id: string): AudioDevice | undefined {
    return this.playbackDevices.find(d => d.id === id) || this.recordingDevices.find(d => d.id === id);
  }
}
