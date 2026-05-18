#!/usr/bin/env bash
# inkboard uninstall — clears all plugin caches so a fresh `/plugin install`
# pulls the current published version. Safe to run multiple times.
#
# Usage:
#   bash <(curl -fsSL https://raw.githubusercontent.com/junzhin/inkboard/main/scripts/uninstall.sh)
#   bash scripts/uninstall.sh   # from a local clone

set -u

echo "[inkboard] uninstall: clearing plugin caches and runtime state"

# Stop running server (if any).
if [ -f /tmp/inkboard.pid ]; then
  pid=$(cat /tmp/inkboard.pid 2>/dev/null || true)
  if [ -n "${pid:-}" ] && kill -0 "$pid" 2>/dev/null; then
    echo "[inkboard]   stopping server pid=$pid"
    kill "$pid" 2>/dev/null || true
    sleep 0.5
    kill -9 "$pid" 2>/dev/null || true
  fi
fi

# Runtime artifacts.
rm -rf /tmp/inkboard.pid /tmp/inkboard.port /tmp/inkboard-*.log /tmp/inkboard-start.lock

# Claude Code plugin surfaces — marketplace clone, install cache, installed copy.
for path in \
  "$HOME/.claude/plugins/marketplaces/inkboard" \
  "$HOME/.claude/plugins/cache/inkboard" \
  "$HOME/.claude/plugins/installed/inkboard"
do
  if [ -e "$path" ] || ls -d "$path"* >/dev/null 2>&1; then
    echo "[inkboard]   rm $path*"
    rm -rf "$path" "$path"* 2>/dev/null || true
  fi
done

# User config is preserved by default. Pass --purge to remove it too.
if [ "${1:-}" = "--purge" ]; then
  echo "[inkboard]   rm $HOME/.config/inkboard (user config)"
  rm -rf "$HOME/.config/inkboard"
fi

echo "[inkboard] done. Next steps in Claude Code:"
echo "  /plugin marketplace remove inkboard      # ignore if already gone"
echo "  /plugin marketplace add junzhin/inkboard"
echo "  /plugin install inkboard@inkboard"
