# WinGo 30S 24/7 Automated Lottery Analysis & Notification System

A complete 24/7 automated lottery analysis, multi-factor prediction, Firebase Realtime Database synchronizer, and Telegram notification bot engine.

## 🏗️ Architecture Overview

```
                  ┌──────────────────────────────────────────┐
                  │ WinGo 30S API (draw.ar-lottery01.com)    │
                  └─────────────────────┬────────────────────┘
                                        │ (Every 3-4s poll)
                                        ▼
             ┌─────────────────────────────────────────────────────┐
             │ Continuous Polling & Ingestion Worker (bot.py)      │
             │ - Sliding window history buffer                     │
             │ - Automatic Period Resolution & Target ID detection │
             │ - Exponential backoff & connection keep-alive       │
             └──────────┬───────────────────────────────┬──────────┘
                        │                               │
                        ▼                               ▼
       ┌────────────────────────────────┐ ┌────────────────────────────────┐
       │ Multi-Factor Pattern Engine    │ │ Firebase RTDB Sync Manager     │
       │ (analyzer.py)                  │ │ (firebase_sync.py)             │
       │ 1. Consecutive Dragon Streaks  │ │ Target Node:                   │
       │ 2. Markov State Transitions    │ │   /current_prediction          │
       │ 3. Digit Frequencies & Drift   │ │ Dual Support: REST API & Admin │
       │ 4. Parity Transition Dynamics  │ └────────────────────────────────┘
       └──────────────┬─────────────────┘
                      │
                      ▼
       ┌────────────────────────────────┐
       │ Telegram Notification Bot      │
       │ (@Fjjfjdjdjjf88484_bot)        │
       │ - Instant WIN/LOSS validation  │
       │ - High-impact next forecast    │
       │ - /start, /status, /stats      │
       └────────────────────────────────┘
```

---

## 📁 Project Structure

| File | Purpose |
|---|---|
| `bot.py` | Main 24/7 polling worker, Telegram bot commands, and broadcast dispatcher. |
| `analyzer.py` | Multi-factor trend analysis, streak evaluation, Markov state transitions, and deterministic BIG/SMALL outcome generator. |
| `firebase_sync.py` | Real-time Firebase RTDB synchronization to node `/current_prediction`. |
| `requirements.txt` | Python dependencies (`requests`, `python-telegram-bot`, `firebase-admin`, `python-dotenv`, `aiohttp`). |
| `.env` | Environment configuration externalizing all secrets and tokens. |
| `lottery-bot.service` | Linux Systemd service configuration for 24/7 background uptime on VPS/RDP. |
| `setup_vps.sh` | One-command automated installer for Linux VPS. |
| `server.ts` & `/src` | Interactive Web Operations Dashboard & Control Center (React + Express). |

---

## 🚀 Quick Start on Linux VPS / RDP (Ubuntu/Debian)

### 1. Upload files to your VPS
```bash
sudo mkdir -p /opt/wingo-bot
cd /opt/wingo-bot
# Copy project files here
```

### 2. Run the automated installer
```bash
chmod +x setup_vps.sh
sudo ./setup_vps.sh
```

### 3. Check live 24/7 logs
```bash
sudo journalctl -u lottery-bot.service -f
```

---

## ⚙️ Configuration (`.env`)

```ini
TELEGRAM_BOT_TOKEN="8955426078:AAFyefL1ul-qt6HtYhFOhuQVIW4_k47R7Pw"
FIREBASE_PROJECT_ID="gsgssnn-580ca"
FIREBASE_DATABASE_URL="https://gsgssnn-580ca-default-rtdb.firebaseio.com"
WINGO_API_URL="https://draw.ar-lottery01.com/WinGo/WinGo_30S/GetHistoryIssuePage.json"
POLL_INTERVAL_SECONDS=3.5
LOG_LEVEL="INFO"
```

---

## 🤖 Telegram Bot Commands

- `/start` - Subscribe to automated round resolutions and predictions.
- `/status` - View current period, active target forecast, and win rate.
- `/stats` - View total rounds analyzed, win/loss breakdown, and max streak record.
- `/predict` - On-demand forecast for the upcoming draw.
- `/unsubscribe` - Pause live notifications.

---

## 📡 Firebase RTDB Node Structure (`/current_prediction`)

```json
{
  "current_period": "20261002100051893",
  "target_period": "20261002100051894",
  "prediction": "BIG",
  "previous_status": "WIN",
  "confidence": 78,
  "win_rate": 65.5,
  "streak_count": 3,
  "last_updated": "2026-10-02T15:46:13.375Z",
  "timestamp_ms": 1790955973375
}
```
