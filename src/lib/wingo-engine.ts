import { WinGoIssue, PredictionPayload, EvaluationRecord, BotStats, FactorDetail } from '../types';

export function parseIssue(raw: any): WinGoIssue {
  const num = Number(raw.number ?? raw.openNum ?? 0);
  const issueNumber = String(raw.issueNumber ?? raw.period ?? '');
  let color = String(raw.color ?? raw.colour ?? '').toLowerCase().trim();

  if (!color) {
    if ([1, 3, 7, 9].includes(num)) color = 'green';
    else if ([2, 4, 6, 8].includes(num)) color = 'red';
    else if (num === 0) color = 'red,violet';
    else if (num === 5) color = 'green,violet';
  }

  return {
    issueNumber,
    number: num,
    color,
    isBig: num >= 5,
    parity: num % 2 !== 0 ? 'ODD' : 'EVEN',
    premium: raw.premium ? String(raw.premium) : undefined,
    sum: raw.sum !== undefined ? Number(raw.sum) : undefined,
  };
}

export class ClientWinGoAnalyzer {
  history: WinGoIssue[] = [];
  lastPrediction: PredictionPayload | null = null;
  evaluations: EvaluationRecord[] = [];

  stats: BotStats = {
    totalRounds: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    currentStreak: 0,
    maxWinStreak: 0,
    maxLossStreak: 0,
    unitProfit: 0,
  };

  constructor(initialIssues?: any[]) {
    if (initialIssues && initialIssues.length > 0) {
      this.loadHistory(initialIssues);
    }
  }

  loadHistory(rawList: any[]) {
    // Sort oldest first
    const sorted = [...rawList].sort((a, b) => {
      const aNum = BigInt(String(a.issueNumber || 0));
      const bNum = BigInt(String(b.issueNumber || 0));
      return aNum < bNum ? -1 : aNum > bNum ? 1 : 0;
    });

    for (const item of sorted) {
      this.addIssue(item);
    }

    // Generate initial prediction if we have history
    if (this.history.length > 0) {
      const latest = this.history[this.history.length - 1];
      try {
        const nextId = (BigInt(latest.issueNumber) + 1n).toString();
        this.predictNext(nextId);
      } catch {
        this.predictNext(`${latest.issueNumber}_next`);
      }
    }
  }

  addIssue(raw: any): WinGoIssue {
    const issue = parseIssue(raw);
    const existingIdx = this.history.findIndex((x) => x.issueNumber === issue.issueNumber);
    if (existingIdx !== -1) {
      this.history[existingIdx] = issue;
      return issue;
    }
    this.history.push(issue);
    if (this.history.length > 100) {
      this.history.shift();
    }
    return issue;
  }

  evaluatePrediction(actualIssue: WinGoIssue): EvaluationRecord | null {
    if (!this.lastPrediction) return null;

    const target = this.lastPrediction.targetIssue;
    if (target && target !== actualIssue.issueNumber) {
      return null;
    }

    const predicted = this.lastPrediction.prediction;
    const actual = actualIssue.isBig ? 'BIG' : 'SMALL';
    const isWin = predicted === actual;

    this.stats.totalRounds += 1;
    if (isWin) {
      this.stats.wins += 1;
      this.stats.currentStreak = this.stats.currentStreak >= 0 ? this.stats.currentStreak + 1 : 1;
      this.stats.maxWinStreak = Math.max(this.stats.maxWinStreak, this.stats.currentStreak);
      this.stats.unitProfit += 0.96; // Standard 1-unit flat bet profit after 4% commission
    } else {
      this.stats.losses += 1;
      this.stats.currentStreak = this.stats.currentStreak <= 0 ? this.stats.currentStreak - 1 : -1;
      this.stats.maxLossStreak = Math.max(this.stats.maxLossStreak, Math.abs(this.stats.currentStreak));
      this.stats.unitProfit -= 1.0;
    }

    this.stats.winRate =
      this.stats.totalRounds > 0 ? Number(((this.stats.wins / this.stats.totalRounds) * 100).toFixed(1)) : 0;

    const record: EvaluationRecord = {
      issueNumber: actualIssue.issueNumber,
      targetIssue: target,
      predictedType: predicted,
      actualType: actual,
      actualNumber: actualIssue.number,
      actualColor: actualIssue.color,
      isWin,
      status: isWin ? 'WIN' : 'LOSS',
      confidence: this.lastPrediction.confidence,
      currentStreak: this.stats.currentStreak,
      winRate: this.stats.winRate,
      timestamp: Date.now(),
    };

    this.evaluations.unshift(record);
    if (this.evaluations.length > 50) this.evaluations.pop();

    this.lastPrediction = null;
    return record;
  }

  analyzeStreaks(): FactorDetail {
    if (this.history.length === 0) {
      return { signal: 'BIG', score: 0.5, detail: 'Initial baseline' };
    }

    const last = this.history[this.history.length - 1];
    const lastType = last.isBig ? 'BIG' : 'SMALL';

    let streak = 0;
    for (let i = this.history.length - 1; i >= 0; i--) {
      const type = this.history[i].isBig ? 'BIG' : 'SMALL';
      if (type === lastType) streak++;
      else break;
    }

    if (streak <= 3) {
      return {
        signal: lastType,
        score: 0.55 + streak * 0.05,
        streakLen: streak,
        lastType,
        detail: `Short ${lastType} trend follow (streak=${streak})`,
      };
    } else if (streak <= 6) {
      return {
        signal: lastType,
        score: 0.72,
        streakLen: streak,
        lastType,
        detail: `Dragon Run continuation (${lastType} streak=${streak})`,
      };
    } else {
      const rev = lastType === 'BIG' ? 'SMALL' : 'BIG';
      return {
        signal: rev,
        score: 0.68,
        streakLen: streak,
        lastType,
        detail: `Streak fatigue detected (${streak} consecutive ${lastType}), mean-reversion favored`,
      };
    }
  }

