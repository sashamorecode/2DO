#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

# ── env checks ────────────────────────────────────────────────────────────────

if [ ! -f "$ROOT/backend/.env" ]; then
  echo "backend/.env not found — copying from .env.example"
  cp "$ROOT/backend/.env.example" "$ROOT/backend/.env"
fi

if [ ! -f "$ROOT/frontend/.env" ]; then
  echo "frontend/.env not found — copying from .env.example"
  cp "$ROOT/frontend/.env.example" "$ROOT/frontend/.env"
fi

# ── dependency checks ─────────────────────────────────────────────────────────

command -v docker  >/dev/null 2>&1 || { echo "docker not found. Install from https://docs.docker.com/get-docker/"; exit 1; }
command -v npx     >/dev/null 2>&1 || { echo "npx not found. Install Node.js from https://nodejs.org"; exit 1; }

if [ ! -d "$ROOT/frontend/node_modules" ]; then
  echo "Installing frontend dependencies..."
  (cd "$ROOT/frontend" && npm install)
fi

# ── start ─────────────────────────────────────────────────────────────────────

cleanup() {
  echo ""
  echo "Stopping services..."
  kill "$FRONTEND_PID" 2>/dev/null || true
  wait "$FRONTEND_PID" 2>/dev/null || true
  docker compose -f "$ROOT/docker-compose.yml" down
}
trap cleanup INT TERM

echo "Starting PostgreSQL + backend via Docker Compose..."
docker compose -f "$ROOT/docker-compose.yml" up --build -d

echo "Waiting for backend to be ready..."
until curl -sf http://localhost:8080/health >/dev/null 2>&1 || \
      docker compose -f "$ROOT/docker-compose.yml" ps backend | grep -q "running"; do
  sleep 1
done
echo "Backend is up."

echo "Starting Expo (frontend)..."
(cd "$ROOT/frontend" && npx expo start) &
FRONTEND_PID=$!

echo ""
echo "Frontend PID: $FRONTEND_PID"
echo "Logs: docker compose logs -f"
echo "Press Ctrl+C to stop everything."

wait "$FRONTEND_PID"
