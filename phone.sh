#!/usr/bin/env bash
# Start backend, expose it via ngrok, point the frontend at the public URL,
# and launch Expo in tunnel mode so you can scan the QR with Expo Go.
#
# Notes:
#   - Email OTP works in Expo Go. Google Sign-In does NOT (native module).
#   - Requires: ngrok (authenticated), jq, curl, bun.
#   - Writes EXPO_PUBLIC_API_URL into frontend/.env.local; the existing
#     frontend/.env is left untouched so your Google client IDs survive.

set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$ROOT/frontend/.env.local"
NGROK_LOG="/tmp/ngrok-2do.log"
NGROK_PID=""

cleanup() {
  if [ -n "$NGROK_PID" ] && kill -0 "$NGROK_PID" 2>/dev/null; then
    echo
    echo "Stopping ngrok (pid $NGROK_PID)..."
    kill "$NGROK_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

require() {
  command -v "$1" >/dev/null 2>&1 || { echo "Missing dependency: $1"; exit 1; }
}
require ngrok
require jq
require curl
require bun

# 1. Backend stack
"$ROOT/backend.sh" start

# 2. ngrok tunnel — reuse if one is already running, else spawn
if curl -sf http://localhost:4040/api/tunnels >/dev/null 2>&1; then
  echo "ngrok already running on :4040 — reusing existing tunnel."
else
  echo "Starting ngrok http 9000..."
  ngrok http 9000 --log=stdout > "$NGROK_LOG" 2>&1 &
  NGROK_PID=$!
fi

# 3. Resolve the public https URL
URL=""
for _ in $(seq 1 30); do
  URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null \
    | jq -r '.tunnels[] | select(.proto=="https") | .public_url' \
    | head -n1)
  [ -n "$URL" ] && [ "$URL" != "null" ] && break
  sleep 1
done

if [ -z "$URL" ] || [ "$URL" = "null" ]; then
  echo "ngrok did not produce a public URL. Last log lines:"
  tail -n 20 "$NGROK_LOG" 2>/dev/null || true
  exit 1
fi

API_URL="$URL/api/v1"
echo "ngrok public URL: $URL"
echo "Setting EXPO_PUBLIC_API_URL=$API_URL in $ENV_FILE"

# 4. Update frontend/.env.local without clobbering other vars
touch "$ENV_FILE"
if grep -q '^EXPO_PUBLIC_API_URL=' "$ENV_FILE"; then
  sed -i "s|^EXPO_PUBLIC_API_URL=.*|EXPO_PUBLIC_API_URL=$API_URL|" "$ENV_FILE"
else
  printf 'EXPO_PUBLIC_API_URL=%s\n' "$API_URL" >> "$ENV_FILE"
fi

# 5. Start Expo on LAN. Phone must be on the same wifi as this machine.
#    (Free-tier ngrok only allows one tunnel, which we're using for the
#    backend, so we cannot also use `expo start --tunnel`.)
cd "$ROOT/frontend"
echo
echo "Starting Expo on LAN. Connect your phone to the same wifi as this"
echo "machine, then open Expo Go and scan the QR."
echo "(Email OTP will work; Google Sign-In requires a dev build.)"
exec bunx expo start --lan
