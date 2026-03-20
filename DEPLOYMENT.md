# TTLeave — Deployment & Local Development

For port mappings and service descriptions see **[SERVICES.md](./SERVICES.md)**.
For email and OAuth configuration see **[AUTH.md](./AUTH.md)**.

---

## Architecture overview

The stack is split across **two separate Docker Compose files**:

| File | Services | Used for |
|---|---|---|
| `docker-compose.supabase.yaml` | db, migrate, kong, auth, rest, realtime, storage, imgproxy, meta, studio | Coolify Supabase resource / local Supabase stack |
| `docker-compose.yaml` | app (Next.js), nlp (BERT sidecar) | Coolify App resource / local app stack |

The Supabase file **creates** the shared Docker network `ttleave_shared` (attachable).
The App file **joins** that network so the `app` container can reach `http://kong:8000` by hostname without exposing Kong to the internet.

In **Coolify**, this maps to **two separate resources** from the same Git repo:

```
┌─────────────────────────────────┐   ┌─────────────────────────────────┐
│  Resource 1: Supabase           │   │  Resource 2: App                │
│  file: docker-compose.supabase  │   │  file: docker-compose.yaml      │
│                                 │   │                                 │
│  db, migrate, kong, auth,       │   │  app (Next.js)                  │
│  rest, realtime, storage,       │   │  nlp (BERT sidecar)             │
│  imgproxy, meta, studio         │   │                                 │
│                                 │   │  → connects to kong:8000 via    │
│  Creates: ttleave_shared        │◄──┤    ttleave_shared network       │
└─────────────────────────────────┘   └─────────────────────────────────┘
         api.yourdomain.com                   app.yourdomain.com
         (Kong — port 8001)                   (Next.js — port 3000)
```

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

This resource starts all Supabase services and creates the `ttleave_shared` Docker network.

1. In Coolify → **New Resource → Docker Compose**
2. Connect your Git repo (this repository)
3. Set **Compose file**: `docker-compose.supabase.yaml`
4. **Environment Variables** — paste all values from `.env.supabase.example`:

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

5. **Proxy** → point `api.yourdomain.com` → port `8001` — enable HTTPS
6. Click **Deploy** — wait for all services to be healthy (~2 min)
7. Note the **Docker network name** Coolify created for this resource (visible under the resource's **Network** tab — it will be based on `ttleave_shared`)

> Studio is bound to `127.0.0.1:3001` only. Access via SSH tunnel:
> ```bash
> ssh -L 3001:127.0.0.1:3001 user@your-server
> # → http://localhost:3001  (login: supabase / DASHBOARD_PASSWORD)
> ```

---

### Step 3 — Resource 2: App

This resource starts `app` (Next.js) and `nlp` (BERT sidecar).

1. In Coolify → **New Resource → Docker Compose**
2. Connect the **same Git repo**
3. Set **Compose file**: `docker-compose.yaml`
4. **Environment Variables** — paste all values from `.env.app.example`:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://api.yourdomain.com` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same as `ANON_KEY` above |
| `NEXT_PUBLIC_APP_URL` | `https://app.yourdomain.com` |
| `SUPABASE_SERVICE_ROLE_KEY` | same as `SERVICE_ROLE_KEY` above |
| `SUPABASE_URL` | `http://kong:8000` *(internal — do not change)* |
| `NLP_SERVICE_URL` | `http://nlp:8080` *(internal — do not change)* |

5. **Proxy** → point `app.yourdomain.com` → port `3000` — enable HTTPS
6. **Networks** → go to the App resource's **Networks** tab → connect it to the Supabase resource's network (the name from step 2.7)
   This allows the `app` container to reach `kong:8000` by hostname.
7. Click **Deploy**

> `SUPABASE_URL=http://kong:8000` works because both resources share the
> `ttleave_shared` Docker network. Kong is **never** exposed directly to the internet.

---

### Step 4 — Auto-deploy on push (optional)

In each resource's settings enable **Webhook / Auto Deploy** so pushes to
the connected branch trigger a new deployment automatically.

> Only the **App** resource needs to rebuild on every push (Next.js code).
> The **Supabase** resource only needs redeployment when Supabase config or
> migrations change.

---

## 2. Local development

### Option A — Full Docker stack (recommended, production-like)

Starts all services including Supabase, mirroring the two-file Coolify setup.

```bash
cp .env.supabase.example .env.supabase
cp .env.app.example .env.app
bash scripts/generate-secrets.sh   # paste output into both env files
```

Set local URLs in `.env.supabase`:
```env
SUPABASE_PUBLIC_URL=http://localhost:8001
API_EXTERNAL_URL=http://localhost:8001
SITE_URL=http://localhost:3000
```

Set local URLs in `.env.app`:
```env
NEXT_PUBLIC_SUPABASE_URL=http://localhost:8001
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Start everything (Supabase first — it creates the `ttleave_shared` network):
```bash
docker compose -f docker-compose.supabase.yaml up -d
docker compose up -d --build
```

| URL | What |
|---|---|
| http://localhost:3000 | The app |
| http://localhost:8001 | Supabase API (Kong) |
| http://localhost:3001 | Supabase Studio (login: supabase / DASHBOARD_PASSWORD) |

Stop:
```bash
docker compose down
docker compose -f docker-compose.supabase.yaml down
```

---

### Option B — Hot-reload dev server (fast frontend iteration)

Supabase runs in Docker; Next.js runs natively with hot reload.

```bash
# Start only Supabase services
docker compose -f docker-compose.supabase.yaml up -d

# In a separate terminal — run the Next.js dev server
npm install
npm run dev
```

The dev server reads `.env.app` directly — ensure `NEXT_PUBLIC_SUPABASE_URL=http://localhost:8001`
and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set there.

Stop: `Ctrl+C`, then `docker compose -f docker-compose.supabase.yaml down`

---

### Option C — App only (external Supabase)

Use this when Supabase is already running elsewhere (e.g. another machine or
a Coolify Supabase resource you've already deployed).

```bash
# Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_URL in .env.app to point at your Supabase instance
docker compose up -d --build   # starts app + nlp only
```

---

## 3. Common operations

### Rebuild app after code or env changes
```bash
docker compose up -d --build app
```

### Apply a new database migration
```bash
docker compose -f docker-compose.supabase.yaml exec db psql -U supabase_admin -d postgres -f - < supabase/migrations/00X_your_migration.sql
```

### Restart auth after SMTP or OAuth changes
```bash
docker compose -f docker-compose.supabase.yaml up -d --force-recreate auth
```

### View logs
```bash
docker compose logs -f app
docker compose -f docker-compose.supabase.yaml logs -f auth
docker compose logs -f nlp
```

### Check all service health
```bash
docker compose ps
docker compose -f docker-compose.supabase.yaml ps
```
All services should show `(healthy)`. The `migrate` service shows `Exited (0)` — this is correct.

### Reset database (deletes all data)
```bash
docker compose down
docker compose -f docker-compose.supabase.yaml down -v
docker compose -f docker-compose.supabase.yaml up -d
docker compose up -d --build
```
