#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SERVER_DIR="$PROJECT_DIR/server"
WEB_DIR="$PROJECT_DIR/web"
HOOKS_DIR="$SERVER_DIR/dist/hooks"
CLAUDE_SETTINGS_DIR="$PROJECT_DIR/.claude"
CLAUDE_SETTINGS_FILE="$CLAUDE_SETTINGS_DIR/settings.local.json"

echo "[inkboard] Installing InkBoard..."
echo ""

# 1. Install dependencies
echo "[inkboard] Installing server dependencies..."
(cd "$SERVER_DIR" && npm install --production)

if [ -f "$WEB_DIR/package.json" ]; then
  echo "[inkboard] Installing web dependencies..."
  (cd "$WEB_DIR" && npm install)
fi

# 2. Build
echo "[inkboard] Building server..."
(cd "$SERVER_DIR" && npx tsc)

if [ -f "$WEB_DIR/package.json" ]; then
  echo "[inkboard] Building web UI..."
  (cd "$WEB_DIR" && npm run build)
fi

# 3. Generate Claude Code hooks configuration
echo "[inkboard] Configuring Claude Code hooks..."
mkdir -p "$CLAUDE_SETTINGS_DIR"

cat > "$CLAUDE_SETTINGS_FILE" << EOF
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "AskUserQuestion",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$HOOKS_DIR/question-hook.js\" 2>/dev/null || true",
            "timeout": 120000
          }
        ]
      }
    ],
    "PermissionRequest": [
      {
        "matcher": "ExitPlanMode",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$HOOKS_DIR/plan-review-hook.js\" 2>/dev/null || true",
            "timeout": 345600000
          }
        ]
      }
    ]
  }
}
EOF

echo ""
echo "[inkboard] Installation complete!"
echo ""
echo "  Hooks configured at: $CLAUDE_SETTINGS_FILE"
echo "  Server hooks at:     $HOOKS_DIR"
echo ""
echo "  To start:  bash $SCRIPT_DIR/start.sh"
echo "  To stop:   bash $SCRIPT_DIR/stop.sh"
echo ""
echo "  Settings (hooks/hooks.json):"
echo "    questionRoutingEnabled: false (default — questions stay in terminal)"
echo "    Toggle ON in the web UI to route questions to canvas"
echo ""
