import { ConfiguredApp, AppSettings } from '../shared/types';
import { logger } from '../logger/Logger';

const STORAGE_KEY_APPS = 'super_audio_control_apps_v2';
const STORAGE_KEY_SETTINGS = 'super_audio_control_settings_v1';

export const DEFAULT_SETTINGS: AppSettings = {
  general: {
    startWithWindows: false,
    startMinimized: false,
    minimizeToTray: true,
    closeToTray: true
  },
  audio: {
    defaultOutputDeviceId: '',
    defaultInputDeviceId: '',
    defaultVolumeStep: 5,
    peakMeterRefreshMs: 50,
    useVirtualMicEngine: true
  },
  hotkeys: {
    enableGlobalShortcuts: true,
    preventConflicts: true
  },
  interface: {
    darkTheme: true,
    compactMode: false,
    showPids: true,
    showInactiveApps: true
  }
};

export const INITIAL_DEFAULT_APPS: ConfiguredApp[] = [];

export class SettingsManager {
  public static async loadApps(): Promise<ConfiguredApp[]> {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        return await window.electronAPI.loadConfig();
      }

      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(STORAGE_KEY_APPS);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      }
    } catch (err) {
      logger.error('system', 'Failed to load saved applications configuration', { error: String(err) });
    }

    // Default seed
    return INITIAL_DEFAULT_APPS;
  }

  public static async saveApps(apps: ConfiguredApp[]): Promise<boolean> {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        return await window.electronAPI.saveConfig(apps);
      }

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_APPS, JSON.stringify(apps));
        return true;
      }
    } catch (err) {
      logger.error('system', 'Failed to save application configuration', { error: String(err) });
    }
    return false;
  }

  public static async loadSettings(): Promise<AppSettings> {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        return await window.electronAPI.loadSettings();
      }

      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(STORAGE_KEY_SETTINGS);
        if (stored) {
          return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
        }
      }
    } catch (err) {
      logger.warn('system', 'Could not load settings, using defaults', { error: String(err) });
    }
    return DEFAULT_SETTINGS;
  }

  public static async saveSettings(settings: AppSettings): Promise<boolean> {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        return await window.electronAPI.saveSettings(settings);
      }

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
        return true;
      }
    } catch (err) {
      logger.error('system', 'Failed to save settings', { error: String(err) });
    }
    return false;
  }
}