  analyzeMarkov(): FactorDetail {
    if (this.history.length < 10) {
      return { signal: 'BIG', score: 0.5, detail: 'Awaiting minimum sample size' };
    }

    const transitions = {
      BIG: { BIG: 0, SMALL: 0 },
      SMALL: { BIG: 0, SMALL: 0 },
    };

    for (let i = 0; i < this.history.length - 1; i++) {
      const curr = this.history[i].isBig ? 'BIG' : 'SMALL';
      const next = this.history[i + 1].isBig ? 'BIG' : 'SMALL';
      transitions[curr][next]++;
    }

    const last = this.history[this.history.length - 1].isBig ? 'BIG' : 'SMALL';
    const total = transitions[last].BIG + transitions[last].SMALL;

    if (total === 0) {
      return { signal: 'BIG', score: 0.5, detail: 'Uniform transition' };
    }

    const pBig = transitions[last].BIG / total;
    const pSmall = transitions[last].SMALL / total;
    const signal = pBig >= pSmall ? 'BIG' : 'SMALL';
    const score = Math.max(pBig, pSmall);

    return {
      signal,
      score,
      pBig: Number(pBig.toFixed(3)),
      pSmall: Number(pSmall.toFixed(3)),
      detail: `Markov P(Big|${last})=${(pBig * 100).toFixed(0)}%, P(Small|${last})=${(pSmall * 100).toFixed(0)}%`,
    };
  }

  analyzeParity(): FactorDetail {
    if (this.history.length < 8) {
      return { signal: 'BIG', score: 0.5, detail: 'Parity baseline' };
    }

    const recent = this.history.slice(-8);
    const oddCount = recent.filter((x) => x.parity === 'ODD').length;
    const evenCount = recent.length - oddCount;

    if (oddCount > evenCount) {
      return {
        signal: 'SMALL',
        score: 0.58,
        detail: `Parity shift to EVEN favored after ${oddCount}/8 ODD run`,
      };
    } else {
      return {
        signal: 'BIG',
        score: 0.58,
        detail: `Parity shift to ODD favored after ${evenCount}/8 EVEN run`,
      };
    }
  }

  analyzeFrequencies(): FactorDetail {
    if (this.history.length < 10) {
      return { signal: 'BIG', score: 0.5, detail: 'Frequency baseline' };
    }

    const recentSlice = this.history.slice(-15);
    const sum = recentSlice.reduce((acc, curr) => acc + curr.number, 0);
    const avg = sum / recentSlice.length;

    if (avg > 4.7) {
      return {
        signal: 'BIG',
        score: Math.min(0.75, 0.52 + (avg - 4.5) * 0.1),
        recentAvg: Number(avg.toFixed(2)),
        detail: `Positive momentum (recent 15-round avg=${avg.toFixed(2)})`,
      };
    } else {
      return {
        signal: 'SMALL',
        score: Math.min(0.75, 0.52 + (4.5 - avg) * 0.1),
        recentAvg: Number(avg.toFixed(2)),
        detail: `Negative momentum (recent 15-round avg=${avg.toFixed(2)})`,
      };
    }
  }

  predictNext(targetIssue: string): PredictionPayload {
    const streak = this.analyzeStreaks();
    const markov = this.analyzeMarkov();
    const frequency = this.analyzeFrequencies();
    const parity = this.analyzeParity();

    const weights = {
      streak: 0.35,
      markov: 0.3,
      frequency: 0.2,
      parity: 0.15,
    };

    let scoreBig = 0;
    let scoreSmall = 0;

    for (const [key, factor, weight] of [
      ['streak', streak, weights.streak],
      ['markov', markov, weights.markov],
      ['frequency', frequency, weights.frequency],
      ['parity', parity, weights.parity],
    ] as const) {
      const sig = factor.signal;
      const sc = factor.score;
      if (sig === 'BIG') {
        scoreBig += weight * sc;
        scoreSmall += weight * (1.0 - sc);
      } else {
        scoreSmall += weight * sc;
        scoreBig += weight * (1.0 - sc);
      }
    }

    const prediction = scoreBig >= scoreSmall ? 'BIG' : 'SMALL';
    const total = scoreBig + scoreSmall || 1;
    const rawConf = Math.round((Math.max(scoreBig, scoreSmall) / total) * 100);
    const confidence = Math.max(60, Math.min(92, rawConf));

    const payload: PredictionPayload = {
      targetIssue,
      prediction,
      confidence,
      scoreBig: Number(scoreBig.toFixed(3)),
      scoreSmall: Number(scoreSmall.toFixed(3)),
      factors: {
        streak,
        markov,
        frequency,
        parity,
      },
      summaryRationale: `${prediction} selected: ${streak.detail} · ${markov.detail}`,
      timestamp: Date.now(),
    };

    this.lastPrediction = payload;
    return payload;
  }
}
