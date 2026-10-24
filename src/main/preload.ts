import { contextBridge, ipcRenderer } from 'electron';
import { ElectronAPI, AudioDevice, AudioSessionInfo, ProcessInfo, ConfiguredApp, AppSettings, AudioFlow } from '../shared/types';

const api: ElectronAPI = {
  scanProcesses: () => ipcRenderer.invoke('process:scan'),
  getProcessIcon: (executablePath: string) => ipcRenderer.invoke('process:getIcon', executablePath),

  getAudioDevices: () => ipcRenderer.invoke('audio:getDevices'),
  rescanAudioDevices: () => ipcRenderer.invoke('audio:rescanDevices'),
  setDefaultAudioEndpoint: (deviceId: string, flow: AudioFlow) => 
    ipcRenderer.invoke('audio:setDefaultEndpoint', deviceId, flow),
  setAppAudioEndpoint: (pid: number, deviceId: string, flow: AudioFlow, processName?: string) =>
    ipcRenderer.invoke('audio:setAppEndpoint', pid, deviceId, flow, processName),
  getLastEndpointRoutingError: () => ipcRenderer.invoke('audio:getLastEndpointError'),

  getAudioSessions: () => ipcRenderer.invoke('audio:getSessions'),
  getAudioEngineStatus: () => ipcRenderer.invoke('audio:status'),
  setAppVolume: (pid: number, volume: number, processName?: string) => ipcRenderer.invoke('audio:setVolume', pid, volume, processName),
  setAppMute: (pid: number, isMuted: boolean, processName?: string) => ipcRenderer.invoke('audio:setMute', pid, isMuted, processName),

  setAppMicrophoneState: (pid: number, executablePath: string, enabled: boolean, restoreDeviceId?: string) => 
    ipcRenderer.invoke('mic:setState', pid, executablePath, enabled, restoreDeviceId || ''),
  getMicrophoneEngineStatus: () => ipcRenderer.invoke('mic:getStatus'),
  getLastMicrophoneError: () => ipcRenderer.invoke('mic:getLastError'),
  installSilentMicDriver: () => ipcRenderer.invoke('mic:installSilentDriver'),
  openMicDriverDownloadPage: () => ipcRenderer.invoke('mic:openDriverDownloadPage'),
  openKoFiPage: () => ipcRenderer.invoke('donation:openKoFiPage'),

  registerShortcut: (shortcut: string, actionId: string) => 
    ipcRenderer.invoke('hotkey:register', shortcut, actionId),
  unregisterShortcut: (shortcut: string) => 
    ipcRenderer.invoke('hotkey:unregister', shortcut),
  unregisterAllShortcuts: () => 
    ipcRenderer.invoke('hotkey:unregisterAll'),

  loadConfig: () => ipcRenderer.invoke('config:load'),
  saveConfig: (apps: ConfiguredApp[]) => ipcRenderer.invoke('config:save', apps),
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (settings: AppSettings) => ipcRenderer.invoke('settings:save', settings),
  exportConfig: () => ipcRenderer.invoke('config:export'),
  importConfig: (json: string) => ipcRenderer.invoke('config:import', json),

  getLogs: () => ipcRenderer.invoke('diag:getLogs'),
  writeDiagnosticLog: (entry) => ipcRenderer.send('diag:log', entry),
  clearDiagnosticLog: () => ipcRenderer.invoke('diag:clearLog'),
  openLogFolder: () => ipcRenderer.invoke('diag:openLogFolder'),
  openSystemSoundSettings: () => ipcRenderer.invoke('diag:openSoundSettings'),
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),

  onAudioDeviceChanged: (callback: (devices: { playback: AudioDevice[]; recording: AudioDevice[] }) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('event:audioDevicesChanged', handler);
    return () => ipcRenderer.removeListener('event:audioDevicesChanged', handler);
  },

  onAudioSessionChanged: (callback: (sessions: AudioSessionInfo[]) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('event:audioSessionsChanged', handler);
    return () => ipcRenderer.removeListener('event:audioSessionsChanged', handler);
  },

  onProcessExited: (callback: (pid: number) => void) => {
    const handler = (_event: any, pid: number) => callback(pid);
    ipcRenderer.on('event:processExited', handler);
    return () => ipcRenderer.removeListener('event:processExited', handler);
  },

  onProcessStarted: (callback: (proc: ProcessInfo) => void) => {
    const handler = (_event: any, proc: any) => callback(proc);
    ipcRenderer.on('event:processStarted', handler);
    return () => ipcRenderer.removeListener('event:processStarted', handler);
  },

  onShortcutTriggered: (callback: (actionId: string) => void) => {
    const handler = (_event: any, actionId: string) => callback(actionId);
    ipcRenderer.on('event:shortcutTriggered', handler);
    return () => ipcRenderer.removeListener('event:shortcutTriggered', handler);
  }
};

contextBridge.exposeInMainWorld('electronAPI', api);
