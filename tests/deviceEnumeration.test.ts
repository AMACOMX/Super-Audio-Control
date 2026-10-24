import { DeviceManager } from '../src/audio/DeviceManager';
import { AudioDevice } from '../src/shared/types';

export async function testDeviceEnumeration() {
  const playbackDevice: AudioDevice = {
    id: '{0.0.0.00000000}.{test-playback}',
    name: 'Test Speakers',
    adapterName: 'Test Audio Adapter',
    flow: 'render',
    state: 'active',
    isDefault: true,
    channels: 2,
    sampleRate: 48000
  };
  const recordingDevice: AudioDevice = {
    id: '{0.0.1.00000000}.{test-capture}',
    name: 'Test Microphone',
    adapterName: 'Test Audio Adapter',
    flow: 'capture',
    state: 'active',
    isDefault: true,
    channels: 2,
    sampleRate: 48000
  };

  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  let nextResult = { playback: [playbackDevice], recording: [recordingDevice] };
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    writable: true,
    value: {
      electronAPI: {
        rescanAudioDevices: async () => nextResult
      }
    }
  });

  try {
    const manager = new DeviceManager();
    const devices = await manager.scanDevices();
    if (devices.playback.length !== 1 || devices.playback[0].id !== playbackDevice.id) {
      throw new Error('DeviceManager did not return the playback endpoint from the Windows host.');
    }
    if (devices.recording.length !== 1 || devices.recording[0].id !== recordingDevice.id) {
      throw new Error('DeviceManager did not return the capture endpoint from the Windows host.');
    }
    if (!devices.playback[0].isDefault || !devices.recording[0].isDefault) {
      throw new Error('Default endpoint markers were not preserved.');
    }

    // An empty native rescan must clear old results instead of retaining stale
    // device IDs or inventing VB-CABLE as a fake capture endpoint.
    nextResult = { playback: [], recording: [] };
    const empty = await manager.scanDevices();
    if (empty.playback.length !== 0 || empty.recording.length !== 0) {
      throw new Error('DeviceManager retained stale endpoints after an empty Windows scan.');
    }

    console.log('✓ testDeviceEnumeration passed');
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
}
