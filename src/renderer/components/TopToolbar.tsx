import React from 'react';
import { AppCategory } from '../../shared/types';
import { Search, RotateCw, Plus, Sliders, Settings, Trash2 } from 'lucide-react';

interface TopToolbarProps {
  categories: AppCategory[];
  activeCategory: AppCategory;
  categoryCounts: Record<AppCategory, number>;
  onSelectCategory: (cat: AppCategory) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onScanApps: () => void;
  onScanDevices: () => void;
  onOpenAddModal: () => void;
  onRemoveAllApps: () => void;
  onOpenSettings: () => void;
  onOpenKoFi: () => void;
  isScanning: boolean;
}

export const TopToolbar: React.FC<TopToolbarProps> = ({
  categories,
  activeCategory,
  categoryCounts,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  onScanApps,
  onScanDevices,
  onOpenAddModal,
  onRemoveAllApps,
  onOpenSettings,
  onOpenKoFi,
  isScanning
}) => {
  return (
    <header className="w-full flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 py-3 px-6 bg-[#0d0f11] border-b border-[#1c2026] select-none">
      {/* Category Pills */}
      <div className="flex items-center flex-wrap gap-1.5">
        {categories.map((cat) => {
          const count = categoryCounts[cat] || 0;
          const isActive = activeCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => onSelectCategory(cat)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 flex items-center gap-1.5 cursor-pointer ${
                isActive
                  ? 'bg-[#22272e] text-white shadow-sm ring-1 ring-[#374151]'
                  : 'text-[#9ca3af] hover:text-white hover:bg-[#161a20]'
              }`}
            >
              <span>{cat}</span>
              <span
                className={`text-[11px] font-mono px-1.5 py-0.2 rounded ${
                  isActive ? 'bg-[#374151] text-white' : 'text-[#6b7280]'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Right Controls: Search, Scan Apps, Scan Devices, Add Running App, Settings */}
      <div className="flex items-center flex-wrap gap-2.5 w-full xl:w-auto justify-end">
        {/* Search Input */}
        <div className="relative min-w-[240px] flex-1 sm:flex-initial">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b7280]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search added applications..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#16191e] border border-[#252a33] rounded-lg text-[#e5e7eb] placeholder-[#6b7280] focus:outline-none focus:border-[#0099ff] focus:ring-1 focus:ring-[#0099ff] transition-all"
          />
        </div>

        {/* Scan Apps Button */}
        <button
          onClick={onScanApps}
          disabled={isScanning}
          title="Scan currently running applications"
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#16191e] hover:bg-[#20252e] active:scale-95 text-[#d1d5db] border border-[#252a33] flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
        >
          <RotateCw className={`w-3.5 h-3.5 text-[#00b4d8] ${isScanning ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Scan Apps</span>
        </button>

        {/* Audio Devices Rescan Button */}
        <button
          onClick={onScanDevices}
          disabled={isScanning}
          title="Refresh playback and microphone devices"
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#16191e] hover:bg-[#20252e] active:scale-95 text-[#d1d5db] border border-[#252a33] flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
        >
          <Sliders className="w-3.5 h-3.5 text-[#00b4d8]" />
          <span className="hidden sm:inline">Audio Devices</span>
        </button>

        {/* Add Running App Button */}
        <button
          onClick={onOpenAddModal}
          className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#0099ff] hover:bg-[#0088ee] active:scale-95 text-white flex items-center gap-1.5 shadow-md shadow-[#0099ff]/20 transition-all cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Add Running App</span>
        </button>

        {/* Remove All Button */}
        <button
          onClick={onRemoveAllApps}
          disabled={(categoryCounts['All Apps'] || 0) === 0}
          title="Remove all added applications"
          className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#9ca3af] hover:text-[#f87171] bg-[#16191e] hover:bg-[#20252e] border border-[#252a33] transition-all cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Remove All</span>
        </button>

        {/* Ko-fi donation button (icon only) */}
        <button
          type="button"
          onClick={onOpenKoFi}
          title="Support Super Audio Control on Ko-fi"
          aria-label="Support Super Audio Control on Ko-fi"
          className="p-1.5 rounded-lg text-[#ff5e5b] hover:text-[#ff8582] bg-[#16191e] hover:bg-[#20252e] border border-[#252a33] transition-all cursor-pointer"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true" focusable="false">
            <path d="M4.2 6.1h12.1v9.2a4.1 4.1 0 0 1-4.1 4.1H8.3a4.1 4.1 0 0 1-4.1-4.1V6.1Z" fill="currentColor" />
            <path d="M16.3 8h2a2.7 2.7 0 0 1 0 5.4h-2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M10.3 9.1c-.9-1.1-2.7-.6-2.7.9 0 1.4 2.7 3.1 2.7 3.1s2.7-1.7 2.7-3.1c0-1.5-1.8-2-2.7-.9Z" fill="#ffffff" />
            <path d="M3 21h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          title="Settings & Diagnostics"
          className="p-1.5 rounded-lg text-[#9ca3af] hover:text-white bg-[#16191e] hover:bg-[#20252e] border border-[#252a33] transition-all cursor-pointer"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
