"""
WinGo 30S Multi-Factor Trend Analyzer and Prediction Engine.
Author: Lottery Bot 24/7 Operations
"""

from collections import deque, Counter
from dataclasses import dataclass, asdict
from typing import List, Dict, Optional, Tuple, Any
import logging

logger = logging.getLogger("analyzer")


@dataclass
class WinGoIssue:
    issue_number: str
    number: int
    color: str
    is_big: bool       # True for 5, 6, 7, 8, 9; False for 0, 1, 2, 3, 4
    parity: str       # 'ODD' or 'EVEN'

    @property
    def outcome_type(self) -> str:
        return "BIG" if self.is_big else "SMALL"

    @classmethod
    def from_raw(cls, issue_number: str, number_val: Any, color_val: str = "") -> "WinGoIssue":
        num = int(number_val)
        is_big = num >= 5
        parity = "ODD" if num % 2 != 0 else "EVEN"

        # WinGo Color rules if not explicitly supplied
        color = str(color_val).lower().strip()
        if not color:
            if num in (1, 3, 7, 9):
                color = "green"
            elif num in (2, 4, 6, 8):
                color = "red"
            elif num == 0:
                color = "red,violet"
            elif num == 5:
                color = "green,violet"

        return cls(
            issue_number=str(issue_number),
            number=num,
            color=color,
            is_big=is_big,
            parity=parity
        )


