import React from 'react';
import { Activity, RefreshCw, Zap } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isPolling: boolean;
  onRefresh: () => void;
  lastSyncTime: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  isPolling,
  onRefresh,
  lastSyncTime,
}) => {
  const tabs = [
    { id: 'operations', label: 'Operations Center' },
    { id: 'matrix', label: 'Pattern Matrix' },
    { id: 'performance', label: 'Performance & P&L' },
    { id: 'telegram', label: 'Telegram Bot' },
    { id: 'firebase', label: 'Firebase RTDB' },
    { id: 'code', label: 'Python & VPS Hub' },
  ];

  const secondsAgo = Math.max(0, Math.floor((Date.now() - lastSyncTime) / 1000));

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Zone 1: Single Brand Wordmark */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <span className="text-base font-bold tracking-tight text-white block leading-tight">
              WinGo 30S Analytics
            </span>
            <span className="text-[11px] text-slate-400 block font-mono">
              24/7 Automated Ingestion Engine
            </span>
          </div>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-slate-800 text-white shadow-sm border border-slate-700/60'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Live Status & Primary Action */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 font-mono">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Live Sync</span>
            <span className="text-slate-600">·</span>
            <span className="tabular-nums">{secondsAgo}s ago</span>
          </div>

          <button
            onClick={onRefresh}
            disabled={isPolling}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700/80 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPolling ? 'animate-spin text-cyan-400' : ''}`} />
            <span>{isPolling ? 'Syncing...' : 'Poll API'}</span>
          </button>
        </div>
      </div>

      {/* Mobile Navigation bar */}
      <div className="md:hidden flex items-center gap-1 px-4 py-2 border-t border-slate-800/60 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap ${
              activeTab === tab.id ? 'bg-slate-800 text-white' : 'text-slate-400'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </header>
  );
};
