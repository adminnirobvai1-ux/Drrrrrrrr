import React, { useState, useEffect } from 'react';
import { Database, RefreshCw, CheckCircle2, ArrowUpRight, Copy, Check } from 'lucide-react';
import { FirebaseCurrentNode, PredictionPayload, EvaluationRecord, BotStats } from '../types';

interface FirebaseInspectorProps {
  prediction: PredictionPayload | null;
  lastEvaluation: EvaluationRecord | null;
  stats: BotStats;
  onSync: () => void;
  isSyncing: boolean;
}

export const FirebaseInspector: React.FC<FirebaseInspectorProps> = ({
  prediction,
  lastEvaluation,
  stats,
  onSync,
  isSyncing,
}) => {
  const [remoteData, setRemoteData] = useState<FirebaseCurrentNode | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchRemote = async () => {
    setIsLoading(true);
    try {
      const resp = await fetch('/api/firebase/current');
      if (resp.ok) {
        const json = await resp.json();
        setRemoteData(json.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRemote();
  }, []);

  const handleCopyJson = () => {
    if (remoteData) {
      navigator.clipboard.writeText(JSON.stringify(remoteData, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-800 pb-4">
        <h2 className="text-lg font-bold text-white tracking-tight">Firebase Realtime Database Synchronization</h2>
        <p className="text-xs text-slate-400 mt-1">
          Live inspection of persistent synchronization node at <span className="font-mono text-cyan-400">gsgssnn-580ca-default-rtdb.firebaseio.com</span>.
        </p>
      </div>

      {/* Connection & Configuration Info */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white font-mono">gsgssnn-580ca</h3>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> RTDB Connected
                </span>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                https://gsgssnn-580ca-default-rtdb.firebaseio.com
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchRemote}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
              <span>Fetch Live Node</span>
            </button>

            <button
              onClick={() => {
                onSync();
                setTimeout(fetchRemote, 1000);
              }}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-amber-600 hover:bg-amber-500 rounded-lg transition-colors shadow-sm"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>{isSyncing ? 'Syncing...' : 'Push Sync Now'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: Live Node Payload */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Live State: /current_prediction.json
              </span>
            </div>
            <button
              onClick={handleCopyJson}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-white"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs overflow-x-auto text-cyan-300 max-h-[360px]">
            {remoteData ? (
              <pre>{JSON.stringify(remoteData, null, 2)}</pre>
            ) : (
              <div className="text-slate-400 py-6 text-center">
                Click &quot;Fetch Live Node&quot; to inspect current payload.
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 text-xs text-slate-400 flex items-center justify-between">
            <span>Last Remote Sync:</span>
            <span className="font-mono text-slate-300">
              {remoteData?.last_updated ? new Date(remoteData.last_updated).toLocaleTimeString() : '---'}
            </span>
          </div>
        </div>

        {/* Right: Schema Field Mapping */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="pb-3 border-b border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Synchronized Schema Specification
            </h3>
          </div>

          <div className="space-y-2 text-xs">
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono">
              <div className="flex justify-between text-cyan-400 font-bold">
                <span>target_period</span>
                <span className="text-slate-400 text-[11px]">string</span>
              </div>
              <span className="text-slate-400 text-[11px] block mt-0.5 font-sans">
                Upcoming round issue sequence targeted for prediction.
              </span>
            </div>

            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono">
              <div className="flex justify-between text-emerald-400 font-bold">
                <span>prediction</span>
                <span className="text-slate-400 text-[11px]">&apos;BIG&apos; | &apos;SMALL&apos;</span>
              </div>
              <span className="text-slate-400 text-[11px] block mt-0.5 font-sans">
                Deterministic binary classification.
              </span>
            </div>

            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono">
              <div className="flex justify-between text-amber-400 font-bold">
                <span>previous_status</span>
                <span className="text-slate-400 text-[11px]">&apos;WIN&apos; | &apos;LOSS&apos;</span>
              </div>
              <span className="text-slate-400 text-[11px] block mt-0.5 font-sans">
                Resolution result of the immediately preceding period forecast.
              </span>
            </div>

            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono">
              <div className="flex justify-between text-purple-400 font-bold">
                <span>confidence & streak_count</span>
                <span className="text-slate-400 text-[11px]">integer</span>
              </div>
              <span className="text-slate-400 text-[11px] block mt-0.5 font-sans">
                Ensemble confidence percentage (60%-92%) and consecutive streak run count.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
