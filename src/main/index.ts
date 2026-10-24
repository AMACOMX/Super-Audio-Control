import { app, BrowserWindow, ipcMain, globalShortcut, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { TrayManager } from '../tray/TrayManager';
import { ConfiguredApp, AppSettings, AudioDevice, AudioSessionInfo, ProcessInfo, DiagnosticLogEntry } from '../shared/types';
import { DEFAULT_SETTINGS, INITIAL_DEFAULT_APPS } from '../settings/SettingsManager';
import { scanWindowsProcesses, scanWindowsAudioDevices } from './windowsSystem';
import { WindowsCoreAudioBridge } from './windowsCoreAudioBridge';

// Native Windows Core Audio WASAPI bridge is initialized after Electron is ready.
// This guarantees packaged resource paths and app.getPath() are valid.
let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;
let trayManager: TrayManager | null = null;
let isQuitting = false;


// Keep registration ownership so changing a chord replaces the previous binding,
// and two configured actions cannot silently claim the same global key combination.
const acceleratorByAction = new Map<string, string>();
const actionByAccelerator = new Map<string, string>();

function toElectronAccelerator(input: string): string {
  if (!input || !input.trim()) return '';
  const parts = input.split('+').map((part) => part.trim()).filter(Boolean);
  const modifiers = new Set<string>();
  const keys: string[] = [];
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (['ctrl', 'control', 'cmdorctrl', 'commandorcontrol'].includes(lower)) modifiers.add('CommandOrControl');
    else if (['alt', 'option'].includes(lower)) modifiers.add('Alt');
    else if (lower === 'shift') modifiers.add('Shift');
    else if (['win', 'windows', 'super', 'meta'].includes(lower)) modifiers.add('Super');
    else {
      const aliases: Record<string, string> = {
        arrowup: 'Up', arrowdown: 'Down', arrowleft: 'Left', arrowright: 'Right',
        esc: 'Escape', escape: 'Escape', enter: 'Enter', return: 'Return', space: 'Space',
        pageup: 'PageUp', pagedown: 'PageDown', capslock: 'Capslock',
        printscreen: 'PrintScreen', plus: 'Plus', volumeup: 'VolumeUp',
        volumedown: 'VolumeDown', volumemute: 'VolumeMute', backspace: 'Backspace',
        delete: 'Delete', insert: 'Insert', home: 'Home', end: 'End', tab: 'Tab'
      };
      keys.push(aliases[lower] || (part.length === 1 ? part.toUpperCase() : part));
    }
  }
  if (keys.length !== 1) return '';
  const order = ['CommandOrControl', 'Alt', 'Shift', 'Super'];
  return [...order.filter((modifier) => modifiers.has(modifier)), keys[0]].join('+');
}

const USER_DATA_PATH = app.getPath('userData');
// v2 intentionally starts with an empty dashboard so legacy auto-discovered apps are not restored.
const CONFIG_FILE = path.join(USER_DATA_PATH, 'super_audio_apps_v2.json');
const SETTINGS_FILE = path.join(USER_DATA_PATH, 'super_audio_settings.json');
const PROGRAM_DIRECTORY = app.isPackaged
  ? path.dirname(process.execPath)
  : app.getAppPath();
const FALLBACK_LOG_DIRECTORY = path.join(USER_DATA_PATH, 'logs');
const MAX_LOG_BYTES = 50 * 1024 * 1024;
let diagnosticLogPath = path.join(PROGRAM_DIRECTORY, 'super-audio-control.log');
let diagnosticLogReady = false;
let diagnosticLogSize = 0;

