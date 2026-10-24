import React, { useState, useEffect } from 'react';
import { ConfiguredApp } from '../../shared/types';
import { HotkeyManager, ShortcutConflict } from '../../hotkeys/HotkeyManager';
import { X, Keyboard, AlertTriangle, Check, Trash2 } from 'lucide-react';

interface HotkeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  app: ConfiguredApp | null;
  action: 'volumeUp' | 'volumeDown' | 'volumeMute' | 'microphoneMute' | null;
  allApps: ConfiguredApp[];
  onSaveShortcut: (appId: string, action: 'volumeUp' | 'volumeDown' | 'volumeMute' | 'microphoneMute', chord?: string) => void;
}

export const HotkeyModal: React.FC<HotkeyModalProps> = ({
  isOpen,
  onClose,
  app,
  action,
  allApps,
  onSaveShortcut
}) => {
  const [currentChord, setCurrentChord] = useState<string>('');
  const [conflict, setConflict] = useState<ShortcutConflict | null>(null);
  const hotkeyManager = new HotkeyManager();

  useEffect(() => {
    if (isOpen && app && action) {
      const initial = app.shortcuts?.[action] || '';
      setCurrentChord(initial);
      setConflict(null);
    }
  }, [isOpen, app, action]);

  if (!isOpen || !app || !action) return null;

  const getActionName = () => {
    switch (action) {
      case 'volumeUp':
        return 'Volume Up (+ Step)';
      case 'volumeDown':
        return 'Volume Down (- Step)';
      case 'volumeMute':
        return 'Toggle Volume Mute';
      case 'microphoneMute':
        return 'Toggle Microphone Mute';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Ignore standalone modifier presses
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;

    const parts: string[] = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');
    if (e.metaKey) parts.push('Win');

    let keyName = e.key;
    if (keyName === 'ArrowUp') keyName = 'Up';
    else if (keyName === 'ArrowDown') keyName = 'Down';
    else if (keyName === 'ArrowLeft') keyName = 'Left';
    else if (keyName === 'ArrowRight') keyName = 'Right';
    else if (keyName === ' ') keyName = 'Space';
    else if (keyName === '+') keyName = 'Plus';
    else if (keyName.length === 1) keyName = keyName.toUpperCase();

    parts.push(keyName);
    const chord = parts.join(' + ');
    setCurrentChord(chord);

    // Check conflict
    const conf = hotkeyManager.detectConflict(chord, app.id, action, allApps);
    setConflict(conf);
  };

  const handleSave = () => {
    onSaveShortcut(app.id, action, currentChord || undefined);
    onClose();
  };

  const handleClear = () => {
    onSaveShortcut(app.id, action, undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#12151a] border border-[#242c38] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#202734]">
          <div className="flex items-center gap-2.5">
            <Keyboard className="w-5 h-5 text-[#00b4d8]" />
            <div>
              <h2 className="text-sm font-semibold text-white">Configure Shortcut</h2>
              <p className="text-xs text-[#8c96a5]">{app.displayName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#9ca3af] hover:text-white hover:bg-[#1f2633] transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div>
            <span className="text-xs text-[#9ca3af]">Action to trigger:</span>
            <div className="text-xs font-semibold text-white mt-0.5">{getActionName()}</div>
          </div>

          {/* Key Capture Area */}
          <div
            tabIndex={0}
            onKeyDown={handleKeyDown}
            className="p-5 bg-[#171b23] border-2 border-dashed border-[#2b3545] focus:border-[#0099ff] rounded-xl text-center cursor-pointer transition-all outline-none"
          >
            <span className="text-[11px] text-[#6b7280] block mb-2">
              Click here and press your desired key combination (e.g., Ctrl + Alt + Up)
            </span>
            <div className="text-base font-mono font-bold text-[#00e5ff] tracking-wide min-h-[28px] flex items-center justify-center">
              {currentChord || <span className="text-[#4b5563] font-normal italic">Press keys...</span>}
            </div>
          </div>

          {/* Conflict Warning */}
          {conflict && (
            <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-xl flex items-start gap-2.5 text-xs text-red-200">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Shortcut Conflict Detected: </span>
                <span>
                  "{conflict.shortcut}" is already assigned to {conflict.appName} ({conflict.action}).
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#202734] bg-[#101318] flex items-center justify-between">
          <button
            onClick={handleClear}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:bg-red-950/30 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Key</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs text-[#9ca3af] hover:text-white hover:bg-[#1f2633] transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#0099ff] hover:bg-[#0088ee] text-white flex items-center gap-1.5 shadow-md shadow-[#0099ff]/20 transition-all cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save Shortcut</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
