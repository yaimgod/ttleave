# TTLeave — Deployment & Local Development

For port mappings and service descriptions see **[SERVICES.md](./SERVICES.md)**.
For email and OAuth configuration see **[AUTH.md](./AUTH.md)**.

---

## Architecture overview

The single `docker-compose.yaml` uses **Docker Compose profiles** to support two modes:

| Mode | Command | Services started |
|---|---|---|
| **App only** | `docker compose --profile app up -d` | `app`, `nlp` |
| **Supabase only** | `docker compose --profile supabase up -d` | all Supabase services |
| **Full local stack** | `docker compose --profile app --profile supabase up -d` | everything |

Each profile is **fully isolated** — `--profile supabase` starts only Supabase,
`--profile app` starts only the Next.js app and NLP sidecar.

In **Coolify**, this maps to **two separate resources** from the same Git repo:

```
┌─────────────────────────────────┐   ┌─────────────────────────────────┐
│  Resource 1: Supabase           │   │  Resource 2: App                │
│  profile: supabase              │   │  profile: app                   │
│                                 │   │                                 │
│  db, migrate, kong, auth,       │   │  app (Next.js)                  │
│  rest, realtime, storage,       │   │  nlp (BERT sidecar)             │
│  imgproxy, meta, studio         │   │                                 │
│                                 │   │  → connects to kong:8000 via    │
│  Network: supabase_net          │◄──┤    shared Docker network        │
└─────────────────────────────────┘   └─────────────────────────────────┘
         api.yourdomain.com                   app.yourdomain.com
         (Kong — port 8001)                   (Next.js — port 3000)
```

The App resource joins the Supabase resource's network so that `http://kong:8000`
resolves from inside the `app` container without exposing Kong to the internet.

---

## 1. Deploy with Coolify (two-resource setup)

### Prerequisites

