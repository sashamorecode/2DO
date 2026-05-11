# 2Do

An ADHD-friendly todo app with social peer-pressure mechanics. Complete tasks, see your friends activity, and get deadline reminders via push notifications.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React Native (Expo ~55), Expo Router, Zustand, React Query, TypeScript |
| Backend | Go 1.26, Gin, GORM |
| Database | PostgreSQL 16 |
| Auth | Google Sign-In + email OTP, JWT-backed sessions |
| Push Notifications | Expo Push (via `expo-notifications`) |
| Dev infra | Docker Compose |

---

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (includes Docker Compose)
- [Node.js 18+](https://nodejs.org) (for the Expo frontend)
- An iOS/Android simulator or a physical device with an **Expo dev client** build
  (Expo Go is not supported — `@react-native-google-signin/google-signin` is a
  native module and requires a custom dev client built via EAS or `expo prebuild`)
- A [Google Cloud](https://console.cloud.google.com) project with OAuth 2.0 client IDs
- A [Resend](https://resend.com) account for sending email sign-in codes

No local Go or PostgreSQL installation required — both run in Docker.

---

## Quick Start

```bash
# 1. Clone
git clone <repo-url>
cd 2Do

# 2. Set up env files (one-time — backend.sh does this automatically for the backend)
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 3. Edit backend/.env — change JWT_SECRET at minimum
#    DATABASE_URL is overridden by docker-compose to point at the db container,
#    so you don't need to change it for local dev.

# 4. (Physical device only) Set your LAN IP in frontend/.env:
#    EXPO_PUBLIC_API_URL=http://192.168.x.x:8080/api/v1

# 5. Start the backend (db + Go API in Docker)
./backend.sh start

# 6. In another terminal, start Expo
cd frontend && npx expo start --port 9081
```

`backend.sh`:
- `start` — auto-copies `.env.example` → `.env` if missing, builds + starts db + backend, waits for `/health`
- `redeploy` — rebuilds and restarts the backend container (db + pgdata untouched)
- `redeploy --reset` — same as redeploy but also wipes the postgres volume
- `kill` — stops and removes db + backend containers

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
| `GOOGLE_CLIENT_IDS` | _(empty)_ | Comma-separated list of allowed OAuth 2.0 client IDs (iOS, Android, Web) used to verify Google ID tokens |
| `RESEND_API_KEY` | _(empty)_ | Resend API key for sending OTP emails |
| `EMAIL_FROM` | `2Do <onboarding@resend.dev>` | "From" address on OTP emails. Use Resend's sandbox sender for dev; switch to a verified domain for prod |

### `frontend/.env`

| Variable | Default | Description |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | `http://localhost:8080/api/v1` | Backend URL the app hits |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | _(empty)_ | iOS OAuth client ID from Google Cloud |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | _(empty)_ | Web OAuth client ID — `@react-native-google-signin` uses this to request the ID token |

> On a **physical device**, `localhost` won't resolve to your machine. Use your LAN IP:
> `EXPO_PUBLIC_API_URL=http://192.168.x.x:8080/api/v1`

---

## Project Structure

```
2Do/
├── backend.sh               # start | redeploy [--reset] | kill the backend stack
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
    │   ├── (auth)/          # Login, OTP entry, onboarding (pick username)
    │   └── (app)/           # Main screens (todos, social, friends feed, profile)
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

**Stop containers:**
```bash
./backend.sh kill
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

## Android APK Releases

The repo includes a GitHub Actions workflow at `.github/workflows/android-apk-release.yml` that builds the Android release APK and publishes it to GitHub Releases.

- Push a tag like `v1.0.0` to trigger an automatic build and release.
- Or run the workflow manually from the Actions tab and provide a release tag.
- Each run also uploads the APK as a workflow artifact, even before you download it from the GitHub Release page.

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

## Authentication Setup

The app supports two sign-in methods: **Google Sign-In** and **email OTP** (a 6-digit
code sent to the user's email). There is no password auth. Sessions are long-lived
JWTs (~10 years) stored in the device's encrypted SecureStore — users stay signed in
until they tap "Log Out".

### 1. Google Cloud OAuth Clients

Create OAuth 2.0 client IDs in
[Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials):

- **iOS** client ID — set the iOS bundle identifier to `com.twodo.adhd`
- **Android** client ID — set package name `com.twodo.adhd` and add your debug + release SHA-1 fingerprints
- **Web** client ID — no origins needed; this is what the React Native SDK uses to mint ID tokens

Then:

- Backend: put **all three** client IDs in `GOOGLE_CLIENT_IDS` (comma-separated)
- Frontend: put the **iOS** ID in `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` and the **Web** ID in `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
- `frontend/app.json`: replace `REPLACE_WITH_REVERSED_IOS_CLIENT_ID` in the
  `@react-native-google-signin/google-signin` plugin entry with your iOS client ID
  reversed (Google Cloud shows this as the iOS URL scheme — e.g.
  `123-abc.apps.googleusercontent.com` → `com.googleusercontent.apps.123-abc`)

### 2. Resend (email OTP)

1. Create an account at [resend.com](https://resend.com) and copy the API key
2. Set `RESEND_API_KEY` in `backend/.env`
3. For dev, leave `EMAIL_FROM=2Do <onboarding@resend.dev>` (Resend's sandbox sender)
4. For prod, verify your domain in Resend and set `EMAIL_FROM` to an address on it

Rate limits: each email may request a new code at most once per 60 seconds and 5 times per hour.

### 3. Build a dev client (one-time)

Because Google Sign-In is a native module, you can't use Expo Go. Build a custom dev client:

```bash
cd frontend
npx expo prebuild       # generates ios/ and android/ folders
npx expo run:ios        # or run:android — installs a dev client to your sim/device
```

After that, `npx expo start` will connect to the dev client instead of Expo Go.

---

## Push Notifications (Optional)

Uses [Expo Push Notification Service](https://docs.expo.dev/push-notifications/overview/).

1. Get an access token from your [Expo account dashboard](https://expo.dev/accounts).
2. Set `EXPO_ACCESS_TOKEN` in `backend/.env`.
3. The background worker checks for overdue todos every `WORKER_INTERVAL_MINUTES` and pushes reminders.

Leaving `EXPO_ACCESS_TOKEN` empty disables push notifications without breaking anything else.