function prepareDiagnosticLog(): void {
  const candidates = [
    path.join(PROGRAM_DIRECTORY, 'super-audio-control.log'),
    path.join(FALLBACK_LOG_DIRECTORY, 'super-audio-control.log')
  ];

  for (const candidate of candidates) {
    try {
      fs.mkdirSync(path.dirname(candidate), { recursive: true });
      // Clear the previous run completely, as requested.
      fs.writeFileSync(candidate, '', 'utf-8');
      diagnosticLogPath = candidate;
      diagnosticLogSize = 0;
      diagnosticLogReady = true;
      return;
    } catch (err) {
      // Try the fallback location if the executable directory is read-only.
      console.warn(`[Diagnostics] Could not initialize log at ${candidate}: ${String(err)}`);
    }
  }

  diagnosticLogReady = false;
}

function formatDiagnosticEntry(entry: DiagnosticLogEntry): string {
  const details = entry.details && Object.keys(entry.details).length > 0
    ? ` | ${JSON.stringify(entry.details)}`
    : '';
  return `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.category}] ${entry.message}${details}\n`;
}

function appendDiagnosticLine(line: string): void {
  if (!diagnosticLogReady) return;

  try {
    const data = Buffer.from(line, 'utf8');

    // Track bytes written by this process to avoid a synchronous stat call for
    // every console event. Logs are only written by this main-process mirror.
    if (diagnosticLogSize + data.length > MAX_LOG_BYTES) {
      fs.writeFileSync(diagnosticLogPath, '', 'utf8');
      diagnosticLogSize = 0;
    }
    fs.appendFileSync(diagnosticLogPath, data);
    diagnosticLogSize += data.length;
  } catch (err) {
    // Last-resort stderr output; never recurse through the mirrored console.
    diagnosticLogReady = false;
    try {
      process.stderr.write(`[Diagnostics] Failed to write diagnostic log: ${String(err)}\n`);
    } catch {
      // Ignore all diagnostic failures.
    }
  }
}

function installMainProcessLogMirror(): void {
  const originalLog = console.log.bind(console);
  const originalWarn = console.warn.bind(console);
  const originalError = console.error.bind(console);

  console.log = (...args: any[]) => {
    const message = args.map((arg) => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' ');
    appendDiagnosticLine(`[${new Date().toISOString()}] [MAIN-INFO] ${message}\n`);
    originalLog(...args);
  };
  console.warn = (...args: any[]) => {
    const message = args.map((arg) => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' ');
    appendDiagnosticLine(`[${new Date().toISOString()}] [MAIN-WARN] ${message}\n`);
    originalWarn(...args);
  };
  console.error = (...args: any[]) => {
    const message = args.map((arg) => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' ');
    appendDiagnosticLine(`[${new Date().toISOString()}] [MAIN-ERROR] ${message}\n`);
    originalError(...args);
  };
}

function resolveBrandAsset(...parts: string[]): string | undefined {
  const candidates = [
    path.join(app.getAppPath(), ...parts),
    path.join(__dirname, '..', ...parts),
    path.join(__dirname, '../..', ...parts),
    path.join(process.cwd(), ...parts),
    process.resourcesPath ? path.join(process.resourcesPath, ...parts) : ''
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function createSplashWindow(): void {
  const splashPath = resolveBrandAsset('assets', 'splash.html');
  if (!splashPath) {
    console.warn('[Branding] Splash HTML was not found; continuing without the splash screen.');
    return;
  }

  const iconPath = resolveBrandAsset('assets', 'icons', 'icon.ico')
    || resolveBrandAsset('assets', 'icons', 'icon.png');

  try {
    const win = new BrowserWindow({
      width: 500,
      height: 570,
      center: true,
      frame: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      show: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      backgroundColor: '#050914',
      title: 'Super Audio Control',
      icon: iconPath,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true
      }
    });
    splashWindow = win;
    win.once('ready-to-show', () => {
      if (!win.isDestroyed()) win.show();
    });
    win.on('closed', () => {
      if (splashWindow === win) splashWindow = null;
    });
    win.loadFile(splashPath).catch((err) => {
      console.warn('[Branding] Could not load splash screen:', err);
      if (!win.isDestroyed()) win.close();
    });
  } catch (err) {
    splashWindow = null;
    console.warn('[Branding] Could not create splash screen:', err);
  }
}

function revealMainWindow(): void {
  if (splashWindow && !splashWindow.isDestroyed()) {
    try { splashWindow.close(); } catch { /* Splash closure must not block startup. */ }
  }
  splashWindow = null;
  if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
    mainWindow.show();
  }
}

