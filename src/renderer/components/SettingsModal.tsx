import React, { useState, useEffect } from 'react';
import { AppSettings, AudioDevice, DiagnosticLogEntry, ConfiguredApp } from '../../shared/types';
import { logger } from '../../logger/Logger';
import {
  X,
  Settings,
  Sliders,
  Keyboard,
  Palette,
  Terminal,
  Download,
  Upload,
  RotateCcw,
  Check,
  FolderOpen,
  Volume2,
  Mic,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  LoaderCircle
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSettings: (newSettings: AppSettings) => void;
  playbackDevices: AudioDevice[];
  recordingDevices: AudioDevice[];
  allApps: ConfiguredApp[];
  micRouteAvailable: boolean;
  micRouteName: string;
  micDriverInstallPending: boolean;
  onInstallMicDriver: () => void;
  onVisitMicDriverDownloadPage: () => void;
  onImportConfig: (importedApps: ConfiguredApp[]) => void;
  onResetConfig: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  playbackDevices,
  recordingDevices,
  allApps,
  micRouteAvailable,
  micRouteName,
  micDriverInstallPending,
  onInstallMicDriver,
  onVisitMicDriverDownloadPage,
  onImportConfig,
  onResetConfig
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'audio' | 'hotkeys' | 'interface' | 'diagnostics'>('general');
  const [formSettings, setFormSettings] = useState<AppSettings>(settings);
  const [logs, setLogs] = useState<DiagnosticLogEntry[]>([]);

  useEffect(() => {
    setFormSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (isOpen) {
      setLogs(logger.getLogs());
      const unsub = logger.subscribe(setLogs);
      return unsub;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleExport = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(allApps, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'super_audio_control_config.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], 'UTF-8');
      fileReader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (Array.isArray(parsed)) {
            onImportConfig(parsed);
            alert('Configuration imported successfully!');
          }
        } catch {
          alert('Invalid JSON configuration file.');
        }
      };
    }
  };

  const handleSave = () => {
    onSaveSettings(formSettings);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#12151a] border border-[#242c38] rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#202734]">
          <div className="flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-[#00b4d8]" />
            <div>
              <h2 className="text-base font-semibold text-white">Super Audio Control Settings</h2>
              <p className="text-xs text-[#8c96a5]">Global preferences, audio defaults, and diagnostics.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#9ca3af] hover:text-white hover:bg-[#1f2633] transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-[#202734] px-5 bg-[#161a22] gap-2 overflow-x-auto">
          {(
            [
              { id: 'general', label: 'General', icon: Settings },
              { id: 'audio', label: 'Audio', icon: Sliders },
              { id: 'hotkeys', label: 'Hotkeys', icon: Keyboard },
              { id: 'interface', label: 'Interface', icon: Palette },
              { id: 'diagnostics', label: 'Diagnostics & Logs', icon: Terminal }
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-3 px-3 text-xs font-medium border-b-2 flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'border-[#0099ff] text-white font-semibold'
                    : 'border-transparent text-[#9ca3af] hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-5 text-xs text-[#d1d5db] space-y-4">
          {activeTab === 'general' && (
            <div className="space-y-3">
              <label className="flex items-center justify-between p-3 bg-[#161a22] border border-[#202733] rounded-xl cursor-pointer">
                <div>
                  <div className="font-semibold text-white">Start with Windows</div>
                  <div className="text-[#8c96a5] text-[11px]">Launch Super Audio Control automatically on system login</div>
                </div>
                <input
                  type="checkbox"
                  checked={formSettings.general.startWithWindows}
                  onChange={(e) =>
                    setFormSettings({
                      ...formSettings,
                      general: { ...formSettings.general, startWithWindows: e.target.checked }
                    })
                  }
                  className="w-4 h-4 rounded accent-[#0099ff] cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-[#161a22] border border-[#202733] rounded-xl cursor-pointer">
                <div>
                  <div className="font-semibold text-white">Start Minimized</div>
                  <div className="text-[#8c96a5] text-[11px]">Start quietly in the background without focusing window</div>
                </div>
                <input
                  type="checkbox"
                  checked={formSettings.general.startMinimized}
                  onChange={(e) =>
                    setFormSettings({
                      ...formSettings,
                      general: { ...formSettings.general, startMinimized: e.target.checked }
                    })
                  }
                  className="w-4 h-4 rounded accent-[#0099ff] cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-[#161a22] border border-[#202733] rounded-xl cursor-pointer">
                <div>
                  <div className="font-semibold text-white">Minimize to System Tray</div>
                  <div className="text-[#8c96a5] text-[11px]">Minimizing hides window to notification area</div>
                </div>
                <input
                  type="checkbox"
                  checked={formSettings.general.minimizeToTray}
                  onChange={(e) =>
                    setFormSettings({
                      ...formSettings,
                      general: { ...formSettings.general, minimizeToTray: e.target.checked }
                    })
                  }
                  className="w-4 h-4 rounded accent-[#0099ff] cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-[#161a22] border border-[#202733] rounded-xl cursor-pointer">
                <div>
                  <div className="font-semibold text-white">Close to Tray</div>
                  <div className="text-[#8c96a5] text-[11px]">Clicking 'X' keeps audio router active in tray</div>
                </div>
                <input
                  type="checkbox"
                  checked={formSettings.general.closeToTray}
                  onChange={(e) =>
                    setFormSettings({
                      ...formSettings,
                      general: { ...formSettings.general, closeToTray: e.target.checked }
                    })
                  }
                  className="w-4 h-4 rounded accent-[#0099ff] cursor-pointer"
                />
              </label>
            </div>
          )}

          {activeTab === 'audio' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-white mb-1.5">
                  Default Output Device (Playback)
                </label>
                <select
                  value={formSettings.audio.defaultOutputDeviceId}
                  onChange={(e) =>
                    setFormSettings({
                      ...formSettings,
                      audio: { ...formSettings.audio, defaultOutputDeviceId: e.target.value }
                    })
                  }
                  className="w-full bg-[#181c23] border border-[#252c38] rounded-lg px-3 py-2 text-xs text-white"
                >
                  {playbackDevices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} {d.isDefault ? '(Windows Default)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-white mb-1.5">
                  Default Input Device (Microphone)
                </label>
                <select
                  value={formSettings.audio.defaultInputDeviceId}
                  onChange={(e) =>
                    setFormSettings({
                      ...formSettings,
                      audio: { ...formSettings.audio, defaultInputDeviceId: e.target.value }
                    })
                  }
                  className="w-full bg-[#181c23] border border-[#252c38] rounded-lg px-3 py-2 text-xs text-white"
                >
                  {recordingDevices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} {d.isDefault ? '(Windows Default)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Optional virtual microphone driver. Kept in Settings, not the main toolbar. */}
              <div className="p-3 bg-[#161a22] border border-[#202733] rounded-xl space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 shrink-0 rounded-lg bg-[#202633] flex items-center justify-center">
                    <Mic className="w-4 h-4 text-[#00b4d8]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white">Optional Microphone Routing Driver</div>
                    <div className="text-[#8c96a5] text-[11px] mt-1">
                      VB-Audio VB-CABLE is only needed for the silent virtual-microphone fallback. The normal per-application session-mute feature can work without it.
                    </div>
                    <div className="flex items-start gap-1.5 mt-2 text-[11px]">
                      {micRouteAvailable ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-px" />
                          <span className="text-emerald-300">Detected{micRouteName ? `: ${micRouteName}` : ': VB-CABLE virtual endpoint is available'}.</span>
                        </>
                      ) : micDriverInstallPending ? (
                        <>
                          <LoaderCircle className="w-3.5 h-3.5 text-amber-300 shrink-0 mt-px" />
                          <span className="text-amber-200">Installer was launched, but the endpoint is not detected yet. Restart Windows if requested, then refresh Audio Devices.</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-3.5 h-3.5 text-[#fbbf24] shrink-0 mt-px" />
                          <span className="text-[#e9bc69]">Not detected. Installation is optional.</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 flex-wrap">
                  {!micRouteAvailable && !micDriverInstallPending && (
                    <button
                      type="button"
                      onClick={onInstallMicDriver}
                      className="px-3 py-1.5 bg-[#342615] hover:bg-[#45321a] border border-[#59401a] text-[#fbbf24] rounded-lg flex items-center gap-1.5 cursor-pointer transition-all"
                      title="Launch the official VB-CABLE installer. Windows administrator approval may be required."
                    >
                      <Mic className="w-3.5 h-3.5" />
                      <span>Install Mic Driver</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onVisitMicDriverDownloadPage}
                    className="px-3 py-1.5 bg-[#202633] hover:bg-[#2b3445] text-white rounded-lg flex items-center gap-1.5 cursor-pointer transition-all"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-[#00b4d8]" />
                    <span>Official Website</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-white mb-1.5">
                  Default Volume Step
                </label>
                <select
                  value={formSettings.audio.defaultVolumeStep}
                  onChange={(e) =>
                    setFormSettings({
                      ...formSettings,
                      audio: { ...formSettings.audio, defaultVolumeStep: Number(e.target.value) }
                    })
                  }
                  className="w-full bg-[#181c23] border border-[#252c38] rounded-lg px-3 py-2 text-xs text-white"
                >
                  <option value={1}>±1% (Fine)</option>
                  <option value={5}>±5% (Standard)</option>
                  <option value={10}>±10% (Coarse)</option>
                </select>
              </div>

              <div className="p-3 bg-[#161a22] border border-[#202733] rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-semibold text-white">Windows Sound Settings</div>
                  <div className="text-[#8c96a5] text-[11px]">Open native Windows 10/11 Sound Control Panel</div>
                </div>
                <button
                  onClick={() => {
                    if (window.electronAPI) window.electronAPI.openSystemSoundSettings();
                  }}
                  className="px-3 py-1.5 bg-[#202633] hover:bg-[#2b3445] text-white rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Open System Sounds</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'hotkeys' && (
            <div className="space-y-3">
              <label className="flex items-center justify-between p-3 bg-[#161a22] border border-[#202733] rounded-xl cursor-pointer">
                <div>
                  <div className="font-semibold text-white">Enable Global Shortcuts</div>
                  <div className="text-[#8c96a5] text-[11px]">Allow per-app volume and mute keys while in other games/apps</div>
                </div>
                <input
                  type="checkbox"
                  checked={formSettings.hotkeys.enableGlobalShortcuts}
                  onChange={(e) =>
                    setFormSettings({
                      ...formSettings,
                      hotkeys: { ...formSettings.hotkeys, enableGlobalShortcuts: e.target.checked }
                    })
                  }
                  className="w-4 h-4 rounded accent-[#0099ff] cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-[#161a22] border border-[#202733] rounded-xl cursor-pointer">
                <div>
                  <div className="font-semibold text-white">Prevent Key Conflicts</div>
                  <div className="text-[#8c96a5] text-[11px]">Warn and block assigning duplicate combinations</div>
                </div>
                <input
                  type="checkbox"
                  checked={formSettings.hotkeys.preventConflicts}
                  onChange={(e) =>
                    setFormSettings({
                      ...formSettings,
                      hotkeys: { ...formSettings.hotkeys, preventConflicts: e.target.checked }
                    })
                  }
                  className="w-4 h-4 rounded accent-[#0099ff] cursor-pointer"
                />
              </label>
            </div>
          )}

          {activeTab === 'interface' && (
            <div className="space-y-3">
              <label className="flex items-center justify-between p-3 bg-[#161a22] border border-[#202733] rounded-xl cursor-pointer">
                <div>
                  <div className="font-semibold text-white">Show Process IDs (PIDs)</div>
                  <div className="text-[#8c96a5] text-[11px]">Display numeric PID tag in app card subtitles</div>
                </div>
                <input
                  type="checkbox"
                  checked={formSettings.interface.showPids}
                  onChange={(e) =>
                    setFormSettings({
                      ...formSettings,
                      interface: { ...formSettings.interface, showPids: e.target.checked }
                    })
                  }
                  className="w-4 h-4 rounded accent-[#0099ff] cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-[#161a22] border border-[#202733] rounded-xl cursor-pointer">
                <div>
                  <div className="font-semibold text-white">Show Inactive Applications</div>
                  <div className="text-[#8c96a5] text-[11px]">Retain and display offline apps with 'Not Running' badge</div>
                </div>
                <input
                  type="checkbox"
                  checked={formSettings.interface.showInactiveApps}
                  onChange={(e) =>
                    setFormSettings({
                      ...formSettings,
                      interface: { ...formSettings.interface, showInactiveApps: e.target.checked }
                    })
                  }
                  className="w-4 h-4 rounded accent-[#0099ff] cursor-pointer"
                />
              </label>
            </div>
          )}

          {activeTab === 'diagnostics' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">Diagnostic Event Log ({logs.length})</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (window.electronAPI) window.electronAPI.openLogFolder();
                    }}
                    className="px-2.5 py-1 bg-[#1e2430] hover:bg-[#283244] text-[#d1d5db] rounded text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <FolderOpen className="w-3 h-3" />
                    <span>Open Log Folder</span>
                  </button>
                  <button
                    onClick={() => logger.clear()}
                    className="px-2.5 py-1 bg-[#1e2430] hover:bg-[#283244] text-[#d1d5db] rounded text-[11px] cursor-pointer"
                  >
                    Clear Logs
                  </button>
                </div>
              </div>

              <div className="h-64 overflow-y-auto bg-[#0d0f13] border border-[#1e2430] rounded-xl p-3 font-mono text-[11px] space-y-1">
                {logs.length === 0 ? (
                  <div className="text-[#64748b] italic">No logs recorded yet.</div>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                      <span className="text-[#64748b] shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span
                        className={`font-semibold shrink-0 uppercase text-[10px] px-1 rounded ${
                          log.level === 'error'
                            ? 'bg-red-950 text-red-400'
                            : log.level === 'warn'
                            ? 'bg-amber-950 text-amber-400'
                            : 'bg-blue-950 text-blue-400'
                        }`}
                      >
                        {log.category}
                      </span>
                      <span className="text-[#d1d5db] break-all">{log.message}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Configuration Backup / Reset (Section 26) */}
          <div className="pt-4 border-t border-[#202734] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={handleExport}
                className="px-3 py-1.5 bg-[#181d26] hover:bg-[#222a38] text-white rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-[#00b4d8]" />
                <span>Export Config</span>
              </button>

              <label className="px-3 py-1.5 bg-[#181d26] hover:bg-[#222a38] text-white rounded-lg flex items-center gap-1.5 cursor-pointer">
                <Upload className="w-3.5 h-3.5 text-[#00b4d8]" />
                <span>Import Config</span>
                <input type="file" accept=".json" onChange={handleImport} className="hidden" />
              </label>
            </div>

            <button
              onClick={() => {
                if (confirm('Reset application dashboard to default initial apps?')) {
                  onResetConfig();
                  onClose();
                }
              }}
              className="px-3 py-1.5 text-red-400 hover:bg-red-950/20 rounded-lg flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset to Defaults</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#202734] bg-[#101318] flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs text-[#9ca3af] hover:text-white hover:bg-[#1f2633] transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#0099ff] hover:bg-[#0088ee] text-white flex items-center gap-1.5 shadow-md shadow-[#0099ff]/20 transition-all cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Apply Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
};
