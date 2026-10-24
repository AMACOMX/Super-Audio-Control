/**
 * Super Audio Control - Universal Type Definitions
 * Shared across Electron Main, Renderer, and the Windows audio bridge
 */

export type AudioFlow = 'render' | 'capture';
export type DeviceState = 'active' | 'disabled' | 'notpresent' | 'unplugged';

export interface AudioDevice {
  id: string; // Windows Core Audio Endpoint ID GUID
  name: string; // Friendly name (e.g., "Speakers (Realtek(R) Audio)")
  adapterName?: string;
  flow: AudioFlow; // 'render' = Playback, 'capture' = Recording
  state: DeviceState;
  isDefault: boolean;
  isDefaultCommunications?: boolean;
  channels: number;
  sampleRate: number;
}

export type AppCategory = 'All Apps' | 'Media' | 'Voice & Chat' | 'Games' | 'Browsers' | 'System';

export interface ProcessInfo {
  pid: number;
  name: string; // e.g. "discord.exe"
  displayName: string; // e.g. "Discord Voice & Video"
  executablePath: string; // C:\Users\...\Discord.exe
  iconUrl?: string; // Base64 data URI or SVG placeholder
  category: AppCategory;
  isRunning: boolean;
  hasAudioSession: boolean;
  cpuPercent?: number;
  memoryMb?: number;
}

export interface AudioSessionInfo {
  sessionId: string;
  pid: number;
  processName: string;
  displayName: string;
  executablePath?: string;
  volume: number; // 0 to 100
  isMuted: boolean;
  peakMeter: number; // 0 to 100 for live VU meters
  state: 'active' | 'inactive' | 'expired';
  deviceId: string; // Assigned output endpoint
}

export interface AppShortcuts {
  volumeUp?: string; // e.g. "Ctrl+Alt+Up"
  volumeDown?: string; // e.g. "Ctrl+Alt+Down"
  volumeMute?: string; // e.g. "Ctrl+Alt+M"
  microphoneMute?: string; // e.g. "Ctrl+Alt+N"
}

export interface ConfiguredApp {
  id: string; // Unique configuration ID (based on executable identity/path)
  executable: string; // e.g. "discord.exe"
  executablePath: string;
  displayName: string;
  category: AppCategory;
  pid: number | null; // null if not currently running
  isRunning: boolean;
  hasAudioSession: boolean;
  
  // Audio Playback Routing & Volume
  outputDeviceId: string; // Windows device ID or "default"
  volume: number; // 0 to 100
  volumeStep: number; // 1, 5, or 10
  isMuted: boolean;
  peakMeter: number; // Live VU meter

  // Per-App Microphone Control
  inputDeviceId: string; // Windows device ID or "default"
  micEnabled: boolean; // True = Mic live for this app; False = Muted/silenced
  micState: 'active' | 'muted' | 'unavailable';
  micStatusMessage?: string;

  // Shortcuts
  shortcuts: AppShortcuts;

  // Visual/UI
  customIcon?: string;
  hidden?: boolean;
}

export interface AppSettings {
  general: {
    startWithWindows: boolean;
    startMinimized: boolean;
    minimizeToTray: boolean;
    closeToTray: boolean;
  };
  audio: {
    defaultOutputDeviceId: string;
    defaultInputDeviceId: string;
    defaultVolumeStep: number; // 1, 5, 10
    peakMeterRefreshMs: number;
    useVirtualMicEngine: boolean;
  };
  hotkeys: {
    enableGlobalShortcuts: boolean;
    preventConflicts: boolean;
  };
  interface: {
    darkTheme: boolean;
    compactMode: boolean;
    showPids: boolean;
    showInactiveApps: boolean;
  };
}

export type ScanStatusType = 'idle' | 'scanning_devices' | 'scanning_apps' | 'scanning_sessions' | 'ready' | 'error';

export interface ScanStatus {
  status: ScanStatusType;
  message: string;
  progressPercent?: number;
  timestamp: number;
}

export interface DiagnosticLogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  category: 'system' | 'device' | 'session' | 'process' | 'hotkey' | 'microphone';
  message: string;
  details?: Record<string, unknown>;
}

export interface ElectronAPI {
  // Process & App discovery
  scanProcesses: () => Promise<ProcessInfo[]>;
  getProcessIcon: (executablePath: string) => Promise<string | null>;

  // Audio Device management
  getAudioDevices: () => Promise<{ playback: AudioDevice[]; recording: AudioDevice[] }>;
  rescanAudioDevices: () => Promise<{ playback: AudioDevice[]; recording: AudioDevice[] }>;
  setDefaultAudioEndpoint: (deviceId: string, flow: AudioFlow) => Promise<boolean>;
  setAppAudioEndpoint: (pid: number, deviceId: string, flow: AudioFlow, processName?: string) => Promise<boolean>;
  getLastEndpointRoutingError: () => Promise<string>;

  // WASAPI Audio Sessions
  getAudioSessions: () => Promise<AudioSessionInfo[]>;
  getAudioEngineStatus: () => Promise<{ available: boolean; path: string; exists: boolean }>;
  setAppVolume: (pid: number, volume: number, processName?: string) => Promise<boolean>;
  setAppMute: (pid: number, isMuted: boolean, processName?: string) => Promise<boolean>;

  // Per-App Microphone Engine
  setAppMicrophoneState: (pid: number, executablePath: string, enabled: boolean, restoreDeviceId?: string) => Promise<boolean>;
  getMicrophoneEngineStatus: () => Promise<{ virtualDriverInstalled: boolean; activeHooks: number; engineReady: boolean; silentEndpointId?: string; silentEndpointName?: string }>;
  getLastMicrophoneError: () => Promise<string>;
  installSilentMicDriver: () => Promise<{ success: boolean; message: string }>;
  openMicDriverDownloadPage: () => Promise<boolean>;
  openKoFiPage: () => Promise<boolean>;

  // Hotkeys
  registerShortcut: (shortcut: string, actionId: string) => Promise<boolean>;
  unregisterShortcut: (shortcut: string) => Promise<boolean>;
  unregisterAllShortcuts: () => Promise<void>;

  // Settings & Configuration
  loadConfig: () => Promise<ConfiguredApp[]>;
  saveConfig: (apps: ConfiguredApp[]) => Promise<boolean>;
  loadSettings: () => Promise<AppSettings>;
  saveSettings: (settings: AppSettings) => Promise<boolean>;
  exportConfig: () => Promise<string>;
  importConfig: (json: string) => Promise<boolean>;

  // Diagnostics & System
  getLogs: () => Promise<DiagnosticLogEntry[]>;
  writeDiagnosticLog: (entry: DiagnosticLogEntry) => void;
  clearDiagnosticLog: () => Promise<boolean>;
  openLogFolder: () => Promise<void>;
  openSystemSoundSettings: () => Promise<void>;
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  closeWindow: () => void;
  
  // Event Subscriptions
  onAudioDeviceChanged: (callback: (devices: { playback: AudioDevice[]; recording: AudioDevice[] }) => void) => () => void;
  onAudioSessionChanged: (callback: (sessions: AudioSessionInfo[]) => void) => () => void;
  onProcessExited: (callback: (pid: number) => void) => () => void;
  onProcessStarted: (callback: (proc: ProcessInfo) => void) => () => void;
  onShortcutTriggered: (callback: (actionId: string) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
