# TTLeave — Services & Ports

All services run inside the `supabase_net` Docker bridge network and communicate by container name. Only the ports listed as **host-bound** are reachable from outside Docker.

## Port map

| Service | Internal port | Host binding | Accessible from |
|---|---|---|---|
| `app` (Next.js) | 3000 | `0.0.0.0:3000` | Public — put behind Coolify proxy |
| `kong` (API gateway) | 8000 | `0.0.0.0:8001` | Public — put behind Coolify proxy |
| `studio` (Supabase dashboard) | 3000 | `127.0.0.1:3001` | Localhost only — SSH tunnel |
| `mailpit` (web UI) | 8025 | `127.0.0.1:8025` | Localhost only — SSH tunnel |
| `mailpit` (SMTP) | 1025 | `127.0.0.1:1025` | Localhost only — internal relay |
| `db` (PostgreSQL) | 5432 | not published | Internal only |
| `auth` (GoTrue) | 9999 | not published | Internal only (via Kong) |
| `rest` (PostgREST) | 3000 | not published | Internal only (via Kong) |
| `realtime` | 4000 | not published | Internal only (via Kong) |
| `storage` | 5000 | not published | Internal only (via Kong) |
| `meta` (pg-meta) | 8080 | not published | Internal only (via Kong) |
| `imgproxy` | 8080 | not published | Internal only (via storage) |

## What each service does

### `app` — Next.js application
The user-facing web app. Served on port 3000. Built as a standalone Next.js production image.
All API calls from the browser go to Kong (not directly to PostgREST or Auth).

### `kong` — API gateway
Every Supabase client request (REST, Auth, Realtime, Storage) passes through Kong.
Kong validates the `apikey` header against the consumer keys (ANON_KEY or SERVICE_ROLE_KEY) before forwarding to the appropriate internal service.
Exposed on host port **8001** (not 8000, to avoid conflict with Coolify's default port).

### `db` — PostgreSQL 15
The main database. Not published to the host. Only reachable by other containers on `supabase_net`.
The `migrate` service runs once on first boot to set role passwords and apply the four SQL migrations.

### `migrate` — one-shot migration runner
Runs `supabase/postgres` as a one-shot container (`restart: "no"`).
Connects as `supabase_admin` (the actual superuser in this image) to:
1. Set passwords on `supabase_auth_admin`, `supabase_storage_admin`, `authenticator`
2. Apply migrations `001`–`004` (idempotent — skips if already applied)
3. Create the `_realtime` schema for the Realtime service

Exits with code 0 on success. This is expected and correct.

### `auth` — GoTrue
Handles all authentication: signup, login, password reset, OAuth, JWT issuance.
Reached by the browser via Kong at `/auth/v1/*`.
Sends emails through Mailpit (or your real SMTP provider — see [AUTH.md](./AUTH.md)).

### `rest` — PostgREST
Auto-generates a REST API from the PostgreSQL schema.
Reached via Kong at `/rest/v1/*`.

### `realtime` — Supabase Realtime
WebSocket server for live data subscriptions.
Reached via Kong at `/realtime/v1/*`.

### `storage` — Supabase Storage
File storage API backed by the local filesystem (or S3-compatible).
Reached via Kong at `/storage/v1/*`.
Uses `imgproxy` internally for image transformations.

### `imgproxy`
On-the-fly image resizing/transformation. Used internally by Storage.
Not directly reachable from outside.

### `meta` — postgres-meta
HTTP API for PostgreSQL metadata (used by Studio).
Not reachable from outside.

### `studio` — Supabase Studio
Web-based database admin dashboard. Bound to `127.0.0.1:3001` — never exposed publicly.

**To access Studio:**
```bash
# From your local machine, create an SSH tunnel to the server:
ssh -L 3001:127.0.0.1:3001 user@your-server

# Then open in your browser:
http://localhost:3001

# Login: username = supabase, password = DASHBOARD_PASSWORD (from .env)
```

### `mailpit` — mail catcher
Acts as an SMTP relay for GoTrue. Catches all outgoing auth emails (confirmations, password resets) and shows them in a web UI. Emails are **not delivered** to real inboxes — they are held in Mailpit.

**To view caught emails:**
```bash
# SSH tunnel (if on a remote server):
ssh -L 8025:127.0.0.1:8025 user@your-server

# Then open:
http://localhost:8025
```

When you're ready to send real emails, swap the SMTP settings in `.env` — see [AUTH.md](./AUTH.md).

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

After adding the API proxy, update these four values in `.env` to your real domain:
```env
SUPABASE_PUBLIC_URL=https://api.yourdomain.com
API_EXTERNAL_URL=https://api.yourdomain.com
NEXT_PUBLIC_SUPABASE_URL=https://api.yourdomain.com
SITE_URL=https://app.yourdomain.com
NEXT_PUBLIC_APP_URL=https://app.yourdomain.com
```

Then apply the changes:
```bash
docker compose up -d --build app        # rebakes NEXT_PUBLIC_* into the client bundle
docker compose up -d --force-recreate auth  # GoTrue picks up new SITE_URL for email links
```

Studio and Mailpit should **not** have Coolify proxies — keep them on localhost with SSH tunnels.
