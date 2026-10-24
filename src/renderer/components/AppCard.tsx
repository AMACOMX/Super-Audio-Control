import React, { useState } from 'react';
import { ConfiguredApp, AudioDevice } from '../../shared/types';
import {
  MessageSquare,
  Globe,
  Music,
  Gamepad2,
  Cpu,
  Eye,
  RefreshCw,
  Trash2,
  Sliders,
  Headphones,
  Mic,
  Volume2,
  VolumeX,
  Keyboard,
  ArrowUp,
  ArrowDown
} from 'lucide-react';

interface AppCardProps {
  app: ConfiguredApp;
  playbackDevices: AudioDevice[];
  recordingDevices: AudioDevice[];
  onVolumeChange: (appId: string, volume: number) => void;
  onVolumeStepChange: (appId: string, step: number) => void;
  onToggleMute: (appId: string) => void;
  onOutputDeviceChange: (appId: string, deviceId: string) => void;
  onInputDeviceChange: (appId: string, deviceId: string) => void;
  onToggleMic: (appId: string) => void;
  onRemoveApp: (appId: string) => void;
  onShowDetails: (app: ConfiguredApp) => void;
  onRefreshApp: (app: ConfiguredApp) => Promise<void> | void;
  onOpenHotkeyModal: (app: ConfiguredApp, action: 'volumeUp' | 'volumeDown' | 'volumeMute' | 'microphoneMute') => void;
}

