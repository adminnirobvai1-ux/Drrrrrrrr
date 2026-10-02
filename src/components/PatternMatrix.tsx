import React from 'react';
import { Layers, GitCommit, Binary, BarChart3, Shuffle, Gauge } from 'lucide-react';
import { WinGoIssue, PredictionPayload } from '../types';

interface PatternMatrixProps {
  issues: WinGoIssue[];
  prediction: PredictionPayload | null;
}

export const PatternMatrix: React.FC<PatternMatrixProps> = ({ issues, prediction }) => {
  // 1. Calculate Markov transitions
  const transitions = {
    BIG: { BIG: 0, SMALL: 0 },
    SMALL: { BIG: 0, SMALL: 0 },
  };

  for (let i = 0; i < issues.length - 1; i++) {
    const curr = issues[i].isBig ? 'BIG' : 'SMALL';
    const next = issues[i + 1].isBig ? 'BIG' : 'SMALL';
    transitions[curr][next]++;
  }

  const bigTotal = transitions.BIG.BIG + transitions.BIG.SMALL || 1;
  const smallTotal = transitions.SMALL.BIG + transitions.SMALL.SMALL || 1;

  const pBigBig = Math.round((transitions.BIG.BIG / bigTotal) * 100);
  const pBigSmall = Math.round((transitions.BIG.SMALL / bigTotal) * 100);
  const pSmallBig = Math.round((transitions.SMALL.BIG / smallTotal) * 100);
  const pSmallSmall = Math.round((transitions.SMALL.SMALL / smallTotal) * 100);

  // 2. Number frequencies for 0-9
  const counts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
  issues.forEach((x) => {
    if (counts[x.number] !== undefined) counts[x.number]++;
  });
  const maxCount = Math.max(...Object.values(counts), 1);

  // 3. Parity ratio
  const oddCount = issues.filter((x) => x.parity === 'ODD').length;
  const evenCount = issues.length - oddCount;
  const oddPct = issues.length > 0 ? Math.round((oddCount / issues.length) * 100) : 50;

  // 4. Streak
  const streakDetail = prediction?.factors.streak;

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-800 pb-4">
        <h2 className="text-lg font-bold text-white tracking-tight">Multi-Factor Analytical Matrix</h2>
        <p className="text-xs text-slate-400 mt-1">
          Detailed mathematical modules running inside <span className="font-mono text-cyan-400">analyzer.py</span> to eliminate arbitrary betting intuition.
        </p>
      </div>

      {/* Grid of 4 Analysis Engines */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Module 1: Markov Transition Matrix */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <GitCommit className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Markov State Transition Matrix
              </h3>
            </div>
            <span className="text-xs font-mono text-slate-400">Weight: 30%</span>
          </div>

          <p className="text-xs text-slate-400 mt-3">
            Empirical probabilities that state S(t) transitions to state S(t+1) based on recent empirical rounds.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3 text-xs font-mono">
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-slate-400">P(BIG | BIG)</span>
                <span className="text-emerald-400 font-bold tabular-nums">{pBigBig}%</span>
              </div>
              <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${pBigBig}%` }} />
              </div>
              <span className="text-[10px] text-slate-400 font-sans block mt-1">Continuation on Big</span>
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-slate-400">P(SMALL | BIG)</span>
                <span className="text-rose-400 font-bold tabular-nums">{pBigSmall}%</span>
              </div>
              <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                <div className="bg-rose-500 h-full rounded-full" style={{ width: `${pBigSmall}%` }} />
              </div>
              <span className="text-[10px] text-slate-400 font-sans block mt-1">Reversal from Big</span>
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-slate-400">P(SMALL | SMALL)</span>
                <span className="text-rose-400 font-bold tabular-nums">{pSmallSmall}%</span>
              </div>
              <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                <div className="bg-rose-500 h-full rounded-full" style={{ width: `${pSmallSmall}%` }} />
              </div>
              <span className="text-[10px] text-slate-400 font-sans block mt-1">Continuation on Small</span>
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-slate-400">P(BIG | SMALL)</span>
                <span className="text-emerald-400 font-bold tabular-nums">{pSmallBig}%</span>
              </div>
              <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${pSmallBig}%` }} />
              </div>
              <span className="text-[10px] text-slate-400 font-sans block mt-1">Reversal from Small</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 text-xs text-slate-400 flex items-center justify-between">
            <span>Markov Factor Signal:</span>
            <span className={`font-mono font-bold ${prediction?.factors.markov.signal === 'BIG' ? 'text-emerald-400' : 'text-rose-400'}`}>
              {prediction?.factors.markov.signal} ({prediction?.factors.markov.detail})
            </span>
          </div>
        </div>

        {/* Module 2: Streak & Dragon Engine */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Streak & Dragon Run Engine
              </h3>
            </div>
            <span className="text-xs font-mono text-slate-400">Weight: 35%</span>
          </div>

          <p className="text-xs text-slate-400 mt-3">
            Tracks consecutive outcomes to separate standard runs from extended Dragon trends and exhaustion switchpoints.
          </p>

          <div className="mt-4 space-y-3">
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 block">Consecutive Streak Detected</span>
                <span className="text-lg font-bold font-mono text-white">
                  {streakDetail?.streakLen || 1} rounds of {streakDetail?.lastType || 'BIG'}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400 block">Regime</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                  {(streakDetail?.streakLen || 0) >= 4 ? 'Dragon Run' : 'Trend Alignment'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <div className="bg-slate-950 p-2 rounded-lg border border-slate-800/80">
                <span className="text-slate-400 block">Short Run (1-3)</span>
                <span className="text-emerald-400 font-mono font-medium">Follow Trend</span>
              </div>
              <div className="bg-slate-950 p-2 rounded-lg border border-slate-800/80">
                <span className="text-slate-400 block">Dragon (4-6)</span>
                <span className="text-cyan-400 font-mono font-medium">Continuation</span>
              </div>
              <div className="bg-slate-950 p-2 rounded-lg border border-slate-800/80">
                <span className="text-slate-400 block">Extreme (7+)</span>
                <span className="text-rose-400 font-mono font-medium">Mean Reversion</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 text-xs text-slate-400 flex items-center justify-between">
            <span>Streak Recommendation:</span>
            <span className={`font-mono font-bold ${streakDetail?.signal === 'BIG' ? 'text-emerald-400' : 'text-rose-400'}`}>
              {streakDetail?.signal} · Score {(streakDetail?.score || 0.5).toFixed(2)}
            </span>
          </div>
        </div>

        {/* Module 3: Number Frequency Histogram */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-purple-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Digit Frequencies & Momentum
              </h3>
            </div>
            <span className="text-xs font-mono text-slate-400">Weight: 20%</span>
          </div>

          <p className="text-xs text-slate-400 mt-3">
            Heatmap of drawn numbers 0 through 9 in the current sliding window.
          </p>

          <div className="mt-4 grid grid-cols-10 gap-1.5 text-center">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
              const count = counts[num] || 0;
              const isB = num >= 5;
              const heightPct = Math.max(15, (count / maxCount) * 100);

              return (
                <div key={num} className="flex flex-col items-center gap-1">
                  <div className="w-full bg-slate-950 h-20 rounded-md relative flex items-end justify-center p-1 border border-slate-800/80">
                    <div
                      className={`w-full rounded-sm transition-all ${isB ? 'bg-emerald-500/80' : 'bg-rose-500/80'}`}
                      style={{ height: `${heightPct}%` }}
                    />
                    <span className="absolute top-1 text-[10px] font-mono text-slate-300 tabular-nums">
                      {count}
                    </span>
                  </div>
                  <span className="font-mono text-xs font-bold text-slate-200">{num}</span>
                  <span className="text-[9px] text-slate-400 uppercase">{isB ? 'B' : 'S'}</span>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 text-xs text-slate-400 flex items-center justify-between">
            <span>Recent 15-Round Avg:</span>
            <span className="font-mono text-cyan-400">
              {prediction?.factors.frequency.recentAvg || 4.5} (Neutral: 4.50)
            </span>
          </div>
        </div>

        {/* Module 4: Parity Dynamics */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Binary className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Parity Dynamics (Odd / Even)
              </h3>
            </div>
            <span className="text-xs font-mono text-slate-400">Weight: 15%</span>
          </div>

          <p className="text-xs text-slate-400 mt-3">
            In WinGo: Odd numbers (1,3,5,7,9) skew 60% Big; Even numbers (0,2,4,6,8) skew 60% Small.
          </p>

          <div className="mt-4 space-y-3">
            <div>
              <div className="flex justify-between text-xs font-mono mb-1.5">
                <span className="text-slate-300">ODD ({oddCount} hits)</span>
                <span className="text-slate-300">EVEN ({evenCount} hits)</span>
              </div>
              <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden flex border border-slate-800">
                <div className="bg-amber-500 h-full" style={{ width: `${oddPct}%` }} />
                <div className="bg-cyan-500 h-full" style={{ width: `${100 - oddPct}%` }} />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono">
                <span>{oddPct}%</span>
                <span>{100 - oddPct}%</span>
              </div>
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80 text-xs">
              <span className="text-slate-400 block mb-1">Theoretical Balance</span>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                Parity clustering beyond 4 consecutive draws triggers an inverse mean-reversion pull, calibrating the final ensemble decision.
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 text-xs text-slate-400 flex items-center justify-between">
            <span>Parity Signal:</span>
            <span className={`font-mono font-bold ${prediction?.factors.parity.signal === 'BIG' ? 'text-emerald-400' : 'text-rose-400'}`}>
              {prediction?.factors.parity.signal} ({prediction?.factors.parity.detail})
            </span>
          </div>
        </div>
      </div>

      {/* Ensemble Decision Architecture */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
          <Gauge className="w-4 h-4 text-cyan-400" />
          <span>Weighted Ensemble Calibrator · Mathematical Decision Formula</span>
        </h3>
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 space-y-2">
          <div className="text-cyan-300 font-semibold">
            Outcome = ArgMax[ Score(BIG), Score(SMALL) ]
          </div>
          <div className="text-slate-400 text-[11px] leading-relaxed">
            Score = (0.35 × Streak) + (0.30 × Markov) + (0.20 × Frequency) + (0.15 × Parity)
          </div>
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span>Current Computed Scores:</span>
            <span className="text-white">
              BIG: <span className="text-emerald-400 font-bold">{prediction?.scoreBig || 0}</span> · SMALL:{' '}
              <span className="text-rose-400 font-bold">{prediction?.scoreSmall || 0}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
