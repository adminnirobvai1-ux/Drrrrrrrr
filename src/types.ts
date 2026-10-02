export interface WinGoIssue {
  issueNumber: string;
  number: number;
  color: string;
  isBig: boolean;
  parity: 'ODD' | 'EVEN';
  premium?: string;
  sum?: number;
}

export interface FactorDetail {
  signal: 'BIG' | 'SMALL';
  score: number;
  detail: string;
  streakLen?: number;
  lastType?: string;
  pBig?: number;
  pSmall?: number;
  recentAvg?: number;
}

export interface PredictionPayload {
  targetIssue: string;
  prediction: 'BIG' | 'SMALL';
  confidence: number;
  scoreBig: number;
  scoreSmall: number;
  factors: {
    streak: FactorDetail;
    markov: FactorDetail;
    frequency: FactorDetail;
    parity: FactorDetail;
  };
  summaryRationale: string;
  timestamp: number;
}

export interface EvaluationRecord {
  issueNumber: string;
  targetIssue: string;
  predictedType: 'BIG' | 'SMALL';
  actualType: 'BIG' | 'SMALL';
  actualNumber: number;
  actualColor: string;
  isWin: boolean;
  status: 'WIN' | 'LOSS';
  confidence: number;
  currentStreak: number;
  winRate: number;
  timestamp: number;
}

export interface BotStats {
  totalRounds: number;
  wins: number;
  losses: number;
  winRate: number;
  currentStreak: number;
  maxWinStreak: number;
  maxLossStreak: number;
  unitProfit: number;
}

export interface TelegramBotInfo {
  ok: boolean;
  result?: {
    id: number;
    is_bot: boolean;
    first_name: string;
    username: string;
    can_join_groups?: boolean;
  };
  error?: string;
}

export interface FirebaseCurrentNode {
  current_period: string;
  target_period: string;
  prediction: 'BIG' | 'SMALL';
  previous_status: 'WIN' | 'LOSS' | 'PENDING';
  confidence: number;
  win_rate: number;
  streak_count: number;
  last_updated: string;
  timestamp_ms: number;
  details?: Record<string, any>;
}
