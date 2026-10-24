import React from 'react';
import { ConfiguredApp, AudioDevice } from '../../shared/types';
import { X, Info, CheckCircle2, AlertCircle, Headphones, Mic } from 'lucide-react';

interface AppDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  app: ConfiguredApp | null;
  playbackDevices: AudioDevice[];
  recordingDevices: AudioDevice[];
}

export const AppDetailsModal: React.FC<AppDetailsModalProps> = ({
  isOpen,
  onClose,
  app,
  playbackDevices,
  recordingDevices
}) => {
  if (!isOpen || !app) return null;

  const defaultOutput = playbackDevices.find((d) => d.isDefault) || playbackDevices[0];
  const currentOutput = playbackDevices.find((d) => d.id === app.outputDeviceId) || defaultOutput;

  const defaultInput = recordingDevices.find((d) => d.isDefault) || recordingDevices[0];
  const currentInput = recordingDevices.find((d) => d.id === app.inputDeviceId) || defaultInput;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#12151a] border border-[#242c38] rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#202734]">
          <div className="flex items-center gap-2.5">
            <Info className="w-5 h-5 text-[#00b4d8]" />
            <div>
              <h2 className="text-sm font-semibold text-white">{app.displayName}</h2>
              <p className="text-xs text-[#8c96a5] font-mono">{app.executable} • PID {app.pid ?? 'N/A'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#9ca3af] hover:text-white hover:bg-[#1f2633] transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          {/* Process Metadata */}
          <div className="bg-[#161a22] p-3.5 rounded-xl border border-[#202733] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[#8c96a5]">Executable Path:</span>
              <span className="font-mono text-white text-[11px] truncate max-w-[320px]" title={app.executablePath}>
                {app.executablePath || 'Unknown Path'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#8c96a5]">Process Status:</span>
              <span className="flex items-center gap-1.5">
                {app.isRunning ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#10b981]" />
                    <span className="text-[#10b981] font-semibold">Active & Running</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-amber-500 font-semibold">Offline / Not Running</span>
                  </>
                )}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#8c96a5]">Category:</span>
              <span className="text-white font-medium">{app.category}</span>
            </div>
          </div>

          {/* WASAPI Routing */}
          <div className="bg-[#161a22] p-3.5 rounded-xl border border-[#202733] space-y-2">
            <div className="flex items-center gap-1.5 text-[#00b4d8] font-semibold mb-1">
              <Headphones className="w-3.5 h-3.5" />
              <span>WASAPI Output Routing</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#8c96a5]">Active Endpoint:</span>
              <span className="text-white font-medium">{currentOutput?.name || 'Default Device'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#8c96a5]">Endpoint GUID:</span>
              <span className="font-mono text-[10px] text-[#64748b] truncate max-w-[260px]">{currentOutput?.id || app.outputDeviceId}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#8c96a5]">COM Routing Interface:</span>
              <span className="text-[#10b981] font-mono text-[11px]">IPolicyConfig::SetPersistedDefaultAudioEndpoint</span>
            </div>
          </div>

          {/* Microphone Isolation State */}
          <div className="bg-[#161a22] p-3.5 rounded-xl border border-[#202733] space-y-2">
            <div className="flex items-center gap-1.5 text-[#fbbf24] font-semibold mb-1">
              <Mic className="w-3.5 h-3.5" />
              <span>Per-App Microphone Engine</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#8c96a5]">Capture Endpoint:</span>
              <span className="text-white font-medium">{currentInput?.name || 'Default Microphone'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#8c96a5]">Isolation Mode:</span>
              <span className="text-[#38bdf8] font-medium">Virtual Audio Endpoint / Silence Injection</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#8c96a5]">Current State:</span>
              <span className={app.micEnabled ? 'text-[#10b981] font-bold' : 'text-amber-400 font-bold'}>
                {app.micEnabled ? 'Live Mic Forwarding' : 'Packet Silencing Active (Muted)'}
              </span>
            </div>
            <p className="text-[11px] text-[#6b7280] mt-1 leading-relaxed">
              Muting this application zeroes out capture buffers specifically for PID {app.pid ?? 'N/A'} without affecting Windows master microphone or any other voice applications.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#202734] bg-[#101318] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs bg-[#202633] hover:bg-[#2b3445] text-white font-medium transition-all cursor-pointer"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
};
