import React from 'react';
import { Award, CheckCircle2, XCircle, TrendingUp, ShieldCheck, Zap } from 'lucide-react';
import { BotStats, EvaluationRecord } from '../types';

interface PerformanceDashboardProps {
  stats: BotStats;
  evaluations: EvaluationRecord[];
}

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({ stats, evaluations }) => {
  return (
    <div className="space-y-6">
      <div className="border-b border-slate-800 pb-4">
        <h2 className="text-lg font-bold text-white tracking-tight">Performance Telemetry & Risk Analytics</h2>
        <p className="text-xs text-slate-400 mt-1">
          Historical validation tracking verified against official WinGo 30S round results.
        </p>
      </div>

      {/* 5-Metric Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
          <span className="text-xs text-slate-400 block">Win Rate</span>
          <span className="text-2xl font-bold font-mono text-emerald-400 mt-1 block tabular-nums">
            {stats.winRate}%
          </span>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {stats.wins}W / {stats.losses}L
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
          <span className="text-xs text-slate-400 block">Total Evaluated</span>
          <span className="text-2xl font-bold font-mono text-white mt-1 block tabular-nums">
            {stats.totalRounds}
          </span>
          <span className="text-[11px] text-slate-400 mt-1 block">Rounds</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
          <span className="text-xs text-slate-400 block">Current Streak</span>
          <span className={`text-2xl font-bold font-mono mt-1 block tabular-nums ${stats.currentStreak >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {stats.currentStreak >= 0 ? `+${stats.currentStreak}` : stats.currentStreak}
          </span>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {stats.currentStreak >= 0 ? 'Win Run' : 'Drawdown'}
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
          <span className="text-xs text-slate-400 block">Max Win Run</span>
          <span className="text-2xl font-bold font-mono text-cyan-400 mt-1 block tabular-nums">
            +{stats.maxWinStreak}
          </span>
          <span className="text-[11px] text-slate-400 mt-1 block">Consecutive Wins</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
          <span className="text-xs text-slate-400 block">Flat P&L</span>
          <span className={`text-2xl font-bold font-mono mt-1 block tabular-nums ${stats.unitProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {stats.unitProfit >= 0 ? `+${stats.unitProfit.toFixed(2)}` : stats.unitProfit.toFixed(2)}
          </span>
          <span className="text-[11px] text-slate-400 mt-1 block">Base Units</span>
        </div>
      </div>

      {/* Outcome Ribbon: Last 30 Verified Rounds */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Chronological Verification Ribbon (Latest 30 Rounds)
          </h3>
          <span className="text-xs font-mono text-slate-400">Oldest ➔ Newest</span>
        </div>

        {evaluations.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400">
            Awaiting completed rounds to render verification sequence.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {[...evaluations].reverse().map((record) => (
              <div
                key={record.issueNumber}
                title={`Period: ${record.issueNumber} | Result: ${record.actualNumber} (${record.actualType}) | Predicted: ${record.predictedType} | ${record.status}`}
                className={`w-9 h-9 rounded-lg flex items-center justify-center font-mono font-bold text-xs cursor-default transition-transform hover:scale-110 shadow-sm ${
                  record.isWin
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                }`}
              >
                {record.isWin ? 'W' : 'L'}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Staking Simulation & Risk Control */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800 mb-3">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Model 1: Flat Staking (Conservative)
            </h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed mb-4">
            Fixed 1.0 unit allocated per forecast regardless of previous outcomes. Eliminates catastrophic drawdown and leverages positive edge over high volume.
          </p>
          <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-2 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-slate-400">Simulated Net Profit:</span>
              <span className={`font-bold ${stats.unitProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {stats.unitProfit >= 0 ? `+${stats.unitProfit.toFixed(2)}` : stats.unitProfit.toFixed(2)} Units
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Max Drawdown Recorded:</span>
              <span className="text-rose-400 font-bold">-{stats.maxLossStreak}.0 Units</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800 mb-3">
            <Zap className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Model 2: 3-Stage Recovery (Hedge)
            </h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed mb-4">
            Stages: 1 unit ➔ 2.2 units ➔ 5.0 units upon loss; immediate reset to 1 unit on win. Max loss capped strictly at Stage 3 to safeguard bankroll capital.
          </p>
          <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-2 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-slate-400">Recovery Multiplier:</span>
              <span className="text-cyan-400 font-bold">1x ➔ 2.2x ➔ 5.0x (Hard Stop)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Safety Cap Triggered:</span>
              <span className="text-slate-300 font-bold">{stats.maxLossStreak >= 3 ? '1 Event' : '0 Events'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
