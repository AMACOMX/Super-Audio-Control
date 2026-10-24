import { INITIAL_DEFAULT_APPS, DEFAULT_SETTINGS } from '../src/settings/SettingsManager';

export function testConfiguration() {
  // Ensure no dummy / hardcoded applications are shipped in the initial configuration
  if (INITIAL_DEFAULT_APPS.length !== 0) {
    throw new Error('Initial configuration must have 0 dummy applications; real apps must be discovered dynamically');
  }

  if (DEFAULT_SETTINGS.audio.defaultVolumeStep !== 5) {
    throw new Error('Default volume step must be 5%');
  }

  if (DEFAULT_SETTINGS.audio.defaultOutputDeviceId !== '') {
    throw new Error('Default output device ID should not contain hardcoded dummy GUIDs');
  }

  if (INITIAL_DEFAULT_APPS.length !== 0) {
    throw new Error('Fresh installations must begin with an empty configured-app list');
  }

  console.log('✓ testConfiguration passed (zero dummy apps verified)');
}
