# TTLeave — Services & Ports

The stack is split across two Docker Compose files. All services share the `ttleave_shared` Docker bridge network and communicate by container name. Only the ports listed as **host-bound** are reachable from outside Docker.

## Compose file membership

| Service | Compose file |
|---|---|
| `app` (Next.js) | `docker-compose.yaml` |
| `nlp` (BERT sidecar) | `docker-compose.yaml` |
| `db` (PostgreSQL) | `docker-compose.supabase.yaml` |
| `migrate` | `docker-compose.supabase.yaml` |
| `kong` (API gateway) | `docker-compose.supabase.yaml` |
| `auth` (GoTrue) | `docker-compose.supabase.yaml` |
| `rest` (PostgREST) | `docker-compose.supabase.yaml` |
| `realtime` | `docker-compose.supabase.yaml` |
| `storage` | `docker-compose.supabase.yaml` |
| `imgproxy` | `docker-compose.supabase.yaml` |
| `meta` (pg-meta) | `docker-compose.supabase.yaml` |
| `studio` | `docker-compose.supabase.yaml` |

## Port map

| Service | Internal port | Host binding | Accessible from |
|---|---|---|---|
| `app` (Next.js) | 3000 | `0.0.0.0:3000` | Public — put behind Coolify proxy |
| `kong` (API gateway) | 8000 | `0.0.0.0:8001` | Public — put behind Coolify proxy |
| `studio` (Supabase dashboard) | 3000 | `127.0.0.1:3001` | Localhost only — SSH tunnel |
| `nlp` (BERT sidecar) | 8080 | not published | Internal only (`http://nlp:8080`) |
| `db` (PostgreSQL) | 5432 | not published | Internal only |
| `auth` (GoTrue) | 9999 | not published | Internal only (via Kong) |
| `rest` (PostgREST) | 3000 | not published | Internal only (via Kong) |
| `realtime` | 4000 | not published | Internal only (via Kong) |
| `storage` | 5000 | not published | Internal only (via Kong) |
| `meta` (pg-meta) | 8080 | not published | Internal only (via Kong/Studio) |
| `imgproxy` | 8080 | not published | Internal only (via storage) |

## What each service does

### `app` — Next.js application
The user-facing web app. Served on port 3000. Built as a standalone Next.js production image.
All API calls from the browser go to Kong (not directly to PostgREST or Auth).
Defined in `docker-compose.yaml`.

### `nlp` — BERT NLP sidecar
Python FastAPI service running `nlptown/bert-base-multilingual-uncased-sentiment`.
Scores free-text input for negativity to suggest leave durations.
Reachable internally at `http://nlp:8080` — never exposed to the host.
Defined in `docker-compose.yaml`.

### `kong` — API gateway
Every Supabase client request (REST, Auth, Realtime, Storage) passes through Kong.
Kong validates the `apikey` header against the consumer keys (ANON_KEY or SERVICE_ROLE_KEY) before forwarding to the appropriate internal service.
Exposed on host port **8001** (not 8000, to avoid conflict with Coolify's default port).
Defined in `docker-compose.supabase.yaml`.

### `db` — PostgreSQL 15
The main database. Not published to the host. Only reachable by other containers on `ttleave_shared`.
The `migrate` service runs once on boot to set role passwords and apply SQL migrations.
Defined in `docker-compose.supabase.yaml`.

### `migrate` — one-shot migration runner
Runs `supabase/postgres` as a one-shot container (`restart: "no"`).
Connects as `supabase_admin` (the actual superuser in this image) to:
1. Set passwords on `supabase_auth_admin`, `supabase_storage_admin`, `authenticator`
2. Apply migrations `001`–`007` (idempotent)
3. Create the `_realtime` schema for the Realtime service

Migrations 005, 006, and 007 (NLP scoring and linear regression) are applied on every deploy — they are written to be idempotent (safe to re-run).
Exits with code 0 on success. This is expected and correct.
Defined in `docker-compose.supabase.yaml`.

### `auth` — GoTrue
Handles all authentication: signup, login, password reset, OAuth, JWT issuance.
Reached by the browser via Kong at `/auth/v1/*`.
Sends emails through the configured SMTP provider — see [AUTH.md](./AUTH.md) for setup.
Defined in `docker-compose.supabase.yaml`.

### `rest` — PostgREST
Auto-generates a REST API from the PostgreSQL schema.
Reached via Kong at `/rest/v1/*`.
Defined in `docker-compose.supabase.yaml`.

### `realtime` — Supabase Realtime
WebSocket server for live data subscriptions.
Reached via Kong at `/realtime/v1/*`.
Defined in `docker-compose.supabase.yaml`.

### `storage` — Supabase Storage
File storage API backed by the local filesystem (or S3-compatible).
Reached via Kong at `/storage/v1/*`.
Uses `imgproxy` internally for image transformations.
Defined in `docker-compose.supabase.yaml`.

### `imgproxy`
On-the-fly image resizing/transformation. Used internally by Storage.
Not directly reachable from outside.
Defined in `docker-compose.supabase.yaml`.

### `meta` — postgres-meta
HTTP API for PostgreSQL metadata (used by Studio).
Not reachable from outside.
Defined in `docker-compose.supabase.yaml`.

### `studio` — Supabase Studio
Web-based database admin dashboard. Bound to `127.0.0.1:3001` — never exposed publicly.
Defined in `docker-compose.supabase.yaml`.

**To access Studio:**
```bash
# From your local machine, create an SSH tunnel to the server:
ssh -L 3001:127.0.0.1:3001 user@your-server

# Then open in your browser:
http://localhost:3001

# Login: username = supabase, password = DASHBOARD_PASSWORD (from .env.supabase)
```

## How to start/stop each stack

### Supabase stack
```bash
docker compose -f docker-compose.supabase.yaml up -d    # start
docker compose -f docker-compose.supabase.yaml down     # stop
docker compose -f docker-compose.supabase.yaml logs -f  # logs
```

### App stack
```bash
docker compose up -d --build    # start (Supabase must be up first)
docker compose down             # stop
docker compose logs -f          # logs
```

## Coolify proxy setup

Two Coolify proxy entries are needed to make the app publicly accessible:

### 1. App proxy — for users
```
Domain:      app.yourdomain.com   (or yourdomain.com)
Protocol:    HTTPS (Let's Encrypt)
Forward to:  http://localhost:3000
```

### 2. API proxy — for Supabase client calls
```
Domain:      api.yourdomain.com
Protocol:    HTTPS (Let's Encrypt)
Forward to:  http://localhost:8001
```

After adding the API proxy, update these values in `.env.supabase` and `.env.app` to your real domain:
```env
# .env.supabase
SUPABASE_PUBLIC_URL=https://api.yourdomain.com
API_EXTERNAL_URL=https://api.yourdomain.com
SITE_URL=https://app.yourdomain.com

# .env.app
NEXT_PUBLIC_SUPABASE_URL=https://api.yourdomain.com
NEXT_PUBLIC_APP_URL=https://app.yourdomain.com
```

Then apply the changes:
```bash
docker compose up -d --build                                        # rebakes NEXT_PUBLIC_* into the client bundle
docker compose -f docker-compose.supabase.yaml up -d --force-recreate auth  # GoTrue picks up new SITE_URL for email links
```

Studio should **not** have a Coolify proxy — keep it on localhost with an SSH tunnel.
