import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { LiveOperations } from './components/LiveOperations';
import { PatternMatrix } from './components/PatternMatrix';
import { PerformanceDashboard } from './components/PerformanceDashboard';
import { TelegramConsole } from './components/TelegramConsole';
import { FirebaseInspector } from './components/FirebaseInspector';
import { PythonHub } from './components/PythonHub';
import { ClientWinGoAnalyzer } from './lib/wingo-engine';
import { WinGoIssue, PredictionPayload, EvaluationRecord, BotStats, TelegramBotInfo } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('operations');
  const [issues, setIssues] = useState<WinGoIssue[]>([]);
  const [prediction, setPrediction] = useState<PredictionPayload | null>(null);
  const [lastEvaluation, setLastEvaluation] = useState<EvaluationRecord | null>(null);
  const [stats, setStats] = useState<BotStats>({
    totalRounds: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    currentStreak: 0,
    maxWinStreak: 0,
    maxLossStreak: 0,
    unitProfit: 0,
  });
  const [botInfo, setBotInfo] = useState<TelegramBotInfo | null>(null);
  const [isPolling, setIsPolling] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<number>(Date.now());
  const [isFirebaseSyncing, setIsFirebaseSyncing] = useState<boolean>(false);
  const [firebaseStatus, setFirebaseStatus] = useState<string>('Synced');

  // Maintain singleton analyzer instance
  const analyzerRef = useRef<ClientWinGoAnalyzer>(new ClientWinGoAnalyzer());
  const lastProcessedIssueRef = useRef<string | null>(null);

  // Sync to Firebase helper
  const syncToFirebase = useCallback(async (pred: PredictionPayload, evalRecord: EvaluationRecord | null, currStats: BotStats, currentPeriod: string) => {
    setIsFirebaseSyncing(true);
    setFirebaseStatus('Syncing...');
    try {
      const payload = {
        current_period: currentPeriod,
        target_period: pred.targetIssue,
        prediction: pred.prediction,
        previous_status: evalRecord ? evalRecord.status : 'PENDING',
        confidence: pred.confidence,
        win_rate: currStats.winRate,
        streak_count: currStats.currentStreak,
        last_updated: new Date().toISOString(),
        timestamp_ms: Date.now(),
        details: {
          factors: {
            streak: pred.factors.streak.signal,
            markov: pred.factors.markov.signal,
            frequency: pred.factors.frequency.signal,
            parity: pred.factors.parity.signal,
          },
        },
      };

      const resp = await fetch('/api/firebase/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (resp.ok) {
        setFirebaseStatus('Synced');
      } else {
        setFirebaseStatus('Sync Error');
      }
    } catch {
      setFirebaseStatus('Sync Error');
    } finally {
      setIsFirebaseSyncing(false);
    }
  }, []);

  // Poll WinGo History API
  const pollHistory = useCallback(async () => {
    setIsPolling(true);
    try {
      const resp = await fetch('/api/wingo/history');
      if (resp.ok) {
        const data = await resp.json();
        const rawList = data.list || [];
        if (rawList.length > 0) {
          const analyzer = analyzerRef.current;

          // If first load, seed history
          if (analyzer.history.length === 0) {
            analyzer.loadHistory(rawList);
            const latest = analyzer.history[analyzer.history.length - 1];
            lastProcessedIssueRef.current = latest.issueNumber;

            const nextIssueId = (BigInt(latest.issueNumber) + 1n).toString();
            const newPred = analyzer.predictNext(nextIssueId);

            setIssues([...analyzer.history].reverse());
            setPrediction(newPred);
            setStats({ ...analyzer.stats });
            syncToFirebase(newPred, null, analyzer.stats, latest.issueNumber);
          } else {
            // Check if latest issue from API is newer than our processed issue
            const latestApiItem = rawList[0];
            const latestApiIssue = String(latestApiItem.issueNumber);

            if (latestApiIssue !== lastProcessedIssueRef.current) {
              const added = analyzer.addIssue(latestApiItem);
              lastProcessedIssueRef.current = latestApiIssue;

              // Evaluate previous prediction
              const evaluation = analyzer.evaluatePrediction(added);
              if (evaluation) {
                setLastEvaluation(evaluation);
              }

              // Target next period
              let nextTarget = '';
              try {
                nextTarget = (BigInt(added.issueNumber) + 1n).toString();
              } catch {
                nextTarget = `${added.issueNumber}_next`;
              }

              const newPred = analyzer.predictNext(nextTarget);

              setIssues([...analyzer.history].reverse());
              setPrediction(newPred);
              setStats({ ...analyzer.stats });
              setLastSyncTime(Date.now());

              syncToFirebase(newPred, evaluation, analyzer.stats, added.issueNumber);
            }
          }
        }
      }
    } catch (e) {
      console.warn('Polling error:', e);
    } finally {
      setIsPolling(false);
      setLastSyncTime(Date.now());
    }
  }, [syncToFirebase]);

  // Initial load: Fetch bot status & poll API
  useEffect(() => {
    // Check Telegram Bot status
    fetch('/api/telegram/status')
      .then((r) => r.json())
      .then((data) => setBotInfo(data))
      .catch((err) => console.warn('Telegram status check error:', err));

    // First poll
    pollHistory();

    // 4-second recurring poll interval
    const interval = setInterval(pollHistory, 4000);
    return () => clearInterval(interval);
  }, [pollHistory]);

  // Simulation handler for sandbox
  const handleSimulateRound = (numberVal: number) => {
    const analyzer = analyzerRef.current;
    const currentLatest = analyzer.history[analyzer.history.length - 1];
    const newIssueNum = currentLatest ? (BigInt(currentLatest.issueNumber) + 1n).toString() : '20261002100051890';

    let color = 'red';
    if ([1, 3, 7, 9].includes(numberVal)) color = 'green';
    else if (numberVal === 0) color = 'red,violet';
    else if (numberVal === 5) color = 'green,violet';

    const simIssue = analyzer.addIssue({
      issueNumber: newIssueNum,
      number: numberVal,
      color,
    });

    lastProcessedIssueRef.current = newIssueNum;

    // Evaluate
    const evaluation = analyzer.evaluatePrediction(simIssue);
    if (evaluation) {
      setLastEvaluation(evaluation);
    }

    // Predict next
    const nextTarget = (BigInt(newIssueNum) + 1n).toString();
    const newPred = analyzer.predictNext(nextTarget);

    setIssues([...analyzer.history].reverse());
    setPrediction(newPred);
    setStats({ ...analyzer.stats });
    setLastSyncTime(Date.now());

    syncToFirebase(newPred, evaluation, analyzer.stats, newIssueNum);
  };

  const handleManualSyncFirebase = () => {
    if (prediction && issues.length > 0) {
      syncToFirebase(prediction, lastEvaluation, stats, issues[0].issueNumber);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isPolling={isPolling}
        onRefresh={pollHistory}
        lastSyncTime={lastSyncTime}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'operations' && (
          <LiveOperations
            issues={issues}
            prediction={prediction}
            lastEvaluation={lastEvaluation}
            stats={stats}
            onSimulateRound={handleSimulateRound}
            onSyncFirebase={handleManualSyncFirebase}
            isFirebaseSyncing={isFirebaseSyncing}
            firebaseStatus={firebaseStatus}
          />
        )}

        {activeTab === 'matrix' && (
          <PatternMatrix issues={issues} prediction={prediction} />
        )}

        {activeTab === 'performance' && (
          <PerformanceDashboard stats={stats} evaluations={analyzerRef.current.evaluations} />
        )}

        {activeTab === 'telegram' && (
          <TelegramConsole
            botInfo={botInfo}
            prediction={prediction}
            lastEvaluation={lastEvaluation}
          />
        )}

        {activeTab === 'firebase' && (
          <FirebaseInspector
            prediction={prediction}
            lastEvaluation={lastEvaluation}
            stats={stats}
            onSync={handleManualSyncFirebase}
            isSyncing={isFirebaseSyncing}
          />
        )}

        {activeTab === 'code' && <PythonHub />}
      </main>

      <footer className="border-t border-slate-800/80 bg-slate-950 py-4 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-300">WinGo 30S Automated System</span>
            <span>·</span>
            <span>24/7 Engine</span>
            <span>·</span>
            <span>Telegram Bot + Firebase RTDB</span>
          </div>
          <div className="flex items-center gap-3 font-mono text-[11px] text-slate-400">
            <span>Target: draw.ar-lottery01.com</span>
            <span>·</span>
            <span>Node: gsgssnn-580ca</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
