#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/2do}"
COMPOSE_FILE="$APP_DIR/docker-compose.prod.yml"

run_root() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  else
    sudo "$@"
  fi
}

require_file() {
  if [ ! -f "$1" ]; then
    echo "Required file not found: $1"
    exit 1
  fi
}

install_docker() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    return
  fi

  if ! command -v apt-get >/dev/null 2>&1; then
    echo "Automatic Docker installation currently supports Debian/Ubuntu hosts only."
    exit 1
  fi

  run_root apt-get update
  run_root apt-get install -y ca-certificates curl gnupg
  run_root install -m 0755 -d /etc/apt/keyrings

  . /etc/os-release

  if [ ! -f /etc/apt/keyrings/docker.asc ]; then
    curl -fsSL "https://download.docker.com/linux/${ID}/gpg" | run_root gpg --dearmor -o /etc/apt/keyrings/docker.asc
    run_root chmod a+r /etc/apt/keyrings/docker.asc
  fi

  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/${ID} ${VERSION_CODENAME} stable" \
    | run_root tee /etc/apt/sources.list.d/docker.list >/dev/null

  run_root apt-get update
  run_root apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
}

wait_for_backend() {
  local attempts=0

  until run_root docker compose -f "$COMPOSE_FILE" exec -T backend wget -qO- http://127.0.0.1:9000/health >/dev/null 2>&1; do
    attempts=$((attempts + 1))
    if [ "$attempts" -ge 30 ]; then
      echo "Backend did not become healthy after $attempts attempts."
      run_root docker compose -f "$COMPOSE_FILE" ps
      exit 1
    fi
    sleep 2
  done

  echo "Backend is healthy."
}

install_docker

require_file "$COMPOSE_FILE"
require_file "$APP_DIR/deploy/Caddyfile"
require_file "$APP_DIR/.env"

run_root chmod 600 "$APP_DIR/.env"
run_root mkdir -p "$APP_DIR"

cd "$APP_DIR"
run_root docker compose -f "$COMPOSE_FILE" up -d --build --remove-orphans
wait_for_backend

echo "Deployment complete. Ensure DNS for ${APP_DOMAIN:-2do.sashasalzanoweir.com} points to this host and ports 80/443 are open."