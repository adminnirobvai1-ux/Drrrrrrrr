import React, { useState } from 'react';
import { Send, CheckCircle2, AlertCircle, Bot, MessageSquare, Terminal, ExternalLink } from 'lucide-react';
import { TelegramBotInfo, PredictionPayload, EvaluationRecord } from '../types';

interface TelegramConsoleProps {
  botInfo: TelegramBotInfo | null;
  prediction: PredictionPayload | null;
  lastEvaluation: EvaluationRecord | null;
}

export const TelegramConsole: React.FC<TelegramConsoleProps> = ({
  botInfo,
  prediction,
  lastEvaluation,
}) => {
  const [chatIdInput, setChatIdInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [activeCommandPreview, setActiveCommandPreview] = useState<string>('/status');

  const botUsername = botInfo?.result?.username || 'Fjjfjdjdjjf88484_bot';
  const botId = botInfo?.result?.id || '8955426078';

  // Generate the exact live broadcast text that the Python bot sends
  const getLiveBroadcastText = () => {
    const lines: string[] = [];

    if (lastEvaluation) {
      const isWin = lastEvaluation.isWin;
      const statusBadge = isWin ? '✅ *WIN*' : '❌ *LOSS*';
      const streakStr = lastEvaluation.currentStreak >= 0 ? `+${lastEvaluation.currentStreak} W` : `${lastEvaluation.currentStreak} L`;
      const colorIcon = lastEvaluation.actualColor.includes('green') ? '🟢' : (lastEvaluation.actualColor.includes('red') ? '🔴' : '🟣');

      lines.push(`🔔 *Period [${lastEvaluation.issueNumber.slice(-5)}] Resolved*`);
      lines.push(`• *Draw:* \`${lastEvaluation.actualNumber}\` ${colorIcon} (${lastEvaluation.actualType})`);
      lines.push(`• *Forecast:* \`${lastEvaluation.predictedType}\` ➔ ${statusBadge}`);
      lines.push(`• *Streak:* \`${streakStr}\` | *Win Rate:* \`${lastEvaluation.winRate}%\``);
      lines.push(`━━━━━━━━━━━━━━━━━━`);
    }

    if (prediction) {
      const predIcon = prediction.prediction === 'BIG' ? '🟢' : '🔴';
      lines.push(`🎯 *TARGET: Period [${prediction.targetIssue.slice(-5)}]*`);
      lines.push(`• *Prediction:* *${prediction.prediction}* ${predIcon}`);
      lines.push(`• *Confidence:* \`${prediction.confidence}%\``);
      lines.push(`• *Strategy:* \`${prediction.summaryRationale.slice(0, 60)}\``);
      lines.push(`• *Target Period Full:* \`${prediction.targetIssue}\``);
      lines.push(`⏱️ *Resolution in ~30s*`);
    }

    return lines.join('\n');
  };

  const handleSendTestMessage = async () => {
    if (!chatIdInput.trim()) {
      setSendResult({ ok: false, message: 'Please enter your numeric Telegram Chat ID.' });
      return;
    }

    setIsSending(true);
    setSendResult(null);

    try {
      const resp = await fetch('/api/telegram/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: chatIdInput.trim(),
          text: getLiveBroadcastText(),
        }),
      });

      const data = await resp.json();
      if (data.ok) {
        setSendResult({ ok: true, message: `Successfully dispatched message to Chat ID ${chatIdInput}!` });
      } else {
        setSendResult({ ok: false, message: data.description || data.error || 'Failed to send message.' });
      }
    } catch (err: any) {
      setSendResult({ ok: false, message: err.message || 'Network error occurred.' });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-800 pb-4">
        <h2 className="text-lg font-bold text-white tracking-tight">Telegram Bot Notification Engine</h2>
        <p className="text-xs text-slate-400 mt-1">
          Automated subscriber alerts and interactive command dispatcher powered by <span className="font-mono text-cyan-400">python-telegram-bot</span>.
        </p>
      </div>

      {/* Bot Identity Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white font-mono">@{botUsername}</h3>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Online
                </span>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                Bot ID: {botId} · Token: 8955426078:AA...Pw
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`https://t.me/${botUsername}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg transition-colors shadow-sm"
            >
              <span>Open in Telegram</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: Realistic Telegram Message Preview */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                <MessageSquare className="w-4 h-4 text-cyan-400" />
                <span>Live Broadcast Formatting Preview</span>
              </div>
              <span className="text-xs font-mono text-slate-400">Markdown V1</span>
            </div>

            {/* Telegram Bubble Mockup */}
            <div className="bg-[#182533] border border-[#2b394a] rounded-2xl p-4 text-sm font-sans shadow-md text-slate-100 max-w-md mx-auto sm:mx-0">
              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-[#2b394a]/60">
                <div className="w-5 h-5 rounded-full bg-cyan-500 flex items-center justify-center text-[10px] font-bold text-slate-950">
                  W
                </div>
                <span className="text-xs font-semibold text-cyan-400">WinGo 30S Bot</span>
                <span className="text-[10px] text-slate-400 ml-auto font-mono">Just now</span>
              </div>

              <div className="space-y-2 text-xs leading-relaxed">
                {lastEvaluation && (
                  <div>
                    <p className="font-bold text-white">
                      🔔 Period [{lastEvaluation.issueNumber.slice(-5)}] Resolved
                    </p>
                    <p>• Draw: <code className="bg-[#0f1721] px-1 py-0.5 rounded text-cyan-300 font-mono">{lastEvaluation.actualNumber}</code> {lastEvaluation.actualColor.includes('green') ? '🟢' : '🔴'} ({lastEvaluation.actualType})</p>
                    <p>• Forecast: <code className="bg-[#0f1721] px-1 py-0.5 rounded text-cyan-300 font-mono">{lastEvaluation.predictedType}</code> ➔ {lastEvaluation.isWin ? <span className="text-emerald-400 font-bold">✅ WIN</span> : <span className="text-rose-400 font-bold">❌ LOSS</span>}</p>
                    <p>• Streak: <code className="bg-[#0f1721] px-1 py-0.5 rounded font-mono">{lastEvaluation.currentStreak >= 0 ? `+${lastEvaluation.currentStreak} W` : `${lastEvaluation.currentStreak} L`}</code> | Win Rate: <code className="bg-[#0f1721] px-1 py-0.5 rounded font-mono">{lastEvaluation.winRate}%</code></p>
                    <div className="border-t border-[#2b394a] my-2" />
                  </div>
                )}

                {prediction && (
                  <div>
                    <p className="font-bold text-cyan-300">
                      🎯 TARGET: Period [{prediction.targetIssue.slice(-5)}]
                    </p>
                    <p className="text-sm font-bold text-white mt-1">
                      • Prediction: <span className={prediction.prediction === 'BIG' ? 'text-emerald-400' : 'text-rose-400'}>*{prediction.prediction}*</span> {prediction.prediction === 'BIG' ? '🟢' : '🔴'}
                    </p>
                    <p>• Confidence: <code className="bg-[#0f1721] px-1 py-0.5 rounded text-cyan-300 font-mono">{prediction.confidence}%</code></p>
                    <p className="text-slate-300 text-[11px]">• Strategy: {prediction.summaryRationale.slice(0, 60)}...</p>
                    <p className="text-[10px] text-slate-400 mt-2">⏱️ Resolution in ~30s</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400">
            Dispatched every 30 seconds immediately upon official result resolution.
          </div>
        </div>

        {/* Right: Live Test Dispatcher */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <Send className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Live Test Dispatcher
            </h3>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Test the live Telegram API integration directly. Send a real formatted forecast notification to your personal Telegram account right now.
          </p>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Your Telegram Chat ID
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. 123456789"
                  value={chatIdInput}
                  onChange={(e) => setChatIdInput(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 flex-1"
                />
                <button
                  onClick={handleSendTestMessage}
                  disabled={isSending}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSending ? 'Sending...' : 'Send Test'}</span>
                </button>
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">
                Tip: Send <code className="text-cyan-400">/start</code> to <a href={`https://t.me/${botUsername}`} target="_blank" rel="noreferrer" className="underline">@{botUsername}</a> first, then enter your chat ID (obtain via <a href="https://t.me/userinfobot" target="_blank" rel="noreferrer" className="text-cyan-400 underline">@userinfobot</a>).
              </span>
            </div>

            {sendResult && (
              <div
                className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
                  sendResult.ok
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                }`}
              >
                {sendResult.ok ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                )}
                <span>{sendResult.message}</span>
              </div>
            )}
          </div>

          <div className="border-t border-slate-800 pt-4">
            <h4 className="text-xs font-semibold text-slate-300 mb-2">Supported Commands Cheatsheet</h4>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <span className="text-cyan-400 font-bold">/start</span>
                <span className="text-slate-400 text-[11px] block mt-0.5">Subscribe to live alerts</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <span className="text-cyan-400 font-bold">/status</span>
                <span className="text-slate-400 text-[11px] block mt-0.5">View target prediction</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <span className="text-cyan-400 font-bold">/stats</span>
                <span className="text-slate-400 text-[11px] block mt-0.5">Accuracy & win streaks</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <span className="text-cyan-400 font-bold">/unsubscribe</span>
                <span className="text-slate-400 text-[11px] block mt-0.5">Pause notifications</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
