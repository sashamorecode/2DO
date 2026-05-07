#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "==> Stopping Docker Compose services..."
docker compose -f "$ROOT/docker-compose.yml" down
echo "    Containers stopped and removed."

echo ""
echo "==> Checking for leftover Expo processes..."
EXPO_PIDS=$(pgrep -f "npx expo start" 2>/dev/null || true)
if [ -n "$EXPO_PIDS" ]; then
  echo "    Killing Expo PIDs: $EXPO_PIDS"
  kill $EXPO_PIDS 2>/dev/null || true
else
  echo "    No Expo processes found."
fi

echo ""
echo "==> Done. All dev services stopped."