class WinGoAnalyzer:
    """
    Sliding-window pattern recognition, Markov state analysis,
    parity transition mapping, and streak fatigue detection.
    """

    def __init__(self, window_size: int = 100):
        self.window_size = window_size
        self.history: deque[WinGoIssue] = deque(maxlen=window_size)
        self.last_prediction: Optional[Dict[str, Any]] = None

        # Performance Tracking
        self.total_rounds: int = 0
        self.wins: int = 0
        self.losses: int = 0
        self.current_streak: int = 0  # +N for wins, -N for losses
        self.max_win_streak: int = 0
        self.max_loss_streak: int = 0
        self.recent_evaluations: deque[Dict[str, Any]] = deque(maxlen=50)

    def load_history(self, raw_list: List[Dict[str, Any]]):
        """Seed initial history from API list (ordered newest first or oldest first)."""
        # Ensure chronological ordering: oldest first into deque
        sorted_list = sorted(raw_list, key=lambda x: str(x.get("issueNumber", "")))
        for item in sorted_list:
            issue_num = str(item.get("issueNumber"))
            number_val = item.get("number")
            color_val = item.get("color", "")
            if issue_num and number_val is not None:
                self.add_issue(issue_num, number_val, color_val)
        logger.info(f"Loaded {len(self.history)} issues into analyzer sliding window.")

    def add_issue(self, issue_number: str, number_val: Any, color_val: str = "") -> WinGoIssue:
        # Avoid duplicate issues in sliding window
        for item in self.history:
            if item.issue_number == str(issue_number):
                return item

        issue = WinGoIssue.from_raw(issue_number, number_val, color_val)
        self.history.append(issue)
        return issue

    def evaluate_last_prediction(self, issue_number: str, actual_number: int, actual_color: str = "") -> Optional[Dict[str, Any]]:
        """
        Cross-reference previously issued target prediction against the actual published result.
        Marks outcome as WIN or LOSS and updates tracking statistics.
        """
        actual_issue = self.add_issue(issue_number, actual_number, actual_color)

        if not self.last_prediction:
            return None

        target_issue = str(self.last_prediction.get("target_issue", ""))
        # Match against target period
        if target_issue and target_issue != str(issue_number):
            # Not matching the targeted issue
            return None

        predicted_type = self.last_prediction.get("prediction")
        actual_type = actual_issue.outcome_type
        is_win = (predicted_type == actual_type)

        self.total_rounds += 1
        if is_win:
            self.wins += 1
            if self.current_streak >= 0:
                self.current_streak += 1
            else:
                self.current_streak = 1
            self.max_win_streak = max(self.max_win_streak, self.current_streak)
        else:
            self.losses += 1
            if self.current_streak <= 0:
                self.current_streak -= 1
            else:
                self.current_streak = -1
            self.max_loss_streak = max(self.max_loss_streak, abs(self.current_streak))

        eval_record = {
            "issue_number": issue_number,
            "target_issue": target_issue,
            "predicted_type": predicted_type,
            "actual_type": actual_type,
            "actual_number": actual_number,
            "actual_color": actual_issue.color,
            "is_win": is_win,
            "status": "WIN" if is_win else "LOSS",
            "confidence": self.last_prediction.get("confidence", 70),
            "current_streak": self.current_streak,
            "win_rate": round((self.wins / self.total_rounds) * 100, 1) if self.total_rounds > 0 else 0.0
        }

        self.recent_evaluations.append(eval_record)
        # Clear used prediction
        self.last_prediction = None
        return eval_record

    def _analyze_streaks(self) -> Dict[str, Any]:
        """
        Evaluate consecutive Big or Small occurrence runs.
        - Short streaks (1-3): trend continuation has high edge.
        - Long streaks (4-6): Dragon run follow-through.
        - Extreme streaks (7+): Mean-reversion probability escalates.
        """
        if not self.history:
            return {"signal": "BIG", "weight": 0.5, "streak_len": 0, "type": "NONE"}

        history_list = list(self.history)
        last_item = history_list[-1]
        last_type = last_item.outcome_type

        streak = 0
        for item in reversed(history_list):
            if item.outcome_type == last_type:
                streak += 1
            else:
                break

        # Trend / Streak logic
        if streak in (1, 2, 3):
            # Follow moderate trend
            signal = last_type
            score = 0.55 + (streak * 0.05)
            detail = f"Follow short {last_type} run (streak={streak})"
        elif streak in (4, 5, 6):
            # Strong Dragon run continuation
            signal = last_type
            score = 0.72
            detail = f"Dragon run continuation ({last_type} streak={streak})"
        else:
            # Streak fatigue / Mean-reversion pivot
            signal = "SMALL" if last_type == "BIG" else "BIG"
            score = 0.68
            detail = f"Streak fatigue detected ({streak} consecutive {last_type}), mean-reversion favored"

        return {
            "signal": signal,
            "score": score,
            "streak_len": streak,
            "last_type": last_type,
            "detail": detail
        }

    def _analyze_markov(self) -> Dict[str, Any]:
        """
        Markov Chain empirical transition probabilities:
        P(Big | Big), P(Small | Big), P(Big | Small), P(Small | Small).
        """
        if len(self.history) < 10:
            return {"signal": "BIG", "score": 0.5, "detail": "Insufficient window for Markov"}

        transitions = {"BIG": {"BIG": 0, "SMALL": 0}, "SMALL": {"BIG": 0, "SMALL": 0}}
        history_list = list(self.history)

        for i in range(len(history_list) - 1):
            curr_state = history_list[i].outcome_type
            next_state = history_list[i + 1].outcome_type
            transitions[curr_state][next_state] += 1

        last_state = history_list[-1].outcome_type
        total_from_last = transitions[last_state]["BIG"] + transitions[last_state]["SMALL"]

        if total_from_last == 0:
            return {"signal": "BIG", "score": 0.5, "detail": "No transition history"}

        p_big = transitions[last_state]["BIG"] / total_from_last
        p_small = transitions[last_state]["SMALL"] / total_from_last

        signal = "BIG" if p_big >= p_small else "SMALL"
        score = max(p_big, p_small)
        detail = f"P(Big|{last_state})={p_big:.2f}, P(Small|{last_state})={p_small:.2f}"

        return {
            "signal": signal,
            "score": score,
            "p_big": round(p_big, 3),
            "p_small": round(p_small, 3),
            "detail": detail
        }

    def _analyze_parity(self) -> Dict[str, Any]:
        """
        Evaluate Odd/Even transitions and their historical clustering with Big/Small.
        """
        if len(self.history) < 8:
            return {"signal": "BIG", "score": 0.5, "detail": "Insufficient parity data"}

        history_list = list(self.history)
        recent = history_list[-8:]
        odd_count = sum(1 for x in recent if x.parity == "ODD")
        even_count = len(recent) - odd_count

        # Check Big/Small distribution within odd/even
        # WinGo numbers:
        # Odd: 1, 3, 5, 7, 9 (3 Big, 2 Small -> 60% Big)
        # Even: 0, 2, 4, 6, 8 (2 Big, 3 Small -> 60% Small)
        if odd_count > even_count:
            # Expected parity alternation favors EVEN -> leans SMALL
            signal = "SMALL"
            score = 0.58
            detail = f"Parity shift expected after {odd_count}/8 ODD run"
        else:
            signal = "BIG"
            score = 0.58
            detail = f"Parity shift expected after {even_count}/8 EVEN run"

        return {"signal": signal, "score": score, "detail": detail}

    def _analyze_number_frequencies(self) -> Dict[str, Any]:
        """
        Evaluates Hot/Cold numbers across the sliding window and calculates
        the weighted sum drift.
        """
        if len(self.history) < 10:
            return {"signal": "BIG", "score": 0.5, "detail": "Insufficient numbers"}

        history_list = list(self.history)
        nums = [x.number for x in history_list]
        counter = Counter(nums)

        # Average of numbers (theoretical neutral = 4.5)
        recent_avg = sum(nums[-15:]) / min(15, len(nums))

        # Big numbers are 5,6,7,8,9; Small are 0,1,2,3,4
        big_freq = sum(counter[n] for n in range(5, 10))
        small_freq = sum(counter[n] for n in range(0, 5))

        if recent_avg > 4.7:
            # Drift is currently high -> Big momentum
            signal = "BIG"
            score = min(0.75, 0.52 + (recent_avg - 4.5) * 0.1)
            detail = f"Positive momentum (recent 15-round avg={recent_avg:.2f})"
        else:
            signal = "SMALL"
            score = min(0.75, 0.52 + (4.5 - recent_avg) * 0.1)
            detail = f"Negative momentum (recent 15-round avg={recent_avg:.2f})"

        return {
            "signal": signal,
            "score": score,
            "recent_avg": round(recent_avg, 2),
            "big_freq": big_freq,
            "small_freq": small_freq,
            "detail": detail
        }

    def predict_next(self, target_issue_number: str) -> Dict[str, Any]:
        """
        Combines multi-factor modules into a deterministic ensemble outcome:
        strictly classified as BIG or SMALL.
        """
        streak_factor = self._analyze_streaks()
        markov_factor = self._analyze_markov()
        parity_factor = self._analyze_parity()
        freq_factor = self._analyze_number_frequencies()

        # Weights calibration
        weights = {
            "streak": 0.35,
            "markov": 0.30,
            "frequency": 0.20,
            "parity": 0.15
        }

        # Calculate weighted voting score for BIG vs SMALL
        score_big = 0.0
        score_small = 0.0

        for key, factor, weight in [
            ("streak", streak_factor, weights["streak"]),
            ("markov", markov_factor, weights["markov"]),
            ("frequency", freq_factor, weights["frequency"]),
            ("parity", parity_factor, weights["parity"])
        ]:
            sig = factor.get("signal", "BIG")
            sc = factor.get("score", 0.5)
            if sig == "BIG":
                score_big += weight * sc
                score_small += weight * (1.0 - sc)
            else:
                score_small += weight * sc
                score_big += weight * (1.0 - sc)

        # Deterministic outcome strictly BIG or SMALL
        if score_big >= score_small:
            prediction = "BIG"
            total = score_big + score_small
            confidence_pct = int(round((score_big / (total or 1.0)) * 100))
        else:
            prediction = "SMALL"
            total = score_big + score_small
            confidence_pct = int(round((score_small / (total or 1.0)) * 100))

        # Clamp confidence to realistic 60%-92% range
        confidence = max(60, min(92, confidence_pct))

        prediction_payload = {
            "target_issue": str(target_issue_number),
            "prediction": prediction,
            "confidence": confidence,
            "score_big": round(score_big, 3),
            "score_small": round(score_small, 3),
            "factors": {
                "streak": streak_factor,
                "markov": markov_factor,
                "frequency": freq_factor,
                "parity": parity_factor
            },
            "summary_rationale": f"{prediction} selected via ensemble: {streak_factor.get('detail')} | {markov_factor.get('detail')}"
        }

        self.last_prediction = prediction_payload
        return prediction_payload

    def get_summary_stats(self) -> Dict[str, Any]:
        """Summary for Telegram /stats and API telemetry."""
        win_rate = round((self.wins / self.total_rounds) * 100, 1) if self.total_rounds > 0 else 0.0
        return {
            "total_rounds": self.total_rounds,
            "wins": self.wins,
            "losses": self.losses,
            "win_rate": win_rate,
            "current_streak": self.current_streak,
            "max_win_streak": self.max_win_streak,
            "max_loss_streak": self.max_loss_streak,
            "history_depth": len(self.history)
        }
