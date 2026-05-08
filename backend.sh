#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
COMPOSE="docker compose -f $ROOT/docker-compose.yml"

usage() {
  cat <<EOF
Usage: $0 <command>

Commands:
  start                Bring up db + backend (builds if needed) and wait for /health.
  redeploy [--reset]   Rebuild backend image and restart the backend container.
                       --reset also wipes the postgres volume (destroys all data).
  kill                 Stop and remove db + backend containers.
EOF
}

ensure_env() {
  if [ ! -f "$ROOT/backend/.env" ]; then
    echo "backend/.env not found — copying from .env.example"
    cp "$ROOT/backend/.env.example" "$ROOT/backend/.env"
  fi
}

wait_for_health() {
  echo "Waiting for backend at http://localhost:9000/health ..."
  local attempts=0
  until curl -sf http://localhost:9000/health >/dev/null 2>&1; do
    attempts=$((attempts + 1))
    if [ "$attempts" -ge 60 ]; then
      echo "Backend did not become healthy after $attempts attempts."
      echo "Check logs: $COMPOSE logs backend"
      exit 1
    fi
    sleep 2
  done
  echo "Backend is up."
}

cmd_start() {
  command -v docker >/dev/null 2>&1 || { echo "docker not found"; exit 1; }
  ensure_env
  echo "Starting db + backend..."
  $COMPOSE up --build -d
  wait_for_health
}

cmd_redeploy() {
  if [ "${1:-}" = "--reset" ]; then
    echo "Tearing down (including pgdata volume)..."
    $COMPOSE down -v
    ensure_env
    echo "Rebuilding and starting fresh..."
    $COMPOSE up --build -d
  else
    ensure_env
    echo "Rebuilding backend image..."
    $COMPOSE build backend
    echo "Restarting backend..."
    $COMPOSE up -d --no-deps backend
  fi
  wait_for_health
}

cmd_kill() {
  echo "Stopping db + backend..."
  $COMPOSE down
  echo "Done."
}

case "${1:-}" in
  start)    shift; cmd_start "$@" ;;
  redeploy) shift; cmd_redeploy "$@" ;;
  kill)     shift; cmd_kill "$@" ;;
  ""|-h|--help) usage ;;
  *) echo "Unknown command: $1"; echo; usage; exit 1 ;;
esac