function createWindow(): void {
  const splashStartedAt = Date.now();
  createSplashWindow();
  const windowIcon = resolveBrandAsset('assets', 'icons', 'icon.ico')
    || resolveBrandAsset('assets', 'icons', 'icon.png');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 980,
    minHeight: 650,
    backgroundColor: '#0d0f11',
    autoHideMenuBar: true,
    title: 'Super Audio Control',
    icon: windowIcon,
    webPreferences: {
      preload: fs.existsSync(path.join(__dirname, 'preload.cjs'))
        ? path.join(__dirname, 'preload.cjs')
        : path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    show: false
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`[Renderer] Failed to load ${validatedURL}: ${errorDescription} (${errorCode})`);
  });

  // Load production bundle or Vite dev server
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    const localHtml = path.join(__dirname, 'index.html');
    if (fs.existsSync(localHtml)) {
      mainWindow.loadFile(localHtml);
    } else {
      mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
  }

  mainWindow.once('ready-to-show', () => {
    // Keep the branded splash visible briefly, then reveal the dashboard.
    const minimumSplashMs = 950;
    const remaining = Math.max(0, minimumSplashMs - (Date.now() - splashStartedAt));
    setTimeout(revealMainWindow, remaining);
  });

  // Safety fallback: never leave users stuck on the splash if the renderer is slow.
  setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) revealMainWindow();
  }, 6000);

  mainWindow.on('close', (event: any) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  // Initialize System Tray
  trayManager = new TrayManager(
    mainWindow,
    () => mainWindow?.webContents.send('event:triggerScanApps'),
    () => mainWindow?.webContents.send('event:triggerScanDevices'),
    () => mainWindow?.webContents.send('event:triggerOpenSettings'),
    (paused: boolean) => {
      // Suspend instead of unregistering: bindings must resume when the tray pause is lifted.
      try { globalShortcut.setSuspended(paused); }
      catch (err) { console.warn('[Hotkey] Could not change global shortcut suspension state:', err); }
    }
  );
  trayManager.init();
}

// IPC Handlers
ipcMain.handle('process:scan', async (): Promise<ProcessInfo[]> => {
  // Prefer the self-contained .NET bridge, then use PowerShell/tasklist if it is unavailable.
  let processes: ProcessInfo[] = await WindowsCoreAudioBridge.scanProcesses();
  if (processes.length === 0) {
    processes = await scanWindowsProcesses();
    console.info(`[IPC] PowerShell/tasklist fallback found ${processes.length} processes.`);
  } else {
    console.info(`[IPC] Core Audio bridge found ${processes.length} processes.`);
  }

  // Mark actual output sessions from WASAPI rather than treating every process
  // as an audio application. The process list also includes apps before they
  // open an audio stream so users can add them on demand.
  try {
    const sessions = await WindowsCoreAudioBridge.getSessions();
    const sessionPids = new Set(sessions.map((session) => session.pid));
    return processes.map((proc) => ({ ...proc, hasAudioSession: sessionPids.has(proc.pid) }));
  } catch (err) {
    console.warn('[IPC] Could not annotate process scan with live audio sessions:', err);
    return processes.map((proc) => ({ ...proc, hasAudioSession: false }));
  }
});

async function getAvailableAudioDevices(): Promise<{ playback: AudioDevice[]; recording: AudioDevice[] }> {
  try {
    const endpoints = await WindowsCoreAudioBridge.getEndpoints();
    if (endpoints && (endpoints.playback.length > 0 || endpoints.recording.length > 0)) return endpoints;
  } catch (err) {
    console.warn('[IPC] Core Audio endpoint enumeration failed; trying Windows fallback:', err);
  }
  return scanWindowsAudioDevices();
}

