#!/usr/bin/env python3
"""
Unified 24/7 Automated Lottery Analysis, Firebase Sync & Telegram Broadcast Engine.
Designed for autonomous deployment on Linux VPS/RDP.
"""

import os
import sys
import time
import signal
import asyncio
import logging
from collections import deque
from typing import Dict, Any, Optional, Set, Tuple

import aiohttp
from dotenv import load_dotenv

import firebase_admin
from firebase_admin import credentials, db

from telegram import Update
from telegram.ext import Application, ApplicationBuilder, CommandHandler, ContextTypes
from telegram.error import TelegramError, Forbidden

# ---------------------------------------------------------------------------
# 1. Environment & Logging Configuration
# ---------------------------------------------------------------------------
load_dotenv()

logging.basicConfig(
    format="%(asctime)s [%(levelname)s] (%(name)s) %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    level=logging.INFO,
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("LotteryEngine")

# Credentials & Connection Parameters
BOT_TOKEN: str = os.getenv("TELEGRAM_BOT_TOKEN", "8955426078:AAFqNBBXIyw9TdQjCTHXUQ6cs2olnjRr6Gs")
FIREBASE_DB_URL: str = os.getenv("FIREBASE_DATABASE_URL", "https://gsgssnn-580ca-default-rtdb.firebaseio.com")
FIREBASE_KEY_PATH: str = os.getenv("FIREBASE_CREDENTIALS_PATH", "serviceAccountKey.json")
API_ENDPOINT: str = os.getenv("API_ENDPOINT", "https://draw.ar-lottery01.com/WinGo/WinGo_30S/GetHistoryIssuePage.json")
POLL_INTERVAL: float = float(os.getenv("POLL_INTERVAL_SECONDS", "1.5"))
MAX_HISTORY: int = int(os.getenv("MAX_HISTORY_SIZE", "100"))

# ---------------------------------------------------------------------------
# 2. Heuristic Pattern Analysis & Statistical Modeling
# ---------------------------------------------------------------------------
class PatternAnalyzer:
    """Evaluates continuous sliding windows of round outcomes to forecast Big/Small."""
    
    def __init__(self, max_history: int = 100):
        self.history: deque = deque(maxlen=max_history)
        self.last_target_period: Optional[str] = None
        self.last_predicted_value: Optional[str] = None

    @staticmethod
    def classify_outcome(number: int) -> Tuple[str, str]:
        """
        WinGo numerical taxonomy:
        - 0 to 4: SMALL
        - 5 to 9: BIG
        - Colors: Green (1,3,7,9), Red (2,4,6,8), Violet/Dual (0,5)
        """
        classification = "BIG" if number >= 5 else "SMALL"
        if number in (1, 3, 7, 9):
            color = "GREEN"
        elif number in (2, 4, 6, 8):
            color = "RED"
        else:
            color = "VIOLET"
        return classification, color

    def add_round(self, period: str, number: int) -> None:
        classification, color = self.classify_outcome(number)
        self.history.appendleft({
            "period": str(period),
            "number": number,
            "classification": classification,
            "color": color,
            "timestamp": int(time.time())
        })

    def evaluate_result(self, period: str, number: int) -> str:
        """Determines if the active prediction targeting this round was a WIN or LOSS."""
        if not self.last_target_period or not self.last_predicted_value:
            return "N/A"
        
        if str(period) == str(self.last_target_period):
            actual_classification, _ = self.classify_outcome(number)
            return "WIN" if actual_classification == self.last_predicted_value else "LOSS"
        return "N/A"

    def predict_next(self, target_period: str) -> str:
        """
        Deterministic multi-factor analysis:
        1. Streak Length Evaluation (reversal threshold on long sequences >= 4)
        2. Window Momentum (rides 2-3 step trends)
        3. Mean-Reversion Divergence (frequency equilibrium across sliding window)
        """
        if len(self.history) < 5:
            # Baseline initialization
            prediction = "BIG"
            self.last_target_period = str(target_period)
            self.last_predicted_value = prediction
            return prediction

        # Factor 1: Streak Length
        recent = [entry["classification"] for entry in list(self.history)[:10]]
        active_streak = recent[0]
        streak_count = 0
        for item in recent:
            if item == active_streak:
                streak_count += 1
            else:
                break

        # Factor 2: Sliding Window Balance
        big_count = sum(1 for e in self.history if e["classification"] == "BIG")
        total_count = len(self.history)
        big_ratio = big_count / total_count

        # Execution rules
        if streak_count >= 4:
            # High streak exhaustion: mean-reversion favored
            prediction = "SMALL" if active_streak == "BIG" else "BIG"
        elif streak_count in (2, 3):
            # Mid-level persistence: momentum riding
            prediction = active_streak
        else:
            # Statistical equilibrium balancing
            prediction = "SMALL" if big_ratio > 0.50 else "BIG"

        self.last_target_period = str(target_period)
        self.last_predicted_value = prediction
        return prediction

# ---------------------------------------------------------------------------
# 3. Firebase Synchronization Adapter
# ---------------------------------------------------------------------------
class FirebaseClient:
    """Manages RTDB persistence for predictions, outcomes, and subscribers."""
    
    def __init__(self, key_path: str, db_url: str):
        self.enabled = False
        try:
            if not firebase_admin._apps:
                cred = credentials.Certificate(key_path)
                firebase_admin.initialize_app(cred, {"databaseURL": db_url})
            self.live_ref = db.reference("live_prediction")
            self.subscribers_ref = db.reference("subscribers")
            self.enabled = True
            logger.info("Connected successfully to Firebase Realtime Database.")
        except Exception as err:
            logger.error(f"Firebase initialization failed: {err}. Operating in local-only fallback.")

    def sync_live_state(self, current_period: str, target_period: str, prediction: str, last_status: str) -> None:
        if not self.enabled:
            return
        payload = {
            "current_period": str(current_period),
            "target_period": str(target_period),
            "prediction": prediction,
            "last_status": last_status,
            "timestamp": int(time.time())
        }
        try:
            self.live_ref.set(payload)
        except Exception as err:
            logger.error(f"Failed to sync state to Firebase: {err}")

    def add_subscriber(self, chat_id: int) -> None:
        if not self.enabled:
            return
        try:
            self.subscribers_ref.child(str(chat_id)).set(True)
        except Exception as err:
            logger.error(f"Failed to record subscriber {chat_id}: {err}")

    def remove_subscriber(self, chat_id: int) -> None:
        if not self.enabled:
            return
        try:
            self.subscribers_ref.child(str(chat_id)).delete()
        except Exception as err:
            logger.error(f"Failed to delete subscriber {chat_id}: {err}")

    def fetch_subscribers(self) -> Set[int]:
        if not self.enabled:
            return set()
        try:
            data = self.subscribers_ref.get()
            if isinstance(data, dict):
                return {int(chat_id) for chat_id in data.keys()}
        except Exception as err:
            logger.error(f"Failed retrieving subscriber records: {err}")
        return set()

# ---------------------------------------------------------------------------
# 4. Global State & Helper Functions
# ---------------------------------------------------------------------------
class EngineState:
    def __init__(self):
        self.subscribers: Set[int] = set()
        self.last_settled_period: Optional[str] = None
        self.current_target_period: Optional[str] = None
        self.current_prediction: Optional[str] = None
        self.last_status: str = "INIT"

state = EngineState()
analyzer = PatternAnalyzer(max_history=MAX_HISTORY)
fb_client = FirebaseClient(FIREBASE_KEY_PATH, FIREBASE_DB_URL)


def calculate_next_period(period_str: str) -> str:
    """Computes the incremental period ID, preserving leading zeroes and formatting."""
    try:
        return str(int(period_str) + 1)
    except ValueError:
        prefix = period_str[:-4]
        suffix = int(period_str[-4:]) + 1
        return f"{prefix}{suffix:04d}"

# ---------------------------------------------------------------------------
# 5. Telegram Bot Command Handlers & Notification Dispatcher
# ---------------------------------------------------------------------------
async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Registers chat ID and immediately renders current forecast."""
    chat_id = update.effective_chat.id
    state.subscribers.add(chat_id)
    fb_client.add_subscriber(chat_id)

    target = state.current_target_period or "Calculating..."
    pred = state.current_prediction or "Standby..."
    status = state.last_status

    welcome_msg = (
        "⚡ *WinGo 30S Automated Intelligence System*\n"
        "────────────────────────────\n"
        "You are subscribed to 24/7 automated game resolutions and forecasts.\n\n"
        f"• *Last Outcome Status:* `{status}`\n"
        f"• *Active Target Period:* `{target}`\n"
        f"• *Active Forecast:* *{pred}*\n"
        "────────────────────────────\n"
        "Commands: `/status` for live health check | `/stop` to unsubscribe"
    )
    await update.message.reply_text(welcome_msg, parse_mode="Markdown")
    logger.info(f"New user registered: {chat_id}")


async def cmd_stop(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Unsubscribes the user from notification broadcasts."""
    chat_id = update.effective_chat.id
    if chat_id in state.subscribers:
        state.subscribers.remove(chat_id)
    fb_client.remove_subscriber(chat_id)
    await update.message.reply_text("🔴 *Unsubscribed.* Notifications suspended.", parse_mode="Markdown")
    logger.info(f"User removed: {chat_id}")


async def cmd_status(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Displays telemetry, current predictions, and hit rates."""
    if not analyzer.history:
        await update.message.reply_text("⏳ Syncing historical data stream. Standby...")
        return

    latest = analyzer.history[0]
    total_samples = len(analyzer.history)
    big_hits = sum(1 for e in analyzer.history if e["classification"] == "BIG")
    small_hits = total_samples - big_hits

    status_msg = (
        "📈 *Operational Telemetry Monitor*\n"
        "────────────────────────────\n"
        f"• *Settled Round:* `{latest['period']}`\n"
        f"• *Result:* `{latest['number']}` ({latest['classification']} | {latest['color']})\n"
        f"• *Upcoming Target:* `{state.current_target_period}`\n"
        f"• *Forecast:* *{state.current_prediction}*\n"
        f"• *Window Depth:* `{total_samples}` rounds\n"
        f"• *Distribution:* BIG: `{big_hits}` | SMALL: `{small_hits}`\n"
        f"• *Active Subscribers:* `{len(state.subscribers)}`\n"
        "────────────────────────────"
    )
    await update.message.reply_text(status_msg, parse_mode="Markdown")


async def broadcast_round_cycle(
    bot_app: Application,
    settled_period: str,
    outcome_num: int,
    classification: str,
    color: str,
    status_flag: str,
    next_target: str,
    next_forecast: str
) -> None:
    """Transmits structured resolution and forecast notifications to all active chats."""
    status_icon = "✅ WIN" if status_flag == "WIN" else ("❌ LOSS" if status_flag == "LOSS" else "⚡ SYNC")
    forecast_icon = "🟢" if next_forecast == "BIG" else "🔵"

    message = (
        f"🔔 *Period: {settled_period}* | *Result: {classification} ({outcome_num})* | *Status: {status_icon}*\n"
        f"🎯 *Target Period: {next_target}* | *Prediction: {forecast_icon} {next_forecast}*"
    )

    prune_targets = set()
    for chat_id in list(state.subscribers):
        try:
            await bot_app.bot.send_message(chat_id=chat_id, text=message, parse_mode="Markdown")
            await asyncio.sleep(0.04)  # Safeguard for Telegram API rate limits (30 msg/s ceiling)
        except Forbidden:
            logger.warning(f"Subscriber {chat_id} blocked the bot. Pruning.")
            prune_targets.add(chat_id)
        except TelegramError as e:
            logger.warning(f"Broadcast failure to chat {chat_id}: {e}")

    for dead_id in prune_targets:
        state.subscribers.discard(dead_id)
        fb_client.remove_subscriber(dead_id)

# ---------------------------------------------------------------------------
# 6. Low-Latency Asynchronous Ingestion & Polling Engine
# ---------------------------------------------------------------------------
async def polling_engine(bot_app: Application, shutdown_signal: asyncio.Event) -> None:
    """Non-blocking polling daemon with exponential backoff on connection failure."""
    backoff = 1.0
    headers = {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Content-Type": "application/json;charset=UTF-8"
    }
    timeout_cfg = aiohttp.ClientTimeout(total=4.0)

    logger.info(f"Starting API Poller on {API_ENDPOINT} (Tick: {POLL_INTERVAL}s)")

    async with aiohttp.ClientSession(headers=headers, timeout=timeout_cfg) as session:
        while not shutdown_signal.is_set():
            try:
                payload = {"pageSize": 10, "pageNo": 1}
                async with session.post(API_ENDPOINT, json=payload) as resp:
                    if resp.status != 200:
                        raise aiohttp.ClientResponseError(
                            request_info=resp.request_info,
                            history=resp.history,
                            status=resp.status
                        )
                    
                    data = await resp.json()
                    backoff = 1.0  # Reset backoff upon successful reception

                    # Extract record list matching various platform response formats
                    records = []
                    if isinstance(data.get("data"), dict) and "list" in data["data"]:
                        records = data["data"]["list"]
                    elif isinstance(data.get("data"), list):
                        records = data["data"]

                    if records:
                        latest = records[0]
                        period = str(latest.get("issueNumber") or latest.get("period"))
                        open_num = int(latest.get("number") or latest.get("openNum"))

                        # Initial warm-up boot
                        if state.last_settled_period is None:
                            for record in reversed(records):
                                p = str(record.get("issueNumber") or record.get("period"))
                                n = int(record.get("number") or record.get("openNum"))
                                analyzer.add_round(p, n)

                            state.last_settled_period = period
                            state.current_target_period = calculate_next_period(period)
                            state.current_prediction = analyzer.predict_next(state.current_target_period)
                            state.last_status = "INIT"

                            fb_client.sync_live_state(
                                current_period=period,
                                target_period=state.current_target_period,
                                prediction=state.current_prediction,
                                last_status=state.last_status
                            )
                            logger.info(f"Cold boot complete at Period {period}. Next Target: {state.current_target_period} -> {state.current_prediction}")

                        # Trigger on newly concluded round
                        elif period != state.last_settled_period:
                            # 1. Evaluate prior outcome against settlement
                            status_flag = analyzer.evaluate_result(period, open_num)
                            analyzer.add_round(period, open_num)
                            classification, color = analyzer.classify_outcome(open_num)

                            # 2. Formulate immediate target and prediction
                            next_target = calculate_next_period(period)
                            next_forecast = analyzer.predict_next(next_target)

                            # 3. Synchronize global engine state
                            state.last_settled_period = period
                            state.current_target_period = next_target
                            state.current_prediction = next_forecast
                            state.last_status = status_flag

                            # 4. Simultaneous Firebase RTDB write
                            fb_client.sync_live_state(
                                current_period=period,
                                target_period=next_target,
                                prediction=next_forecast,
                                last_status=status_flag
                            )

                            # 5. Live broadcast dispatch
                            await broadcast_round_cycle(
                                bot_app=bot_app,
                                settled_period=period,
                                outcome_num=open_num,
                                classification=classification,
                                color=color,
                                status_flag=status_flag,
                                next_target=next_target,
                                next_forecast=next_forecast
                            )

                            logger.info(f"Resolved {period}: {open_num} ({classification}) -> {status_flag} | Target: {next_target} -> {next_forecast}")

            except (aiohttp.ClientError, asyncio.TimeoutError) as net_err:
                logger.warning(f"Network transport fault: {net_err}. Backing off {backoff:.1f}s")
                await asyncio.sleep(backoff)
                backoff = min(backoff * 1.5, 15.0)
            except Exception as unhandled:
                logger.error(f"Engine iteration error: {unhandled}", exc_info=True)
                await asyncio.sleep(1.0)

            await asyncio.sleep(POLL_INTERVAL)

# ---------------------------------------------------------------------------
# 7. Asynchronous Lifecycle Coordinator & Main Entry
# ---------------------------------------------------------------------------
async def main() -> None:
    # Hydrate subscribers from Firebase storage
    state.subscribers = fb_client.fetch_subscribers()
    logger.info(f"Restored {len(state.subscribers)} persistent subscribers from database.")

    # Initialize Telegram Application
    bot_app = ApplicationBuilder().token(BOT_TOKEN).build()
    bot_app.add_handler(CommandHandler("start", cmd_start))
    bot_app.add_handler(CommandHandler("stop", cmd_stop))
    bot_app.add_handler(CommandHandler("status", cmd_status))

    # Controlled shutdown event
    shutdown_event = asyncio.Event()

    def signal_handler():
        logger.info("Shutdown signal caught. Terminating engine services...")
        shutdown_event.set()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, signal_handler)
        except NotImplementedError:
            pass  # Windows execution fallback

    await bot_app.initialize()
    await bot_app.start()
    await bot_app.updater.start_polling(drop_pending_updates=True)
    logger.info("Telegram updates polling active.")

    # Launch non-blocking polling engine
    worker_task = asyncio.create_task(polling_engine(bot_app, shutdown_event))

    try:
        await shutdown_event.wait()
    finally:
        logger.info("Closing active worker threads and connections...")
        worker_task.cancel()
        await asyncio.gather(worker_task, return_exceptions=True)
        await bot_app.updater.stop()
        await bot_app.stop()
        await bot_app.shutdown()
        logger.info("System successfully halted.")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        pass