- A VPS with Docker installed and [Coolify](https://coolify.io/) running
- Two domains pointed at your VPS:
  - `app.yourdomain.com` → the Next.js app
  - `api.yourdomain.com` → Supabase Kong (public API)
- SMTP credentials (e.g. [Resend](https://resend.com)) — see [AUTH.md](./AUTH.md)

---

### Step 1 — Generate secrets

Run locally and keep the output safe:

```bash
bash scripts/generate-secrets.sh
```

You'll need these values in both Coolify resources.

---

### Step 2 — Resource 1: Supabase

This resource starts all Supabase services using the `supabase` profile.

1. In Coolify → **New Resource → Docker Compose**
2. Connect your Git repo (this repository)
3. Set **Compose file**: `docker-compose.yaml`
4. Set **Docker Compose Profile**: `supabase`
5. **Environment Variables** — paste all values from `.env.supabase.example`:

| Variable | Value |
|---|---|
| `POSTGRES_PASSWORD` | *(generated)* |
| `JWT_SECRET` | *(generated)* |
| `ANON_KEY` | *(generated)* |
| `SERVICE_ROLE_KEY` | *(generated)* |
| `DASHBOARD_PASSWORD` | *(generated)* |
| `SECRET_KEY_BASE` | *(generated)* |
| `SUPABASE_PUBLIC_URL` | `https://api.yourdomain.com` |
| `API_EXTERNAL_URL` | `https://api.yourdomain.com` |
| `SITE_URL` | `https://app.yourdomain.com` |
| `SMTP_HOST` | e.g. `smtp.resend.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | `resend` |
| `SMTP_PASS` | *(your API key)* |
| `SMTP_ADMIN_EMAIL` | `noreply@yourdomain.com` |
| `SMTP_SENDER_NAME` | `TTLeave` *(display name in From field)* |
| `MAILER_URLPATHS_CONFIRMATION` | `/auth/v1/verify` |
| `MAILER_URLPATHS_INVITE` | `/auth/v1/verify` |
| `MAILER_URLPATHS_RECOVERY` | `/auth/v1/verify` |
| `MAILER_URLPATHS_EMAIL_CHANGE` | `/auth/v1/verify` |

> The `MAILER_URLPATHS_*` values are **paths only** — GoTrue prepends `API_EXTERNAL_URL`
> automatically to form the full link (e.g. `https://api.yourdomain.com/auth/v1/verify?token=...`).
> Do not put a full URL here.

6. **Proxy** → point `api.yourdomain.com` → port `8001` — enable HTTPS
7. Click **Deploy**

> Studio is bound to `127.0.0.1:3001` only. Access via SSH tunnel:
> ```bash
> ssh -L 3001:127.0.0.1:3001 user@your-server
> # → http://localhost:3001  (login: supabase / DASHBOARD_PASSWORD)
> ```

---

### Step 3 — Resource 2: App

This resource starts only `app` and `nlp` using the `app` profile.

1. In Coolify → **New Resource → Docker Compose**
2. Connect the **same Git repo**
3. Set **Compose file**: `docker-compose.yaml`
4. Set **Docker Compose Profile**: `app`
5. **Environment Variables** — paste all values from `.env.app.example`:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://api.yourdomain.com` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same as `ANON_KEY` above |
| `NEXT_PUBLIC_APP_URL` | `https://app.yourdomain.com` |
| `SUPABASE_SERVICE_ROLE_KEY` | same as `SERVICE_ROLE_KEY` above |
| `SUPABASE_URL` | `http://kong:8000` *(internal — do not change)* |
| `NLP_SERVICE_URL` | `http://nlp:8080` *(internal — do not change)* |

6. **Proxy** → point `app.yourdomain.com` → port `3000` — enable HTTPS
7. **Network** → join the Supabase resource's Docker network
   (Coolify UI: Resource settings → Networks → attach `<supabase-resource>_supabase_net`)
   This allows the `app` container to reach `kong:8000` by hostname.
8. Click **Deploy**

> `SUPABASE_URL=http://kong:8000` works because both resources share the
> same Docker network. Kong is **never** exposed directly to the internet.

---

### Step 4 — Auto-deploy on push (optional)

In each resource's settings enable **Webhook / Auto Deploy** so pushes to
the connected branch trigger a new deployment automatically.

> ⚠️ Only the **App** resource needs to rebuild on every push (Next.js code).
> The **Supabase** resource only needs redeployment when Supabase config or
> migrations change.

---

## 2. Local development

### Option A — Full Docker stack (recommended, production-like)

Starts all services including Supabase using the `supabase` profile.

```bash
cp .env.example .env
bash scripts/generate-secrets.sh   # paste output into .env
```

Set local URLs in `.env`:
```env
SUPABASE_PUBLIC_URL=http://localhost:8001
API_EXTERNAL_URL=http://localhost:8001
NEXT_PUBLIC_SUPABASE_URL=http://localhost:8001
SITE_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Start everything:
```bash
docker compose --profile app --profile supabase up -d
```

| URL | What |
|---|---|
| http://localhost:3000 | The app |
| http://localhost:8001 | Supabase API (Kong) |
| http://localhost:3001 | Supabase Studio (login: supabase / DASHBOARD_PASSWORD) |

Stop: `docker compose --profile app --profile supabase down`

---

### Option B — Hot-reload dev server (fast frontend iteration)

Supabase runs in Docker; Next.js runs natively with hot reload.

```bash
# Start only Supabase services (no app container)
docker compose --profile supabase up -d

# In a separate terminal — run the Next.js dev server
npm install
npm run dev
```

The dev server reads `.env` directly — ensure `NEXT_PUBLIC_SUPABASE_URL=http://localhost:8001`
and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set there.

Stop: `Ctrl+C`, then `docker compose --profile supabase down`

---

### Option C — App only (external Supabase)

Use this when Supabase is already running elsewhere (e.g. another machine or
a Coolify Supabase resource you've already deployed).

```bash
# Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_URL in .env to point at your Supabase instance
docker compose --profile app up -d   # starts app + nlp only
```

---

## 3. Common operations

### Rebuild app after code or env changes
```bash
docker compose --profile app up -d --build app
```

### Apply a new database migration
```bash
docker compose --profile supabase exec db psql -U supabase_admin -d postgres -f - < supabase/migrations/00X_your_migration.sql
```

### Restart auth after SMTP or OAuth changes
```bash
docker compose --profile supabase up -d --force-recreate auth
```

### View logs
```bash
docker compose --profile app logs -f app
docker compose --profile supabase logs -f auth
docker compose --profile app logs -f nlp
```

### Check all service health
```bash
docker compose --profile app --profile supabase ps
```
All services should show `(healthy)`. The `migrate` service shows `Exited (0)` — this is correct.

### Reset database (deletes all data)
```bash
docker compose --profile app --profile supabase down -v
docker compose --profile app --profile supabase up -d
```