ipcMain.handle('audio:rescanDevices', () => getAvailableAudioDevices());
ipcMain.handle('audio:getDevices', () => getAvailableAudioDevices());

ipcMain.handle('audio:status', async () => WindowsCoreAudioBridge.getStatus());

ipcMain.handle('audio:getSessions', async (): Promise<AudioSessionInfo[]> => {
  // Return only real WASAPI sessions. Fabricating a session for each process
  // made failed volume/mute operations look like real controls in the UI.
  try {
    return await WindowsCoreAudioBridge.getSessions() || [];
  } catch (err) {
    console.warn('[IPC] WindowsCoreAudioBridge.getSessions error:', err);
    return [];
  }
});

ipcMain.handle('audio:diagnose', async (_event: any, pid: number, processName = '') => {
  return await WindowsCoreAudioBridge.diagnose(pid, processName);
});

ipcMain.handle('audio:setVolume', async (_event: any, pid: number, volume: number, processName = ''): Promise<boolean> => {
  return await WindowsCoreAudioBridge.setVolume(pid, volume, processName);
});

ipcMain.handle('audio:setMute', async (_event: any, pid: number, isMuted: boolean, processName = ''): Promise<boolean> => {
  return await WindowsCoreAudioBridge.setMute(pid, isMuted, processName);
});

ipcMain.handle('audio:setAppEndpoint', async (_event: any, pid: number, deviceId: string, flow: string, processName = ''): Promise<boolean> => {
  return await WindowsCoreAudioBridge.setAppEndpoint(pid, deviceId, flow, processName);
});
ipcMain.handle('audio:getLastEndpointError', () => WindowsCoreAudioBridge.getLastEndpointError());

ipcMain.handle('mic:setState', async (_event: any, pid: number, executablePath: string, enabled: boolean, restoreDeviceId = ''): Promise<boolean> => {
  return await WindowsCoreAudioBridge.setMicrophoneState(pid, executablePath, enabled, restoreDeviceId);
});

ipcMain.handle('mic:getStatus', async () => {
  return await WindowsCoreAudioBridge.getMicrophoneStatus();
});

ipcMain.handle('mic:getLastError', () => WindowsCoreAudioBridge.getLastMicrophoneError());
ipcMain.handle('mic:installSilentDriver', async () => WindowsCoreAudioBridge.installSilentCaptureDriver());
ipcMain.handle('mic:openDriverDownloadPage', async (): Promise<boolean> => {
  try {
    await shell.openExternal('https://vb-audio.com/Cable/');
    return true;
  } catch (err) {
    console.warn('[MicDriver] Could not open official VB-CABLE download page:', err);
    return false;
  }
});

// Open the creator's Ko-fi page through the main process. The URL is fixed here
// so the renderer cannot use this IPC handler to open arbitrary external URLs.
ipcMain.handle('donation:openKoFiPage', async (): Promise<boolean> => {
  try {
    await shell.openExternal('https://ko-fi.com/amacomx');
    return true;
  } catch (err) {
    console.warn('[Donation] Could not open Ko-fi page:', err);
    return false;
  }
});

