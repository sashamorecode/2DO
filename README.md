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

# 4. For local frontend development, override frontend/.env away from the
#    production API default and point it at your local backend or LAN IP:
#    EXPO_PUBLIC_API_URL=http://192.168.x.x:9000/api/v1

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
| `PORT` | `9000` | Port the Go server listens on |
| `WORKER_INTERVAL_MINUTES` | `5` | How often the deadline checker worker runs |
| `EXPO_ACCESS_TOKEN` | _(empty)_ | Expo push token — optional for local dev |
| `GOOGLE_CLIENT_IDS` | _(empty)_ | Comma-separated list of allowed OAuth 2.0 client IDs (iOS, Android, Web) used to verify Google ID tokens |
| `RESEND_API_KEY` | _(empty)_ | Resend API key for sending OTP emails |
| `EMAIL_FROM` | `2Do <onboarding@resend.dev>` | "From" address on OTP emails. Use Resend's sandbox sender for dev; switch to a verified domain for prod |

### `frontend/.env`

| Variable | Default | Description |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | `https://2do.sashasalzanoweir.com/api/v1` | Backend URL the app hits |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | _(empty)_ | iOS OAuth client ID from Google Cloud |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | _(empty)_ | Web OAuth client ID — `@react-native-google-signin` uses this to request the ID token |

> For local development, override this back to your machine or LAN IP:
> `EXPO_PUBLIC_API_URL=http://192.168.x.x:9000/api/v1`

## Production Backend Deploy

The backend now deploys to `https://2do.sashasalzanoweir.com` via [`.github/workflows/deploy-backend.yml`](.github/workflows/deploy-backend.yml). The workflow uploads `backend/`, `deploy/`, and `docker-compose.prod.yml` to `/opt/2do`, writes `/opt/2do/.env` from a GitHub secret, then runs [deploy/setup-vps.sh](/home/sasha/Projects/2DO/deploy/setup-vps.sh) to install Docker if needed and start the production stack. Caddy is built with the IONOS DNS plugin so TLS can be issued with the DNS-01 challenge instead of relying on public HTTP validation.

Required GitHub repository secrets:

- `VPS_SSH_USER` — SSH user for `2do.sashasalzanoweir.com` (root or passwordless-sudo user)
- `VPS_SSH_PRIVATE_KEY` — private key for that SSH user
- `PROD_ENV_FILE_B64` — base64-encoded contents of `deploy/.env.example` after filling in real production values

Production backend env expectations:

- `APP_DOMAIN` should stay `2do.sashasalzanoweir.com` unless you move hosts
- `IONOS_AUTH_API_TOKEN` should be the IONOS DNS API token in `publicPrefix.secret` format so Caddy can create `_acme-challenge` TXT records
- `GOOGLE_CLIENT_IDS` should include every Google OAuth client ID you accept in production
- `PORT` should remain `9000`; Caddy handles public `80/443`

First-time server requirements:

- DNS for `2do.sashasalzanoweir.com` must point at the VPS
- Ports `80` and `443` must be open so Caddy can issue TLS certs
- The SSH user must be able to install packages and manage Docker

To prepare `PROD_ENV_FILE_B64`, fill in `deploy/.env.example` locally and encode it:

```bash
base64 -w0 deploy/.env.example
```

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
- Release builds require a real production signing key; the workflow no longer falls back to the debug keystore.

Required GitHub repository secrets for signed APK releases:

- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` — the Web OAuth client ID used by Android Google Sign-In
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` — optional for the Android workflow, but useful to keep frontend envs consistent
- `ANDROID_SIGNING_STORE_FILE_B64` — base64-encoded release keystore file
- `ANDROID_SIGNING_STORE_PASSWORD` — release keystore password
- `ANDROID_SIGNING_KEY_ALIAS` — alias inside the release keystore
- `ANDROID_SIGNING_KEY_PASSWORD` — password for that alias

Local release builds use the same environment variable names as the workflow:

```bash
export ANDROID_SIGNING_STORE_FILE=/absolute/path/to/release.keystore
export ANDROID_SIGNING_STORE_PASSWORD=...
export ANDROID_SIGNING_KEY_ALIAS=...
export ANDROID_SIGNING_KEY_PASSWORD=...

cd frontend
npm run prepare:android
cd frontend/android
./gradlew assembleRelease
```

If `frontend/android` gets regenerated by `expo prebuild`, rerun `npm run prepare:android` before building.

To prepare the keystore secret value for GitHub Actions:

```bash
base64 -w0 path/to/release.keystore
```

---

## Database

GORM runs `AutoMigrate` on every backend startup — no manual migration step needed. The PostgreSQL data is persisted in a Docker named volume (`pgdata`) so it survives container restarts.

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
