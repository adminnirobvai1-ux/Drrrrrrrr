#!/usr/bin/env python3
"""
WinGo 30S 24/7 Automated Lottery Analysis & Telegram Notification Bot.
Handles API polling, pattern analysis, Firebase sync, and Telegram alerts.
"""

import os
import sys
import json
import time
import signal
import asyncio
import logging
from typing import Set, Dict, Any, Optional

try:
    import aiohttp
    HAS_AIOHTTP = True
except ImportError:
    import urllib.request
    import urllib.error
    HAS_AIOHTTP = False

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    # Minimal fallback parser if python-dotenv is not installed
    if os.path.exists(".env"):
        with open(".env", "r", encoding="utf-8") as _f:
            for _line in _f:
                _line = _line.strip()
                if _line and not _line.startswith("#") and "=" in _line:
                    _k, _v = _line.split("=", 1)
                    os.environ.setdefault(_k.strip(), _v.strip().strip('"').strip("'"))

from analyzer import WinGoAnalyzer
from firebase_sync import FirebaseSyncManager

# Logging configuration
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("lottery_bot.log", encoding="utf-8")
    ]
)
logger = logging.getLogger("bot_main")

# Configuration constants
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "8955426078:AAEjgvtoMPYDb2gl8vgf8yXmaIiq7UfRu5s")
WINGO_API_URL = os.getenv("WINGO_API_URL", "https://draw.ar-lottery01.com/WinGo/WinGo_30S/GetHistoryIssuePage.json")
POLL_INTERVAL_BASE = float(os.getenv("POLL_INTERVAL_SECONDS", "3.5"))
SUBSCRIBERS_FILE = os.getenv("SUBSCRIBERS_FILE", "subscribers.json")
STATE_FILE = os.getenv("STATE_FILE", "bot_state.json")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Connection": "keep-alive"
}


