# 2Do

An ADHD-friendly todo app with social peer-pressure mechanics. Complete tasks, see your friends' activity, and get deadline reminders via push notifications.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React Native (Expo ~55), Expo Router, Zustand, React Query, TypeScript |
| Backend | Go 1.26, Gin, GORM |
| Database | PostgreSQL 16 |
| Auth | JWT |
| Push Notifications | Expo Push (via `expo-notifications`) |
| Dev infra | Docker Compose |

---

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (includes Docker Compose)
- [Node.js 18+](https://nodejs.org) (for the Expo frontend)
- [Expo Go](https://expo.dev/go) on your phone, or an iOS/Android simulator

No local Go or PostgreSQL installation required — both run in Docker.

---

## Quick Start

```bash
# 1. Clone
git clone <repo-url>
cd 2Do

# 2. Set up env files (one-time — dev.sh does this automatically too)
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 3. Edit backend/.env — change JWT_SECRET at minimum
#    DATABASE_URL is overridden by docker-compose to point at the db container,
#    so you don't need to change it for local dev.

# 4. (Physical device only) Set your LAN IP in frontend/.env:
#    EXPO_PUBLIC_API_URL=http://192.168.x.x:8080/api/v1

# 5. Start everything
./dev.sh
```

`dev.sh`:
- Auto-copies `.env.example` → `.env` if missing
- Starts **PostgreSQL + Go backend** via Docker Compose (detached)
- Installs `frontend/node_modules` if missing
- Starts **Expo** on the host (needed for LAN QR code scanning)
- Ctrl+C stops Expo and runs `docker compose down`

---

## Environment Variables

### `backend/.env`

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgres://postgres:postgres@localhost:5432/twodo?sslmode=disable` | Overridden by Compose to use the `db` container |
| `JWT_SECRET` | `change-me-in-production` | **Change this** |
| `PORT` | `8080` | Port the Go server listens on |
| `WORKER_INTERVAL_MINUTES` | `5` | How often the deadline checker worker runs |
| `EXPO_ACCESS_TOKEN` | _(empty)_ | Expo push token — optional for local dev |

### `frontend/.env`

| Variable | Default | Description |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | `http://localhost:8080/api/v1` | Backend URL the app hits |

> On a **physical device**, `localhost` won't resolve to your machine. Use your LAN IP:
> `EXPO_PUBLIC_API_URL=http://192.168.x.x:8080/api/v1`

---

## Project Structure

```
2Do/
├── dev.sh                   # Start full stack for local dev
├── docker-compose.yml       # PostgreSQL + backend containers
├── backend/
│   ├── cmd/server/main.go   # Entry point
│   ├── internal/
│   │   ├── config/          # Env loading
│   │   ├── db/              # PostgreSQL connection + AutoMigrate
│   │   ├── handlers/        # HTTP handlers (auth, todos, friends, feed, user)
│   │   ├── middleware/       # JWT auth, CORS
│   │   ├── models/          # GORM models (User, Todo, Friendship, NotificationLog)
│   │   ├── router/          # Route registration
│   │   ├── services/        # Expo Push notification service
│   │   └── worker/          # Background deadline checker + scheduler
│   ├── .env.example
│   ├── Dockerfile           # Production image
│   ├── Dockerfile.dev       # Dev image (go run, source-mounted)
│   └── go.mod
└── frontend/
    ├── app/
    │   ├── (auth)/          # Login & register screens
    │   └── (app)/           # Main screens (todos, social, friends feed)
    ├── constants/           # Colors, priorities, API URL
    ├── hooks/               # useNotifications
    ├── services/            # Axios API clients (auth, todos, friends, feed)
    ├── store/               # Zustand auth store
    ├── .env.example
    └── package.json
```

---

## Useful Commands

**View backend + DB logs:**
```bash
docker compose logs -f
docker compose logs -f backend
docker compose logs -f db
```

**Stop containers (without Ctrl+C in dev.sh):**
```bash
docker compose down
```

**Reset the database (wipes all data):**
```bash
docker compose down -v   # -v removes the pgdata volume
docker compose up -d db
```

**Rebuild the backend image after go.mod changes:**
```bash
docker compose build backend
```

**Run Expo for a specific platform:**
```bash
cd frontend
npx expo start --android   # or --ios
```

---

## Database

GORM runs `AutoMigrate` on every backend startup — no manual migration step needed. The PostgreSQL data is persisted in a Docker named volume (`pgdata`) so it survives container restarts.

---

## Deploying to a VPS

The production Dockerfile at `backend/Dockerfile` builds a minimal Alpine image.

Suggested VPS setup:
1. Install Docker on the VPS
2. Copy `.env` files with production secrets (`JWT_SECRET`, real `DATABASE_URL`, `EXPO_ACCESS_TOKEN`)
3. Point `DATABASE_URL` at your production Postgres instance (or add a `db` service to a production compose file)
4. Build and run:
   ```bash
   docker build -t 2do-backend ./backend
   docker run -d -p 8080:8080 --env-file backend/.env 2do-backend
   ```
5. Put Nginx or Caddy in front for TLS

---

## Push Notifications (Optional)

Uses [Expo Push Notification Service](https://docs.expo.dev/push-notifications/overview/).

1. Get an access token from your [Expo account dashboard](https://expo.dev/accounts).
2. Set `EXPO_ACCESS_TOKEN` in `backend/.env`.
3. The background worker checks for overdue todos every `WORKER_INTERVAL_MINUTES` and pushes reminders.

Leaving `EXPO_ACCESS_TOKEN` empty disables push notifications without breaking anything else.
