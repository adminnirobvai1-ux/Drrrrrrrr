#!/bin/bash
# ==============================================================================
# WinGo 30S Automated Lottery Bot - 24/7 VPS/RDP Auto-Installer
# ==============================================================================
set -e

echo "🚀 Starting WinGo 30S Automated Bot Installation..."

APP_DIR="/opt/wingo-bot"
mkdir -p "$APP_DIR"

# 1. Update packages and install python3, venv, and git
echo "📦 Installing system dependencies..."
if command -v apt-get &> /dev/null; then
    apt-get update -qq
    apt-get install -y -qq python3 python3-venv python3-pip curl
elif command -v yum &> /dev/null; then
    yum install -y python3 python3-pip curl
fi

# 2. Setup Virtual Environment
echo "🐍 Initializing Python virtual environment..."
python3 -m venv "$APP_DIR/venv"
source "$APP_DIR/venv/bin/activate"

# 3. Copy application files if not running directly inside target dir
CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ "$CURRENT_DIR" != "$APP_DIR" ]; then
    echo "📂 Copying files to $APP_DIR..."
    cp -r "$CURRENT_DIR"/* "$APP_DIR"/
fi

# 4. Install Python requirements
echo "📥 Installing required Python libraries..."
"$APP_DIR/venv/bin/pip" install --upgrade pip -q
"$APP_DIR/venv/bin/pip" install -r "$APP_DIR/requirements.txt" -q

# 5. Setup Systemd Service
echo "⚙️ Configuring systemd daemon for 24/7 background operation..."
cp "$APP_DIR/lottery-bot.service" /etc/systemd/system/lottery-bot.service
systemctl daemon-reload
systemctl enable lottery-bot.service
systemctl restart lottery-bot.service

echo "✅ WinGo Bot successfully installed and started as a systemd service!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Service Status:"
systemctl status lottery-bot.service --no-pager
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 To view live 24/7 logs: journalctl -u lottery-bot.service -f"
echo "🛑 To stop: systemctl stop lottery-bot.service"
echo "▶️ To restart: systemctl restart lottery-bot.service"
