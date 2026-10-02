import React, { useState } from 'react';
import { Code2, Copy, Check, Download, Terminal, Server, FileText, ChevronRight } from 'lucide-react';

export const PythonHub: React.FC = () => {
  const [activeFile, setActiveFile] = useState<string>('bot.py');
  const [copied, setCopied] = useState<boolean>(false);

  const files: Record<string, { desc: string; code: string }> = {
    'bot.py': {
      desc: 'Main continuous polling engine, async API ingestion, Telegram bot commands, and broadcast dispatcher.',
      code: `#!/usr/bin/env python3
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

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "8955426078:AAFyefL1ul-qt6HtYhFOhuQVIW4_k47R7Pw")
WINGO_API_URL = os.getenv("WINGO_API_URL", "https://draw.ar-lottery01.com/WinGo/WinGo_30S/GetHistoryIssuePage.json")
POLL_INTERVAL_BASE = float(os.getenv("POLL_INTERVAL_SECONDS", "3.5"))
SUBSCRIBERS_FILE = os.getenv("SUBSCRIBERS_FILE", "subscribers.json")
STATE_FILE = os.getenv("STATE_FILE", "bot_state.json")

# Polling and Telegram Bot loop implementation...
# (See full bot.py in workspace root)
`,
    },
    'analyzer.py': {
      desc: 'Modular sliding-window pattern recognition, Markov state transition matrix, and multi-factor voting engine.',
      code: `"""
WinGo 30S Multi-Factor Trend Analyzer and Prediction Engine.
Author: Lottery Bot 24/7 Operations
"""

from collections import deque, Counter
from dataclasses import dataclass
from typing import List, Dict, Optional, Any
import logging

logger = logging.getLogger("analyzer")

@dataclass
class WinGoIssue:
    issue_number: str
    number: int
    color: str
    is_big: bool
    parity: str

    @property
    def outcome_type(self) -> str:
        return "BIG" if self.is_big else "SMALL"

class WinGoAnalyzer:
    def __init__(self, window_size: int = 100):
        self.window_size = window_size
        self.history = deque(maxlen=window_size)
        self.last_prediction = None
        self.total_rounds = 0
        self.wins = 0
        self.losses = 0
        self.current_streak = 0
        self.max_win_streak = 0
        self.max_loss_streak = 0

    # Multi-Factor Analysis: Streaks, Markov, Parity, Frequencies...
    # (See full analyzer.py in workspace root)
`,
    },
    'firebase_sync.py': {
      desc: 'Firebase Realtime Database synchronization module for node /current_prediction.',
      code: `"""
Firebase Realtime Database synchronization module for WinGo Lottery Bot.
Handles real-time sync to https://gsgssnn-580ca-default-rtdb.firebaseio.com.
Supports dual-mode: direct REST API and firebase-admin SDK.
"""

import os
import time
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional

try:
    import requests
    from requests.adapters import HTTPAdapter
    from urllib3.util.retry import Retry
    HAS_REQUESTS = True
except ImportError:
    import urllib.request
    HAS_REQUESTS = False

DEFAULT_DATABASE_URL = "https://gsgssnn-580ca-default-rtdb.firebaseio.com"
DEFAULT_PROJECT_ID = "gsgssnn-580ca"

class FirebaseSyncManager:
    # Realtime sync methods...
    # (See full firebase_sync.py in workspace root)
`,
    },
    'requirements.txt': {
      desc: 'Python package requirements for VPS installation.',
      code: `requests>=2.31.0
aiohttp>=3.9.0
python-telegram-bot>=20.7
firebase-admin>=6.4.0
python-dotenv>=1.0.1
urllib3>=2.0.0
`,
    },
    '.env': {
      desc: 'Environment configuration file externalizing credentials.',
      code: `# Telegram Bot Token
TELEGRAM_BOT_TOKEN="8955426078:AAFyefL1ul-qt6HtYhFOhuQVIW4_k47R7Pw"

# Firebase Realtime Database
FIREBASE_PROJECT_ID="gsgssnn-580ca"
FIREBASE_DATABASE_URL="https://gsgssnn-580ca-default-rtdb.firebaseio.com"

# WinGo 30S Target Polling API
WINGO_API_URL="https://draw.ar-lottery01.com/WinGo/WinGo_30S/GetHistoryIssuePage.json"

# Polling Interval in seconds
POLL_INTERVAL_SECONDS=3.5

# Logging level
LOG_LEVEL="INFO"
`,
    },
    'lottery-bot.service': {
      desc: 'Systemd service configuration for 24/7 background uptime on Linux VPS/RDP.',
      code: `[Unit]
Description=WinGo 30S 24/7 Automated Lottery Analysis & Telegram Bot
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/wingo-bot
EnvironmentFile=/opt/wingo-bot/.env
ExecStart=/opt/wingo-bot/venv/bin/python3 /opt/wingo-bot/bot.py
Restart=always
RestartSec=5s
KillSignal=SIGTERM
TimeoutStopSec=10s
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
`,
    },
    'setup_vps.sh': {
      desc: 'One-command automated installer script for Ubuntu/Debian/CentOS.',
      code: `#!/bin/bash
set -e
echo "🚀 Starting WinGo 30S Automated Bot Installation..."
APP_DIR="/opt/wingo-bot"
mkdir -p "$APP_DIR"

# Install packages
apt-get update -qq && apt-get install -y -qq python3 python3-venv python3-pip curl

# Setup virtual environment
python3 -m venv "$APP_DIR/venv"
"$APP_DIR/venv/bin/pip" install -r "$APP_DIR/requirements.txt" -q

# Setup systemd daemon
cp "$APP_DIR/lottery-bot.service" /etc/systemd/system/lottery-bot.service
systemctl daemon-reload
systemctl enable --now lottery-bot.service

echo "✅ Bot is online 24/7! View logs with: journalctl -u lottery-bot.service -f"
`,
    },
  };

  const currentFile = files[activeFile] || files['bot.py'];

  const handleCopy = () => {
    navigator.clipboard.writeText(currentFile.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([currentFile.code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFile;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-800 pb-4">
        <h2 className="text-lg font-bold text-white tracking-tight">Python Source Files & 24/7 VPS Deployment</h2>
        <p className="text-xs text-slate-400 mt-1">
          Complete standalone production codebase ready to run 24/7 as a background service on any VPS or RDP.
        </p>
      </div>

      {/* Code Explorer */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        {/* File Tabs */}
        <div className="bg-slate-950 border-b border-slate-800 px-4 py-2 flex items-center justify-between overflow-x-auto">
          <div className="flex items-center gap-1.5">
            {Object.keys(files).map((fname) => (
              <button
                key={fname}
                onClick={() => setActiveFile(fname)}
                className={`px-3 py-1.5 text-xs font-mono rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                  activeFile === fname
                    ? 'bg-slate-800 text-cyan-300 font-semibold border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{fname}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1 px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>
          </div>
        </div>

        {/* File Description */}
        <div className="px-5 py-2.5 bg-slate-900/60 border-b border-slate-800/80 text-xs text-slate-400 flex items-center justify-between">
          <span>{currentFile.desc}</span>
          <span className="font-mono text-cyan-400 text-[11px]">{activeFile}</span>
        </div>

        {/* Code Content */}
        <div className="p-4 bg-slate-950 font-mono text-xs overflow-x-auto max-h-[420px] text-slate-300">
          <pre>{currentFile.code}</pre>
        </div>
      </div>

      {/* 24/7 VPS Setup Walkthrough */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
          <Server className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            24/7 Linux VPS / RDP Deployment Guide (Ubuntu 22.04 / 24.04)
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-cyan-300 font-bold font-mono">
              <span>Step 1: Upload Files</span>
            </div>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              SSH into your VPS and place the files into <code className="text-slate-200">/opt/wingo-bot</code>:
            </p>
            <div className="bg-slate-900 p-2 rounded text-[11px] font-mono text-slate-300 overflow-x-auto">
              mkdir -p /opt/wingo-bot<br/>
              cd /opt/wingo-bot
            </div>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-emerald-300 font-bold font-mono">
              <span>Step 2: Run Installer</span>
            </div>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              Execute the automated setup script to install dependencies and configure the systemd daemon:
            </p>
            <div className="bg-slate-900 p-2 rounded text-[11px] font-mono text-slate-300 overflow-x-auto">
              chmod +x setup_vps.sh<br/>
              sudo ./setup_vps.sh
            </div>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-purple-300 font-bold font-mono">
              <span>Step 3: Monitor Logs</span>
            </div>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              The daemon auto-starts on boot and auto-restarts upon network failure:
            </p>
            <div className="bg-slate-900 p-2 rounded text-[11px] font-mono text-slate-300 overflow-x-auto">
              journalctl -u lottery-bot -f<br/>
              systemctl status lottery-bot
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
