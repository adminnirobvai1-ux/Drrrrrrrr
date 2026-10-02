import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  TrendingUp, 
  Sparkles, 
  Send, 
  Database,
  ArrowRight,
  Flame,
  Radio
} from 'lucide-react';
import { WinGoIssue, PredictionPayload, EvaluationRecord, BotStats } from '../types';

interface LiveOperationsProps {
  issues: WinGoIssue[];
  prediction: PredictionPayload | null;
  lastEvaluation: EvaluationRecord | null;
  stats: BotStats;
  onSimulateRound: (numberVal: number) => void;
  onSyncFirebase: () => void;
  isFirebaseSyncing: boolean;
  firebaseStatus: string;
}

export const LiveOperations: React.FC<LiveOperationsProps> = ({
  issues,
  prediction,
  lastEvaluation,
  stats,
  onSimulateRound,
  onSyncFirebase,
  isFirebaseSyncing,
  firebaseStatus,
}) => {
  // 30-second live cycle clock
  const [secondsRemaining, setSecondsRemaining] = useState(30);

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const sec = now.getSeconds();
      const rem = 30 - (sec % 30);
      setSecondsRemaining(rem === 0 ? 30 : rem);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  const latestIssue = issues[0];
  const targetPeriod = prediction?.targetIssue || (latestIssue ? (BigInt(latestIssue.issueNumber) + 1n).toString() : '---');

  const getColorBg = (color: string) => {
    if (color.includes('green') && color.includes('violet')) {
      return 'bg-gradient-to-r from-emerald-500 to-purple-500 text-white';
    }
    if (color.includes('red') && color.includes('violet')) {
      return 'bg-gradient-to-r from-rose-500 to-purple-500 text-white';
    }
    if (color.includes('green')) return 'bg-emerald-500 text-white';
    if (color.includes('red')) return 'bg-rose-500 text-white';
    return 'bg-purple-500 text-white';
  };

  const getPhaseName = (sec: number) => {
    if (sec > 25) return 'ROUND INITIALIZED';
    if (sec > 10) return 'MODEL EVALUATING';
    if (sec > 5) return 'FORECAST LOCKED';
    return 'AWAITING OFFICIAL DRAW';
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Round Cycle Timer & State */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-12 h-12 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-xl font-bold font-mono text-cyan-400 tabular-nums">
                {secondsRemaining.toString().padStart(2, '0')}s
              </span>
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle
                  cx="24"
                  cy="24"
                  r="21"
                  fill="transparent"
                  stroke="#1e293b"
                  strokeWidth="3"
                />
                <circle
                  cx="24"
                  cy="24"
                  r="21"
                  fill="transparent"
                  stroke="#06b6d4"
                  strokeWidth="3"
                  strokeDasharray="132"
                  strokeDashoffset={132 - (132 * (30 - secondsRemaining)) / 30}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-linear"
                />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
                  WinGo 30S Cycle
                </span>
                <span className="text-slate-600">·</span>
                <span className="text-xs font-mono text-cyan-400">{getPhaseName(secondsRemaining)}</span>
              </div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Target Period <span className="font-mono text-cyan-300">#{targetPeriod}</span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="bg-slate-950/80 px-3 py-2 rounded-lg border border-slate-800/80">
              <span className="text-slate-400 block">Current Win Rate</span>
              <span className="text-base font-bold font-mono text-emerald-400 tabular-nums">
                {stats.winRate}%
              </span>
            </div>

            <div className="bg-slate-950/80 px-3 py-2 rounded-lg border border-slate-800/80">
              <span className="text-slate-400 block">Streak</span>
              <span className={`text-base font-bold font-mono tabular-nums ${stats.currentStreak >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {stats.currentStreak >= 0 ? `+${stats.currentStreak} W` : `${stats.currentStreak} L`}
              </span>
            </div>

            <button
              onClick={onSyncFirebase}
              disabled={isFirebaseSyncing}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
            >
              <Database className="w-3.5 h-3.5 text-cyan-400" />
              <span>{isFirebaseSyncing ? 'Syncing...' : 'Sync RTDB'}</span>
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-950 h-1.5 rounded-full mt-4 overflow-hidden border border-slate-800/50">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-1000 ease-linear rounded-full"
            style={{ width: `${((30 - secondsRemaining) / 30) * 100}%` }}
          />
        </div>
      </div>

      {/* Main Focus: Two Cards Grid (Target Prediction & Last Outcome) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Card 1: Active Target Prediction */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Target Forecast
                </span>
              </div>
              <span className="text-xs font-mono text-slate-400">
                Period {targetPeriod}
              </span>
            </div>

            <div className="mt-4 flex items-baseline justify-between">
              <div>
                <span className="text-xs text-slate-400 block mb-1">Classified Prediction</span>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-4xl font-extrabold tracking-tight font-mono ${
                      prediction?.prediction === 'BIG' ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {prediction?.prediction || 'CALCULATING'}
                  </span>
                  <span className="text-xs px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono">
                    {prediction?.prediction === 'BIG' ? '5, 6, 7, 8, 9' : '0, 1, 2, 3, 4'}
                  </span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs text-slate-400 block mb-1">Confidence</span>
                <span className="text-3xl font-extrabold font-mono text-cyan-400 tabular-nums">
                  {prediction?.confidence || 75}%
                </span>
              </div>
            </div>

            {/* Factor Weight Breakdown */}
            <div className="mt-5 space-y-2">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Multi-Factor Consensus
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800/80">
                  <span className="text-slate-400 block text-[10px]">Dragon Streak</span>
                  <span className={`font-mono font-semibold ${prediction?.factors.streak.signal === 'BIG' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {prediction?.factors.streak.signal || '---'}
                  </span>
                </div>
                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800/80">
                  <span className="text-slate-400 block text-[10px]">Markov Recurrence</span>
                  <span className={`font-mono font-semibold ${prediction?.factors.markov.signal === 'BIG' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {prediction?.factors.markov.signal || '---'}
                  </span>
                </div>
                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800/80">
                  <span className="text-slate-400 block text-[10px]">Frequency Drift</span>
                  <span className={`font-mono font-semibold ${prediction?.factors.frequency.signal === 'BIG' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {prediction?.factors.frequency.signal || '---'}
                  </span>
                </div>
                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800/80">
                  <span className="text-slate-400 block text-[10px]">Parity Shift</span>
                  <span className={`font-mono font-semibold ${prediction?.factors.parity.signal === 'BIG' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {prediction?.factors.parity.signal || '---'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 text-xs text-slate-400 flex items-center justify-between">
            <span className="truncate pr-2">{prediction?.summaryRationale || 'Engine calculating upcoming round'}</span>
            <span className="shrink-0 text-slate-400 font-mono">30S Window</span>
          </div>
        </div>

        {/* Card 2: Last Processed Round Resolution */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Latest Draw Resolution
              </span>
              <span className="text-xs font-mono text-slate-400">
                Period {latestIssue?.issueNumber || '---'}
              </span>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                {latestIssue ? (
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-mono font-black text-2xl shadow-lg ${getColorBg(latestIssue.color)}`}>
                    {latestIssue.number}
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-500 font-mono text-xl">
                    ?
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-white">
                      {latestIssue?.isBig ? 'BIG' : 'SMALL'}
                    </span>
                    <span className="text-xs text-slate-400 font-mono capitalize">
                      · {latestIssue?.color} · {latestIssue?.parity}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 font-mono block">
                    Issue: {latestIssue?.issueNumber}
                  </span>
                </div>
              </div>

              {lastEvaluation ? (
                <div className="text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    {lastEvaluation.isWin ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-bold font-mono">
                        <CheckCircle2 className="w-3.5 h-3.5" /> WIN
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/30 text-xs font-bold font-mono">
                        <XCircle className="w-3.5 h-3.5" /> LOSS
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono mt-1 block">
                    Predicted: {lastEvaluation.predictedType}
                  </span>
                </div>
              ) : (
                <span className="text-xs text-slate-400 font-mono">Synced</span>
              )}
            </div>

            {/* Performance Snapshot */}
            <div className="mt-5 grid grid-cols-3 gap-2 text-xs">
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800/80">
                <span className="text-slate-400 block text-[10px]">Total Analyzed</span>
                <span className="font-mono font-bold text-white tabular-nums">
                  {stats.totalRounds} rounds
                </span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800/80">
                <span className="text-slate-400 block text-[10px]">Win / Loss</span>
                <span className="font-mono font-bold text-emerald-400 tabular-nums">
                  {stats.wins} <span className="text-slate-600">/</span> <span className="text-rose-400">{stats.losses}</span>
                </span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800/80">
                <span className="text-slate-400 block text-[10px]">Max Win Run</span>
                <span className="font-mono font-bold text-cyan-400 tabular-nums">
                  +{stats.maxWinStreak}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 text-xs text-slate-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
              <span>Realtime Polling Engine Online</span>
            </span>
            <span className="font-mono text-slate-400">{firebaseStatus}</span>
          </div>
        </div>
      </div>

      {/* Simulator Sandbox: Test Prediction Engine with Injected Numbers */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Simulation Sandbox · Test Round Resolution</span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Click any number (0–9) to simulate a draw result and test how the ensemble model, Telegram alerts, and Firebase react instantly.
            </p>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
            <span>0-4 = Small</span>
            <span className="text-slate-600">·</span>
            <span>5-9 = Big</span>
          </div>
        </div>

        <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
            const isB = num >= 5;
            let ballColor = 'red';
            if ([1, 3, 7, 9].includes(num)) ballColor = 'green';
            else if (num === 0) ballColor = 'red,violet';
            else if (num === 5) ballColor = 'green,violet';

            return (
              <button
                key={num}
                onClick={() => onSimulateRound(num)}
                className={`py-2 px-1 rounded-lg border font-mono font-bold text-sm transition-all hover:scale-105 active:scale-95 flex flex-col items-center gap-0.5 ${
                  isB
                    ? 'bg-slate-950 hover:bg-emerald-950/40 border-slate-800 hover:border-emerald-500/50 text-slate-200'
                    : 'bg-slate-950 hover:bg-rose-950/40 border-slate-800 hover:border-rose-500/50 text-slate-200'
                }`}
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shadow-sm ${getColorBg(ballColor)}`}>
                  {num}
                </span>
                <span className="text-[10px] text-slate-400 font-sans">{isB ? 'BIG' : 'SML'}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* History Data Grid */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Continuous Draw Stream History</h3>
            <span className="text-xs text-slate-400">Sliding window telemetry from WinGo 30S API</span>
          </div>
          <span className="text-xs font-mono text-slate-400">{issues.length} Issues Retained</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-medium">
              <tr>
                <th className="py-2.5 px-4 font-mono">Period Number</th>
                <th className="py-2.5 px-4">Draw Result</th>
                <th className="py-2.5 px-4">Size</th>
                <th className="py-2.5 px-4">Color</th>
                <th className="py-2.5 px-4">Parity</th>
                <th className="py-2.5 px-4 text-right">Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {issues.slice(0, 12).map((issue, idx) => {
                const isBig = issue.isBig;
                return (
                  <tr key={issue.issueNumber} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-4 text-slate-300 font-mono font-medium">
                      {issue.issueNumber}
                      {idx === 0 && (
                        <span className="ml-2 text-[10px] text-cyan-400 font-sans uppercase">Latest</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-bold text-xs shadow-sm ${getColorBg(issue.color)}`}>
                        {issue.number}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className={`font-semibold ${isBig ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isBig ? 'BIG' : 'SMALL'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 capitalize text-slate-400 font-sans">
                      {issue.color}
                    </td>
                    <td className="py-2.5 px-4 text-slate-400">
                      {issue.parity}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      {idx === 0 && lastEvaluation ? (
                        <span className={`font-bold ${lastEvaluation.isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {lastEvaluation.isWin ? 'WIN' : 'LOSS'}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-sans">Resolved</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
