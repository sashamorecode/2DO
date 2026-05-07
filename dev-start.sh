#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "==> Checking environment files..."
if [ ! -f "$ROOT/backend/.env" ]; then
  echo "    backend/.env not found — copying from .env.example"
  cp "$ROOT/backend/.env.example" "$ROOT/backend/.env"
else
  echo "    backend/.env OK"
fi

if [ ! -f "$ROOT/frontend/.env" ]; then
  echo "    frontend/.env not found — copying from .env.example"
  cp "$ROOT/frontend/.env.example" "$ROOT/frontend/.env"
else
  echo "    frontend/.env OK"
fi

echo ""
echo "==> Checking dependencies..."
command -v docker >/dev/null 2>&1 || { echo "    ERROR: docker not found. Install from https://docs.docker.com/get-docker/"; exit 1; }
echo "    docker OK"
command -v npx >/dev/null 2>&1 || { echo "    ERROR: npx not found. Install Node.js from https://nodejs.org"; exit 1; }
echo "    npx OK"

if [ ! -d "$ROOT/frontend/node_modules" ]; then
  echo ""
  echo "==> Installing frontend dependencies..."
  (cd "$ROOT/frontend" && npm install)
else
  echo "    node_modules OK"
fi

echo ""
echo "==> Starting PostgreSQL + backend via Docker Compose..."
docker compose -f "$ROOT/docker-compose.yml" up --build -d
echo "    Containers started."

echo ""
echo "==> Waiting for backend to be ready at http://localhost:8080/health ..."
ATTEMPTS=0
until curl -sf http://localhost:8080/health >/dev/null 2>&1; do
  ATTEMPTS=$((ATTEMPTS + 1))
  echo "    [attempt $ATTEMPTS] not ready yet — retrying in 2s..."
  sleep 2
done
echo "    Backend is up after $ATTEMPTS attempt(s)."

echo ""
echo "==> Starting Expo (frontend)..."
(cd "$ROOT/frontend" && npx expo start) &
FRONTEND_PID=$!
echo "    Expo PID: $FRONTEND_PID"

echo ""
echo "==> All services running."
echo "    Backend:  http://localhost:8080"
echo "    DB logs:  docker compose logs -f db"
echo "    API logs: docker compose logs -f backend"
echo "    Press Ctrl+C to stop frontend (run dev-stop.sh to tear down Docker services)."
echo ""

wait "$FRONTEND_PID"
