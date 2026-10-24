import React, { useState } from 'react';
import { ProcessInfo, AppCategory } from '../../shared/types';
import { X, Search, Plus, Check, MessageSquare, Globe, Music, Gamepad2, Cpu } from 'lucide-react';

interface AddRunningAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  processes: ProcessInfo[];
  alreadyAddedExeNames: string[];
  onAddProcess: (proc: ProcessInfo) => void;
  onRescanProcesses: () => void | Promise<void>;
}

export const AddRunningAppModal: React.FC<AddRunningAppModalProps> = ({
  isOpen,
  onClose,
  processes,
  alreadyAddedExeNames,
  onAddProcess,
  onRescanProcesses
}) => {
  const [filter, setFilter] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<AppCategory | 'All'>('All');

  if (!isOpen) return null;

  const filtered = processes.filter((proc) => {
    const matchesQuery =
      proc.name.toLowerCase().includes(filter.toLowerCase()) ||
      proc.displayName.toLowerCase().includes(filter.toLowerCase()) ||
      String(proc.pid).includes(filter);

    const matchesCat = selectedCategory === 'All' || proc.category === selectedCategory;
    return matchesQuery && matchesCat;
  });

  const getCatIcon = (cat: AppCategory) => {
    switch (cat) {
      case 'Voice & Chat':
        return <MessageSquare className="w-4 h-4 text-[#818cf8]" />;
      case 'Browsers':
        return <Globe className="w-4 h-4 text-[#fbbf24]" />;
      case 'Media':
        return <Music className="w-4 h-4 text-[#34d399]" />;
      case 'Games':
        return <Gamepad2 className="w-4 h-4 text-[#f472b6]" />;
      default:
        return <Cpu className="w-4 h-4 text-[#60a5fa]" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#12151a] border border-[#242c38] rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#202734]">
          <div>
            <h2 className="text-base font-semibold text-white">Add Running Application</h2>
            <p className="text-xs text-[#8c96a5] mt-0.5">
              Select a running Windows process to control its volume, routing, and microphone independently.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#9ca3af] hover:text-white hover:bg-[#1f2633] transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter bar */}
        <div className="p-4 border-b border-[#202734] bg-[#161a22] flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748b]" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search by name, executable, or PID..."
              className="w-full pl-9 pr-3 py-1.5 bg-[#101318] border border-[#27303f] rounded-lg text-xs text-white placeholder-[#64748b] focus:outline-none focus:border-[#0099ff]"
              autoFocus
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            {(['All', 'Voice & Chat', 'Browsers', 'Media', 'Games', 'System'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded text-xs transition-all cursor-pointer whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-[#0099ff] text-white font-medium'
                    : 'text-[#9ca3af] hover:text-white hover:bg-[#202633]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Process List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 divide-y divide-[#1e2430]">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-[#64748b] text-xs flex flex-col items-center gap-3">
              {processes.length === 0 ? (
                <>
                  <span>Windows returned no running processes. Retry the scan; if it remains empty, open Settings → Logs to see which scanner failed.</span>
                  <button
                    onClick={() => { void onRescanProcesses(); }}
                    className="px-3 py-1.5 rounded-lg bg-[#1c2835] border border-[#2d3d50] text-[#d8e6f7] hover:bg-[#253548] transition-colors"
                  >
                    Retry Scan
                  </button>
                </>
              ) : (
                <span>No matching running applications found for this search or category.</span>
              )}
            </div>
          ) : (
            filtered.map((proc) => {
              const isAlreadyAdded = alreadyAddedExeNames.includes(proc.name.toLowerCase());
              return (
                <div
                  key={`${proc.name}_${proc.pid}`}
                  className="pt-2 first:pt-0 flex items-center justify-between gap-3 p-2 rounded-xl hover:bg-[#181d26] transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#1f2532] border border-[#2b3545] flex items-center justify-center">
                      {getCatIcon(proc.category)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white">{proc.displayName}</span>
                        {proc.hasAudioSession && (
                          <span className="text-[10px] bg-[#00e5ff]/10 text-[#00e5ff] px-1.5 py-0.2 rounded font-medium border border-[#00e5ff]/20">
                            Audio Session Active
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#8c96a5] font-mono mt-0.5">
                        {proc.name} • PID {proc.pid} • {proc.category}
                      </div>
                    </div>
                  </div>

                  <div>
                    {isAlreadyAdded ? (
                      <span className="px-3 py-1.5 text-xs text-[#94a3b8] flex items-center gap-1.5 bg-[#1e2430] rounded-lg">
                        <Check className="w-3.5 h-3.5 text-[#10b981]" />
                        <span>Added</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          onAddProcess(proc);
                          onClose();
                        }}
                        className="px-3 py-1.5 text-xs font-semibold bg-[#0099ff] hover:bg-[#0088ee] text-white rounded-lg flex items-center gap-1.5 transition-all shadow-md shadow-[#0099ff]/10 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#202734] bg-[#101318] flex items-center justify-between text-xs text-[#64748b]">
          <span>{filtered.length} applications available</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs text-[#d1d5db] hover:bg-[#202633] transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