export const AppCard: React.FC<AppCardProps> = ({
  app,
  playbackDevices,
  recordingDevices,
  onVolumeChange,
  onVolumeStepChange,
  onToggleMute,
  onOutputDeviceChange,
  onInputDeviceChange,
  onToggleMic,
  onRemoveApp,
  onShowDetails,
  onRefreshApp,
  onOpenHotkeyModal
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshApp = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try { await onRefreshApp(app); }
    finally { setIsRefreshing(false); }
  };

  // Select matching category icon
  const renderCategoryIcon = () => {
    switch (app.category) {
      case 'Voice & Chat':
        return <MessageSquare className="w-5 h-5 text-[#818cf8]" />;
      case 'Browsers':
        return <Globe className="w-5 h-5 text-[#fbbf24]" />;
      case 'Media':
        return <Music className="w-5 h-5 text-[#34d399]" />;
      case 'Games':
        return <Gamepad2 className="w-5 h-5 text-[#f472b6]" />;
      default:
        return <Cpu className="w-5 h-5 text-[#60a5fa]" />;
    }
  };

  const truncateShortcut = (chord?: string) => {
    if (!chord) return null;
    if (chord.length > 11) {
      return chord.substring(0, 9) + '...';
    }
    return chord;
  };

  return (
    <div className="bg-[#121418] border border-[#20252d] hover:border-[#2d3542] rounded-2xl p-5 shadow-2xl transition-all duration-200 flex flex-col justify-between select-none">
      {/* CARD HEADER */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="flex items-center gap-3.5">
            {/* App Icon with green running indicator dot */}
            <div className="relative">
              <div className="w-12 h-12 rounded-xl bg-[#1a1e26] border border-[#272f3d] flex items-center justify-center shadow-inner">
                {renderCategoryIcon()}
              </div>
              {app.isRunning ? (
                <span
                  title="Running"
                  className="absolute -top-1 -right-1 w-3 h-3 bg-[#10b981] border-2 border-[#121418] rounded-full ring-2 ring-[#10b981]/20 shadow-sm"
                />
              ) : (
                <span
                  title="Not Running"
                  className="absolute -top-1 -right-1 w-3 h-3 bg-[#6b7280] border-2 border-[#121418] rounded-full"
                />
              )}
            </div>

            {/* Title & Executable / PID */}
            <div>
              <h3 className="text-[15px] font-semibold text-white tracking-wide leading-snug">
                {app.displayName}
              </h3>
              <div className="flex items-center gap-1.5 text-xs text-[#8c96a5] font-mono mt-0.5">
                <span>{app.executable}</span>
                <span>•</span>
                {app.isRunning && app.pid ? (
                  <span className="text-[#94a3b8]">PID {app.pid}</span>
                ) : (
                  <span className="text-amber-500 font-sans font-medium">Not Running</span>
                )}
              </div>
            </div>
          </div>

          {/* Action icons: Inspect and Remove */}
          <div className="flex items-center gap-1 text-[#6b7280]">
            <button
              onClick={() => onShowDetails(app)}
              title="Inspect Audio Session & Routing"
              className="p-1.5 rounded-lg hover:text-white hover:bg-[#1f242d] transition-all cursor-pointer"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              onClick={() => void refreshApp()}
              disabled={isRefreshing}
              title="Refresh this app's live audio sessions and device status"
              aria-label={`Refresh ${app.displayName} audio status`}
              className="p-1.5 rounded-lg hover:text-[#00b4d8] hover:bg-[#1f242d] transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#00b4d8]' : ''}`} />
            </button>
            <button
              onClick={() => onRemoveApp(app.id)}
              title="Remove from Dashboard"
              className="p-1.5 rounded-lg hover:text-[#f87171] hover:bg-[#1f242d] transition-all cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* SECTION: AUDIO DEVICE ROUTING */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5 text-[#00b4d8] text-xs font-medium">
              <Sliders className="w-3.5 h-3.5" />
              <span>Audio Device Routing</span>
            </div>
            <span className="text-[11px] text-[#6b7280]">Per-App Endpoints</span>
          </div>

          <div className="space-y-2.5">
            {/* Output Device Select */}
            <div>
              <div className="flex items-center justify-between text-[11px] text-[#9ca3af] mb-1">
                <div className="flex items-center gap-1.5">
                  <Headphones className="w-3 h-3 text-[#38bdf8]" />
                  <span>Output Device (Playback)</span>
                </div>
                <span className="text-[#64748b]">WASAPI Out</span>
              </div>
              <div className="relative">
                <select
                  value={app.outputDeviceId}
                  onChange={(e) => onOutputDeviceChange(app.id, e.target.value)}
                  className="w-full bg-[#181c23] border border-[#252c38] hover:border-[#374151] rounded-lg px-3 py-2 text-xs text-[#e2e8f0] appearance-none focus:outline-none focus:border-[#0099ff] cursor-pointer"
                >
                  {playbackDevices.map((dev) => (
                    <option key={dev.id} value={dev.id} className="bg-[#181c23] text-white">
                      {dev.name} {dev.isDefault ? '(Default)' : ''}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#64748b] text-[10px]">
                  ▼
                </div>
              </div>
            </div>

            {/* Input Device Select */}
            <div>
              <div className="flex items-center justify-between text-[11px] text-[#9ca3af] mb-1">
                <div className="flex items-center gap-1.5">
                  <Mic className="w-3 h-3 text-[#fbbf24]" />
                  <span>Input Device (Microphone)</span>
                </div>
                {app.micEnabled ? (
                  <span className="text-[#64748b]">WASAPI In</span>
                ) : (
                  <button
                    onClick={() => onToggleMic(app.id)}
                    className="text-[#fbbf24] hover:underline cursor-pointer font-medium text-[11px]"
                  >
                    + Enable Mic
                  </button>
                )}
              </div>
              <div className="relative">
                <select
                  value={app.inputDeviceId}
                  onChange={(e) => onInputDeviceChange(app.id, e.target.value)}
                  className="w-full bg-[#181c23] border border-[#252c38] hover:border-[#374151] rounded-lg px-3 py-2 text-xs text-[#e2e8f0] appearance-none focus:outline-none focus:border-[#0099ff] cursor-pointer"
                >
                  {recordingDevices.map((dev) => (
                    <option key={dev.id} value={dev.id} className="bg-[#181c23] text-white">
                      {dev.name} {dev.isDefault ? '(Default)' : ''}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#64748b] text-[10px]">
                  ▼
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION: SESSION VOLUME */}
        <div className="mb-5 bg-[#161a22]/70 p-3.5 rounded-xl border border-[#202733]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-[#d1d5db]">Session Volume</span>
              {/* Animated VU Meter Bars */}
              <div className="flex items-center gap-0.5 h-3">
                <span
                  className={`w-1 rounded-full transition-all duration-150 ${
                    app.isMuted || !app.isRunning
                      ? 'h-1 bg-[#374151]'
                      : 'bg-[#00e5ff] animate-pulse h-2.5 shadow-sm shadow-[#00e5ff]/50'
                  }`}
                />
                <span
                  className={`w-1 rounded-full transition-all duration-150 ${
                    app.isMuted || !app.isRunning
                      ? 'h-1 bg-[#374151]'
                      : 'bg-[#00e5ff] animate-pulse h-3 shadow-sm shadow-[#00e5ff]/50'
                  }`}
                  style={{ animationDelay: '100ms' }}
                />
                <span
                  className={`w-1 rounded-full transition-all duration-150 ${
                    app.isMuted || !app.isRunning
                      ? 'h-1 bg-[#374151]'
                      : 'bg-[#00e5ff] animate-pulse h-2 shadow-sm shadow-[#00e5ff]/50'
                  }`}
                  style={{ animationDelay: '200ms' }}
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Step Selector */}
              <div className="flex items-center gap-1 text-[11px] text-[#9ca3af]">
                <span>Step:</span>
                <select
                  value={app.volumeStep}
                  onChange={(e) => onVolumeStepChange(app.id, Number(e.target.value))}
                  className="bg-[#1d232c] border border-[#2c3542] text-[#d1d5db] rounded px-1.5 py-0.5 text-[11px] focus:outline-none cursor-pointer"
                >
                  <option value={1}>±1%</option>
                  <option value={5}>±5%</option>
                  <option value={10}>±10%</option>
                </select>
              </div>

              {/* Volume Percentage */}
              <span className="text-xs font-bold text-white min-w-[32px] text-right font-mono">
                {app.volume}%
              </span>
            </div>
          </div>

          {/* Volume Slider & Mute Toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => onToggleMute(app.id)}
              title={app.isMuted ? 'Unmute Session' : 'Mute Session'}
              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                app.isMuted
                  ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
                  : 'bg-[#202631] border-[#2e3745] text-white hover:bg-[#28303d]'
              }`}
            >
              {app.isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <div className="relative flex-1 flex items-center">
              <input
                type="range"
                min="0"
                max="100"
                step={app.volumeStep || 5}
                value={app.isMuted ? 0 : app.volume}
                onChange={(e) => onVolumeChange(app.id, Number(e.target.value))}
                className="w-full h-1.5 bg-[#252b36] rounded-lg appearance-none cursor-pointer accent-[#0099ff]"
              />
            </div>
          </div>
        </div>

        {/* SECTION: MICROPHONE STATE */}
        <div className="mb-5 bg-[#161a22]/70 p-3.5 rounded-xl border border-[#202733]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-[#d1d5db]">
              <Mic className="w-3.5 h-3.5 text-[#fbbf24]" />
              <span>Microphone State</span>
              {app.micEnabled && (
                <div className="flex gap-0.5 ml-1">
                  <span className="w-1.5 h-1 bg-[#fbbf24] rounded-full" />
                  <span className="w-1.5 h-1 bg-[#fbbf24] rounded-full" />
                </div>
              )}
            </div>

            <button
              onClick={() => onToggleMic(app.id)}
              className={`text-[11px] font-medium transition-all cursor-pointer ${
                app.micEnabled
                  ? 'text-[#9ca3af] hover:text-white'
                  : 'text-[#fbbf24] hover:underline'
              }`}
            >
              {app.micEnabled ? 'Disable Mic' : '+ Enable Mic'}
            </button>
          </div>

          {app.micEnabled ? (
            <div className="flex items-center justify-between bg-[#191e27] border border-[#263140] rounded-lg p-2">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-[#102a3a] border border-[#0284c7]/50 rounded-md text-[11px] font-semibold text-[#38bdf8] flex items-center gap-1.5 shadow-sm">
                  <Mic className="w-3 h-3 text-[#38bdf8]" />
                  <span>Mic Live & Active</span>
                </span>
              </div>
              <span className="text-[11px] text-[#64748b] truncate max-w-[140px]">
                {recordingDevices.find((d) => d.id === app.inputDeviceId)?.name || 'Default Microphone (WASAPI)'}
              </span>
            </div>
          ) : (
            <div className="text-[11px] text-[#9ca3af] py-1">
              <span>Mute targets this app's active capture session when Windows exposes it; a silent virtual-input route is the fallback. Reapply after the app restarts capture. </span>
              <button
                onClick={() => onToggleMic(app.id)}
                className="text-[#fbbf24] hover:underline font-semibold cursor-pointer"
              >
                Enable
              </button>
            </div>
          )}
        </div>
      </div>

      {/* SECTION: INDEPENDENT SHORTCUTS */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-[#00b4d8] text-xs font-medium">
            <Keyboard className="w-3.5 h-3.5" />
            <span>Independent Shortcuts</span>
          </div>
          <span className="text-[11px] text-[#6b7280]">Direct Hooks</span>
        </div>

        {/* 4 Shortcut Action Tiles */}
        <div className="grid grid-cols-4 gap-2">
          {/* Vol Up */}
          <button
            onClick={() => onOpenHotkeyModal(app, 'volumeUp')}
            className="flex flex-col items-center justify-center p-2 rounded-xl bg-[#161a22] hover:bg-[#1f2530] border border-[#222834] transition-all cursor-pointer text-center group"
          >
            <div className="flex items-center gap-1 text-[11px] text-[#38bdf8] font-medium mb-1 group-hover:scale-105 transition-transform">
              <ArrowUp className="w-3 h-3" />
              <span>Vol +</span>
            </div>
            <span className="text-[10px] text-[#d1d5db] font-mono truncate w-full">
              {truncateShortcut(app.shortcuts?.volumeUp) || '+ Set Key'}
            </span>
          </button>

          {/* Vol Down */}
          <button
            onClick={() => onOpenHotkeyModal(app, 'volumeDown')}
            className="flex flex-col items-center justify-center p-2 rounded-xl bg-[#161a22] hover:bg-[#1f2530] border border-[#222834] transition-all cursor-pointer text-center group"
          >
            <div className="flex items-center gap-1 text-[11px] text-[#38bdf8] font-medium mb-1 group-hover:scale-105 transition-transform">
              <ArrowDown className="w-3 h-3" />
              <span>Vol -</span>
            </div>
            <span className="text-[10px] text-[#d1d5db] font-mono truncate w-full">
              {truncateShortcut(app.shortcuts?.volumeDown) || '+ Set Key'}
            </span>
          </button>

          {/* Vol Mute */}
          <button
            onClick={() => onOpenHotkeyModal(app, 'volumeMute')}
            className="flex flex-col items-center justify-center p-2 rounded-xl bg-[#161a22] hover:bg-[#1f2530] border border-[#222834] transition-all cursor-pointer text-center group"
          >
            <div className="flex items-center gap-1 text-[11px] text-[#f87171] font-medium mb-1 group-hover:scale-105 transition-transform">
              <VolumeX className="w-3 h-3" />
              <span>Vol Mute</span>
            </div>
            <span className="text-[10px] text-[#d1d5db] font-mono truncate w-full">
              {truncateShortcut(app.shortcuts?.volumeMute) || '+ Set Key'}
            </span>
          </button>

          {/* Mic Mute */}
          <button
            onClick={() => onOpenHotkeyModal(app, 'microphoneMute')}
            className="flex flex-col items-center justify-center p-2 rounded-xl bg-[#161a22] hover:bg-[#1f2530] border border-[#222834] transition-all cursor-pointer text-center group"
          >
            <div className="flex items-center gap-1 text-[11px] text-[#fbbf24] font-medium mb-1 group-hover:scale-105 transition-transform">
              <Mic className="w-3 h-3" />
              <span>Mic Mute</span>
            </div>
            <span
              className={`text-[10px] font-mono truncate w-full ${
                app.shortcuts?.microphoneMute ? 'text-[#d1d5db]' : 'text-[#fbbf24]'
              }`}
            >
              {truncateShortcut(app.shortcuts?.microphoneMute) || '+ Set Key'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