ipcMain.handle('hotkey:register', async (_event: any, shortcut: string, actionId: string): Promise<boolean> => {
  const accelerator = toElectronAccelerator(shortcut);
  if (!accelerator || !actionId) {
    console.warn(`[Hotkey] Invalid shortcut/action received: ${JSON.stringify({ shortcut, actionId })}`);
    return false;
  }

  const existingForAction = acceleratorByAction.get(actionId);
  const owner = actionByAccelerator.get(accelerator);
  if (owner && owner !== actionId) {
    console.warn(`[Hotkey] ${accelerator} is already assigned to ${owner}; refused ${actionId}.`);
    return false;
  }
  if (existingForAction === accelerator && globalShortcut.isRegistered(accelerator)) return true;
  if (globalShortcut.isRegistered(accelerator) && owner !== actionId) {
    console.warn(`[Hotkey] ${accelerator} is already registered by another source.`);
    return false;
  }

  let ok = false;
  try {
    ok = globalShortcut.register(accelerator, () => {
      console.log(`[Hotkey] Fired ${accelerator} -> ${actionId}`);
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('event:shortcutTriggered', actionId);
    });
  } catch (err) {
    console.warn(`[Hotkey] Registration threw for ${accelerator}: ${String(err)}`);
    return false;
  }

  if (!ok) {
    console.warn(`[Hotkey] Electron failed to register ${accelerator} for ${actionId}. It may be occupied by another application.`);
    return false;
  }

  // Only switch tracking after the new accelerator was registered successfully.
  if (existingForAction && existingForAction !== accelerator) {
    globalShortcut.unregister(existingForAction);
    actionByAccelerator.delete(existingForAction);
  }
  acceleratorByAction.set(actionId, accelerator);
  actionByAccelerator.set(accelerator, actionId);
  console.log(`[Hotkey] Registered ${accelerator} -> ${actionId}`);
  return true;
});

ipcMain.handle('hotkey:unregister', async (_event: any, shortcut: string): Promise<boolean> => {
  const accelerator = toElectronAccelerator(shortcut);
  if (!accelerator) return false;
  globalShortcut.unregister(accelerator);
  const actionId = actionByAccelerator.get(accelerator);
  actionByAccelerator.delete(accelerator);
  if (actionId && acceleratorByAction.get(actionId) === accelerator) acceleratorByAction.delete(actionId);
  return true;
});

ipcMain.handle('hotkey:unregisterAll', async (): Promise<void> => {
  globalShortcut.unregisterAll();
  acceleratorByAction.clear();
  actionByAccelerator.clear();
});

// Settings & Config
ipcMain.handle('config:load', async (): Promise<ConfiguredApp[]> => {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed to read config file', err);
  }
  return INITIAL_DEFAULT_APPS;
});

ipcMain.handle('config:save', async (_event: any, apps: ConfiguredApp[]): Promise<boolean> => {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(apps, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Failed to save config file', err);
    return false;
  }
});

ipcMain.handle('settings:load', async (): Promise<AppSettings> => {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
    }
  } catch (err) {
    console.error('Failed to read settings file', err);
  }
  return DEFAULT_SETTINGS;
});

ipcMain.handle('settings:save', async (_event: any, settings: AppSettings): Promise<boolean> => {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Failed to save settings file', err);
    return false;
  }
});

ipcMain.on('diag:log', (_event: any, entry: DiagnosticLogEntry) => {
  appendDiagnosticLine(formatDiagnosticEntry(entry));
});

ipcMain.handle('diag:clearLog', async (): Promise<boolean> => {
  try {
    fs.writeFileSync(diagnosticLogPath, '', 'utf8');
    diagnosticLogSize = 0;
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('diag:openLogFolder', async (): Promise<void> => {
  await shell.openPath(path.dirname(diagnosticLogPath));
});

ipcMain.handle('diag:openSoundSettings', async (): Promise<void> => {
  shell.openExternal('ms-settings:sound');
});

// Window controls
ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
ipcMain.on('window:close', () => mainWindow?.close());

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    if (process.platform === 'win32') {
      app.setAppUserModelId('com.superaudio.control');
    }
    prepareDiagnosticLog();
    installMainProcessLogMirror();
    appendDiagnosticLine(`[${new Date().toISOString()}] [SYSTEM] Super Audio Control starting. Log file: ${diagnosticLogPath}\n`);
    WindowsCoreAudioBridge.init();
    createWindow();
  });
}

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  if (isQuitting) {
    app.quit();
  }
});
