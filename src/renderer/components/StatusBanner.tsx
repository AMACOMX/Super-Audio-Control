import React from 'react';
import { ScanStatus } from '../../shared/types';
import { RotateCw, CheckCircle2, AlertCircle } from 'lucide-react';

interface StatusBannerProps {
  status: ScanStatus | null;
}

export const StatusBanner: React.FC<StatusBannerProps> = ({ status }) => {
  if (!status || status.status === 'idle') return null;

  const isScanning =
    status.status === 'scanning_devices' ||
    status.status === 'scanning_apps' ||
    status.status === 'scanning_sessions';

  return (
    <div className="fixed bottom-4 right-4 z-40 animate-in slide-in-from-bottom-2 fade-in duration-200">
      <div className="bg-[#151921] border border-[#273244] shadow-2xl rounded-xl px-4 py-2.5 flex items-center gap-3 text-xs text-white">
        {isScanning ? (
          <RotateCw className="w-4 h-4 text-[#00b4d8] animate-spin shrink-0" />
        ) : status.status === 'error' ? (
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
        ) : (
          <CheckCircle2 className="w-4 h-4 text-[#10b981] shrink-0" />
        )}

        <div className="flex flex-col">
          <span className="font-medium text-[13px]">{status.message}</span>
        </div>
      </div>
    </div>
  );
};
