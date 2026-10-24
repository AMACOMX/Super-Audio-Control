import React from 'react';
import { Download, ExternalLink, Mic, X } from 'lucide-react';

interface MicDriverPromptModalProps {
  isOpen: boolean;
  appName: string;
  isBusy?: boolean;
  onInstallAutomatically: () => void;
  onVisitDownloadPage: () => void;
  onCancel: () => void;
}

export const MicDriverPromptModal: React.FC<MicDriverPromptModalProps> = ({
  isOpen,
  appName,
  isBusy = false,
  onInstallAutomatically,
  onVisitDownloadPage,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mic-driver-dialog-title"
        className="w-full max-w-md rounded-2xl overflow-hidden bg-[#12151a] border border-[#303846] shadow-2xl animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-start gap-3 p-5 border-b border-[#202734]">
          <div className="w-10 h-10 shrink-0 rounded-xl bg-[#2b2110] border border-[#5b4217] flex items-center justify-center">
            <Mic className="w-5 h-5 text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 id="mic-driver-dialog-title" className="text-sm font-semibold text-white">Install microphone routing driver?</h2>
            <p className="mt-1 text-xs leading-relaxed text-[#9ca3af]">
              {appName ? `${appName} needs ` : 'Per-application microphone mute needs '}
              a silent virtual capture endpoint. Super Audio Control uses the official VB-Audio VB-CABLE driver for this.
            </p>
          </div>
          <button
            onClick={onCancel}
            disabled={isBusy}
            aria-label="Close"
            className="p-1 rounded-lg text-[#8993a3] hover:text-white hover:bg-[#252b35] disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <div className="rounded-xl bg-[#181d25] border border-[#2a3341] p-3 text-[11px] leading-relaxed text-[#b8c1ce]">
            Automatic installation opens the official driver installer and asks for Windows administrator approval. You may need to restart Windows before the new audio endpoint is available. Your physical microphone will not be muted globally.
          </div>

          <button
            onClick={onInstallAutomatically}
            disabled={isBusy}
            className="w-full px-4 py-2.5 rounded-xl bg-[#0099ff] hover:bg-[#0088ee] text-white text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-wait"
          >
            <Download className="w-4 h-4" />
            {isBusy ? 'Launching installer…' : 'Install automatically'}
          </button>
          <button
            onClick={onVisitDownloadPage}
            disabled={isBusy}
            className="w-full px-4 py-2.5 rounded-xl bg-[#1a2029] hover:bg-[#242c38] border border-[#303846] text-[#d1d5db] text-xs font-medium flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <ExternalLink className="w-4 h-4" />
            Visit official download page
          </button>
          <button
            onClick={onCancel}
            disabled={isBusy}
            className="w-full px-4 py-2 rounded-xl text-[#9ca3af] hover:text-white hover:bg-[#1c222b] text-xs font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          <p className="text-center text-[10px] text-[#687385]">Official site: vb-audio.com/Cable · VB-CABLE is third-party software.</p>
        </div>
      </div>
    </div>
  );
};