class LotteryTelegramBot:
    def __init__(self):
        self.analyzer = WinGoAnalyzer(window_size=100)
        self.firebase = FirebaseSyncManager()
        self.subscribers: Set[int] = self._load_subscribers()
        self.last_processed_period: Optional[str] = self._load_last_period()
        self.running: bool = True
        self.session: Optional[aiohttp.ClientSession] = None
        self.telegram_offset: int = 0
        self.start_time: float = time.time()
        self.consecutive_fetch_errors: int = 0

    def _load_subscribers(self) -> Set[int]:
        if os.path.exists(SUBSCRIBERS_FILE):
            try:
                with open(SUBSCRIBERS_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    return set(data.get("subscribers", []))
            except Exception as e:
                logger.error(f"Failed to load subscribers: {e}")
        return set()

    def _save_subscribers(self):
        try:
            with open(SUBSCRIBERS_FILE, "w", encoding="utf-8") as f:
                json.dump({"subscribers": list(self.subscribers)}, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save subscribers: {e}")

    def _load_last_period(self) -> Optional[str]:
        if os.path.exists(STATE_FILE):
            try:
                with open(STATE_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    return data.get("last_processed_period")
            except Exception as e:
                logger.error(f"Failed to load bot state: {e}")
        return None

    def _save_last_period(self, period: str):
        try:
            with open(STATE_FILE, "w", encoding="utf-8") as f:
                json.dump({
                    "last_processed_period": str(period),
                    "updated_at": time.time(),
                    "stats": self.analyzer.get_summary_stats()
                }, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save state: {e}")

    async def init_http(self):
        if HAS_AIOHTTP:
            timeout = aiohttp.ClientTimeout(total=10, connect=5)
            connector = aiohttp.TCPConnector(limit=20, keepalive_timeout=30)
            self.session = aiohttp.ClientSession(timeout=timeout, connector=connector, headers=HEADERS)
        else:
            self.session = True
            logger.info("Running network engine with Python standard library urllib.")

    async def close_http(self):
        if HAS_AIOHTTP and self.session and hasattr(self.session, "close") and not self.session.closed:
            await self.session.close()

    def _sync_http_request(self, method: str, url: str, json_data: Optional[Dict] = None, timeout: float = 6) -> Optional[Dict]:
        """Synchronous HTTP request via standard library urllib."""
        try:
            req_data = json.dumps(json_data).encode("utf-8") if json_data else None
            req = urllib.request.Request(url, data=req_data, headers=HEADERS, method=method)
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                content = resp.read().decode("utf-8")
                return json.loads(content)
        except Exception as e:
            logger.debug(f"urllib request error for {url}: {e}")
            return None

    # -------------------------------------------------------------
    # Telegram API Methods (Direct async HTTP for high resilience)
    # -------------------------------------------------------------
    async def send_telegram_message(self, chat_id: int, text: str, parse_mode: str = "Markdown") -> bool:
        if not self.session:
            return False
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": text,
            "parse_mode": parse_mode,
            "disable_web_page_preview": True
        }
        try:
            if HAS_AIOHTTP and isinstance(self.session, aiohttp.ClientSession):
                async with self.session.post(url, json=payload, timeout=8) as resp:
                    data = await resp.json()
                    if not data.get("ok"):
                        logger.warning(f"Telegram send failed for chat {chat_id}: {data.get('description')}")
                        if resp.status == 403 or "blocked" in str(data.get("description", "")).lower():
                            if chat_id in self.subscribers:
                                self.subscribers.remove(chat_id)
                                self._save_subscribers()
                                logger.info(f"Unsubscribed unreachable user: {chat_id}")
                        return False
                    return True
            else:
                data = await asyncio.to_thread(self._sync_http_request, "POST", url, payload, 8)
                if data and data.get("ok"):
                    return True
                logger.warning(f"Telegram send response for {chat_id}: {data}")
                return False
        except Exception as e:
            logger.error(f"Network error sending telegram message to {chat_id}: {e}")
            return False

    async def broadcast_message(self, text: str):
        if not self.subscribers:
            logger.debug("No active subscribers for broadcast.")
            return

        tasks = [self.send_telegram_message(chat_id, text) for chat_id in list(self.subscribers)]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        successes = sum(1 for r in results if r is True)
        logger.info(f"Broadcast dispatched: {successes}/{len(self.subscribers)} delivered.")

    async def poll_telegram_updates(self):
        """Processes incoming subscriber commands (/start, /status, /stats, /predict)."""
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getUpdates?offset={self.telegram_offset}&timeout=2"

        try:
            if HAS_AIOHTTP and isinstance(self.session, aiohttp.ClientSession):
                async with self.session.get(url, timeout=5) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                    else:
                        return
            else:
                data = await asyncio.to_thread(self._sync_http_request, "GET", url, None, 5)

            if data and data.get("ok"):
                for update in data.get("result", []):
                    self.telegram_offset = update["update_id"] + 1
                    message = update.get("message")
                    if not message or "text" not in message:
                        continue

                    chat_id = message["chat"]["id"]
                    text = message["text"].strip().lower()

                    await self._handle_telegram_command(chat_id, text, message)
        except Exception as e:
            logger.debug(f"Telegram update polling error: {e}")

    async def _handle_telegram_command(self, chat_id: int, command: str, message: Dict):
        user_name = message.get("from", {}).get("first_name", "Trader")

        if command.startswith("/start"):
            self.subscribers.add(chat_id)
            self._save_subscribers()
            welcome = (
                f"👋 *Welcome, {user_name}!*\\n\\n"
                f"🎰 *WinGo 30S Automated 24/7 Analysis & Notification Bot*\\n\\n"
                f"✅ *You are now subscribed to live predictions!*\\n"
                f"Every 30 seconds, you will receive:\\n"
                f"• Verified resolution of the previous round (WIN/LOSS)\\n"
                f"• High-confidence prediction for the target upcoming round\\n\\n"
                f"📌 *Commands:*\\n"
                f"`/status` - Live round & target forecast\\n"
                f"`/stats`  - Win rate & streak telemetry\\n"
                f"`/predict`- Instant on-demand forecast\\n"
                f"`/unsubscribe` - Pause alerts\\n"
            )
            await self.send_telegram_message(chat_id, welcome)

        elif command.startswith("/subscribe"):
            self.subscribers.add(chat_id)
            self._save_subscribers()
            await self.send_telegram_message(chat_id, "✅ *Subscribed!* You will receive real-time round forecasts.")

        elif command.startswith("/unsubscribe"):
            if chat_id in self.subscribers:
                self.subscribers.remove(chat_id)
                self._save_subscribers()
            await self.send_telegram_message(chat_id, "⏸️ *Unsubscribed.* Use `/start` or `/subscribe` anytime to resume.")

        elif command.startswith("/status") or command.startswith("/predict"):
            pred = self.analyzer.last_prediction
            stats = self.analyzer.get_summary_stats()
            if pred:
                target_issue = pred.get("target_issue")
                prediction = pred.get("prediction")
                conf = pred.get("confidence")
                icon = "🟢" if prediction == "BIG" else "🔴"
                msg = (
                    f"🎯 *Current Target Forecast*\\n\\n"
                    f"• *Target Period:* `{target_issue}`\\n"
                    f"• *Prediction:* *{prediction}* {icon}\\n"
                    f"• *Confidence:* `{conf}%`\\n"
                    f"• *Win Rate:* `{stats['win_rate']}%` ({stats['wins']}/{stats['total_rounds']})\\n"
                    f"• *Current Streak:* `{stats['current_streak']}`\\n"
                    f"• *Last Processed:* `{self.last_processed_period or 'Syncing...'}`"
                )
            else:
                msg = "⏳ *Analyzing latest rounds...* Next forecast arriving within 10-20 seconds."
            await self.send_telegram_message(chat_id, msg)

        elif command.startswith("/stats"):
            stats = self.analyzer.get_summary_stats()
            uptime_hours = round((time.time() - self.start_time) / 3600, 2)
            msg = (
                f"📊 *WinGo 30S Performance Telemetry*\\n\\n"
                f"• *Total Rounds Analyzed:* `{stats['total_rounds']}`\\n"
                f"• *Wins:* `{stats['wins']}` | *Losses:* `{stats['losses']}`\\n"
                f"• *Overall Accuracy:* `{stats['win_rate']}%`\\n"
                f"• *Current Streak:* `{stats['current_streak']}`\\n"
                f"• *Max Win Streak:* `{stats['max_win_streak']}`\\n"
                f"• *Max Loss Streak:* `{stats['max_loss_streak']}`\\n"
                f"• *Subscribers:* `{len(self.subscribers)}`\\n"
                f"• *System Uptime:* `{uptime_hours} hrs`"
            )
            await self.send_telegram_message(chat_id, msg)

        elif command.startswith("/help"):
            msg = (
                f"📖 *WinGo 30S Bot Help Guide*\\n\\n"
                f"• The bot analyzes `WinGo 30S` draw results from official endpoints.\\n"
                f"• Classifications: `0-4 = SMALL`, `5-9 = BIG`.\\n"
                f"• Predictions combine Dragon streaks, Markov probabilities, and parity shifts.\\n\\n"
                f"📌 *Command List:*\\n"
                f"`/start` - Register & start receiving alerts\\n"
                f"`/status` - View current period & forecast\\n"
                f"`/stats` - View win rate & accuracy\\n"
                f"`/unsubscribe` - Pause alerts"
            )
            await self.send_telegram_message(chat_id, msg)

    # -------------------------------------------------------------
    # API Polling Engine & State Resolution
    # -------------------------------------------------------------
    async def fetch_history_page(self) -> Optional[Dict[str, Any]]:
        if not self.session:
            return None

        try:
            if HAS_AIOHTTP and isinstance(self.session, aiohttp.ClientSession):
                async with self.session.get(WINGO_API_URL, timeout=6) as resp:
                    if resp.status == 200:
                        self.consecutive_fetch_errors = 0
                        return await resp.json()
                    else:
                        logger.warning(f"WinGo API non-200 status: {resp.status}")
                        self.consecutive_fetch_errors += 1
                        return None
            else:
                data = await asyncio.to_thread(self._sync_http_request, "GET", WINGO_API_URL, None, 6)
                if data:
                    self.consecutive_fetch_errors = 0
                    return data
                else:
                    self.consecutive_fetch_errors += 1
                    return None
        except Exception as e:
            self.consecutive_fetch_errors += 1
            logger.warning(f"Error fetching WinGo API ({self.consecutive_fetch_errors} fails): {e}")
            return None

    def _extract_issues_list(self, raw_data: Dict[str, Any]) -> list:
        if not raw_data:
            return []
        data_block = raw_data.get("data", {})
        if isinstance(data_block, dict):
            return data_block.get("list", [])
        elif isinstance(data_block, list):
            return data_block
        return []

    async def process_latest_round(self, issue_item: Dict[str, Any]):
        issue_number = str(issue_item.get("issueNumber"))
        number_val = int(issue_item.get("number"))
        color_val = str(issue_item.get("color", ""))

        # Check if already processed
        if self.last_processed_period == issue_number:
            return

        is_big = number_val >= 5
        actual_type = "BIG" if is_big else "SMALL"

        logger.info(f"🔔 Detected New Round Resolved: Period {issue_number} -> Number {number_val} ({actual_type} | {color_val})")

        # 1. Evaluate previous prediction against this result
        eval_record = self.analyzer.evaluate_last_prediction(issue_number, number_val, color_val)

        # 2. Determine target next period (increment sequence)
        try:
            target_period = str(int(issue_number) + 1)
        except ValueError:
            target_period = f"{issue_number}_next"

        # 3. Generate multi-factor prediction for the target period
        prediction = self.analyzer.predict_next(target_period)
        stats = self.analyzer.get_summary_stats()

        # 4. Sync immediately to Firebase Realtime Database
        prev_status = eval_record.get("status", "PENDING") if eval_record else "PENDING"
        self.firebase.update_current_prediction(
            current_period=issue_number,
            target_period=target_period,
            prediction=prediction["prediction"],
            previous_status=prev_status,
            confidence=prediction["confidence"],
            win_rate=stats["win_rate"],
            streak_count=stats["current_streak"],
            extra_data={
                "actual_number": number_val,
                "actual_color": color_val,
                "factors": {k: v.get("signal") for k, v in prediction.get("factors", {}).items()}
            }
        )

        # 5. Broadcast to Telegram Subscribers
        # Build clean, high-impact Markdown notification
        pred_type = prediction["prediction"]
        pred_icon = "🟢" if pred_type == "BIG" else "🔴"
        color_icon = "🟢" if "green" in color_val else ("🔴" if "red" in color_val else "🟣")

        msg_lines = []

        if eval_record:
            status_badge = "✅ *WIN*" if eval_record["is_win"] else "❌ *LOSS*"
            streak_str = f"+{stats['current_streak']} W" if stats['current_streak'] > 0 else f"{stats['current_streak']} L"
            msg_lines.extend([
                f"🔔 *Period [{issue_number[-5:]}] Resolved*",
                f"• *Draw:* `{number_val}` {color_icon} ({actual_type})",
                f"• *Forecast:* `{eval_record['predicted_type']}` ➔ {status_badge}",
                f"• *Streak:* `{streak_str}` | *Win Rate:* `{stats['win_rate']}%`",
                f"━━━━━━━━━━━━━━━━━━"
            ])
        else:
            msg_lines.extend([
                f"🔔 *Period [{issue_number[-5:]}] Synced*",
                f"• *Draw:* `{number_val}` {color_icon} ({actual_type})",
                f"━━━━━━━━━━━━━━━━━━"
            ])

        msg_lines.extend([
            f"🎯 *TARGET: Period [{target_period[-5:]}]*",
            f"• *Prediction:* *{pred_type}* {pred_icon}",
            f"• *Confidence:* `{prediction['confidence']}%`",
            f"• *Strategy:* `{prediction['summary_rationale'][:65]}`",
            f"• *Target Period Full:* `{target_period}`",
            f"⏱️ *Resolution in ~30s*"
        ])

        broadcast_text = "\\n".join(msg_lines)
        await self.broadcast_message(broadcast_text)

        # 6. Update local state
        self.last_processed_period = issue_number
        self._save_last_period(issue_number)

    async def run(self):
        """Main 24/7 non-blocking polling and execution loop."""
        logger.info("Initializing 24/7 WinGo Lottery Polling Engine...")
        await self.init_http()

        # Seed initial history window
        initial_data = await self.fetch_history_page()
        if initial_data:
            issues = self._extract_issues_list(initial_data)
            if issues:
                self.analyzer.load_history(issues)
                # First prediction generation
                latest = issues[0]
                latest_period = str(latest.get("issueNumber"))
                self.last_processed_period = latest_period
                target = str(int(latest_period) + 1)
                self.analyzer.predict_next(target)
                logger.info(f"Initialized state. Latest period: {latest_period}, Target: {target}")

        logger.info(f"Bot online. Monitoring {WINGO_API_URL} every {POLL_INTERVAL_BASE}s. Subscribers: {len(self.subscribers)}")

        while self.running:
            try:
                # 1. Check incoming Telegram user commands
                await self.poll_telegram_updates()

                # 2. Poll WinGo API for new issue resolution
                raw = await self.fetch_history_page()
                if raw:
                    issues = self._extract_issues_list(raw)
                    if issues:
                        latest_issue = issues[0]
                        await self.process_latest_round(latest_issue)

                # 3. Dynamic adaptive sleep: back off if consecutive errors
                if self.consecutive_fetch_errors > 0:
                    sleep_time = min(30.0, POLL_INTERVAL_BASE * (1.5 ** self.consecutive_fetch_errors))
                    logger.debug(f"Backoff sleep: {sleep_time:.1f}s")
                else:
                    sleep_time = POLL_INTERVAL_BASE

                await asyncio.sleep(sleep_time)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Unexpected error in main polling loop: {e}", exc_info=True)
                await asyncio.sleep(5)

        await self.close_http()
        logger.info("WinGo Lottery Polling Engine gracefully shut down.")

    def stop(self):
        self.running = False


def setup_signal_handlers(bot: LotteryTelegramBot):
    def handle_signal(sig, frame):
        logger.info(f"Received shutdown signal ({sig}). Stopping bot gracefully...")
        bot.stop()

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)


if __name__ == "__main__":
    bot = LotteryTelegramBot()
    setup_signal_handlers(bot)
    try:
        asyncio.run(bot.run())
    except KeyboardInterrupt:
        logger.info("Process interrupted by user.")
