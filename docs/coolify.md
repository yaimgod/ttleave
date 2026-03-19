# Coolify VPS Deployment Guide

## Overview

Two separate Coolify resources, both pulling from the **same Git repo**:

| Resource | Compose file | Domain | Purpose |
|---|---|---|---|
| **Supabase** | `docker-compose.supabase.yaml` | `api.masteroradmin.space` | Database, Auth, Storage, Kong gateway |
| **App** | `docker-compose.app.yaml` | `masteroradmin.space` | Next.js + NLP sidecar |

---

## Port Map

### Exposed to internet (via Traefik reverse proxy — Coolify manages this)

| Service | Container port | Public URL | Notes |
|---|---|---|---|
| Next.js app | 3000 | `https://masteroradmin.space` | Coolify proxies via Traefik |
| Kong gateway | 8000 (internal) → 8001 (host) | `https://api.masteroradmin.space` | Coolify proxies via Traefik |

### Internal only (Docker network — never open in firewall)

| Service | Port | Notes |
|---|---|---|
| PostgreSQL | 5432 | Not published to host at all |
| GoTrue (Auth) | 9999 | Internal only |
| PostgREST | 3000 | Internal only (different container from app) |
| Realtime | 4000 | Internal only |
| Storage API | 5000 | Internal only |
| Imgproxy | 5001 | Internal only |
| pg-meta | 8080 | Internal only |
| NLP sidecar | 8080 | Internal only |
| Studio | 3001 | Localhost-only (`127.0.0.1:3001`) |

### VPS Firewall Rules (UFW example)

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp      # SSH
ufw allow 80/tcp      # HTTP (redirect to HTTPS by Traefik)
ufw allow 443/tcp     # HTTPS (Traefik terminates TLS)
ufw enable
```

**Do NOT open** 3000, 5432, 8001, 8025, 9999, or any other service port directly.
Traefik (Coolify's built-in reverse proxy) handles all routing internally.

---

## Step-by-Step Setup

### 1. DNS

Point both domains to your VPS IP:

```
A   masteroradmin.space       →  YOUR_VPS_IP
A   api.masteroradmin.space   →  YOUR_VPS_IP
```

Wait for propagation before proceeding (check with `dig masteroradmin.space`).

---

### 2. Deploy the Supabase Resource

1. In Coolify → **New Resource** → **Docker Compose**
2. **Source**: your Git repo, branch `main`
3. **Compose file**: `docker-compose.supabase.yaml`
4. **Domain**: `api.masteroradmin.space`
   - Port: `8001` (Kong's host port)
   - Enable HTTPS (Traefik will issue a Let's Encrypt cert)
5. **Environment Variables** — paste from `.env.supabase.example` with real values:
   ```
   POSTGRES_PASSWORD=<generated>
   JWT_SECRET=<generated>
   ANON_KEY=<generated JWT>
   SERVICE_ROLE_KEY=<generated JWT>
   DASHBOARD_PASSWORD=<strong password>
   SECRET_KEY_BASE=<generated>
   SUPABASE_PUBLIC_URL=https://api.masteroradmin.space
   API_EXTERNAL_URL=https://api.masteroradmin.space
   SITE_URL=https://masteroradmin.space
   SMTP_HOST=smtp.resend.com
   SMTP_PORT=587
   SMTP_USER=resend
   SMTP_PASS=re_YOUR_RESEND_API_KEY
   SMTP_ADMIN_EMAIL=noreply@masteroradmin.space
   ... (rest from .env.supabase.example)
   ```
6. **Deploy** — wait for all services to be healthy (~2 min).
7. Note the **Docker network name** Coolify created (e.g. `coolify-ttleave-supabase` or similar — visible in Coolify's UI under the resource's Network tab).

---

### 3. Deploy the App Resource

1. In Coolify → **New Resource** → **Docker Compose**
2. **Source**: same Git repo, branch `main`
3. **Compose file**: `docker-compose.app.yaml`
4. **Domain**: `masteroradmin.space`
   - Port: `3000`
   - Enable HTTPS
5. **Environment Variables** — paste from `.env.app.example` with real values:
   ```
   ANON_KEY=<same value as in Supabase resource>
   SERVICE_ROLE_KEY=<same value as in Supabase resource>
   NEXT_PUBLIC_SUPABASE_URL=https://api.masteroradmin.space
   NEXT_PUBLIC_APP_URL=https://masteroradmin.space
   ENABLE_GOOGLE_AUTH=false
   ```
6. **Deploy**.

---

### 4. Connect the Two Networks

The app needs to reach `http://kong:8000` inside Docker.
Both stacks must share the same Docker network.

**Option A — Coolify UI (recommended):**
1. Go to the **App** resource → **Settings** → **Network**
2. Add the Supabase resource's network (the name from step 2.7)
3. Redeploy the App resource

**Option B — manual (SSH into VPS):**
```bash
# Find the Supabase network name
docker network ls | grep supabase

# Connect the app container to it
docker network connect <supabase_network_name> <app_container_name>
```

After connecting, the app can resolve `http://kong:8000` for server-side Supabase calls.

---

### 5. Verify

```bash
# Kong is reachable (should return JSON)
curl https://api.masteroradmin.space/auth/v1/health

# App is reachable
curl https://masteroradmin.space/api/health

# NLP sidecar (internal only — test from inside the app container)
docker exec -it <app_container> wget -qO- http://nlp:8080/health
```

---

## Accessing Studio (Supabase Dashboard)

Studio is bound to `127.0.0.1:3001` on the VPS — never exposed to the internet.

**SSH tunnel:**
```bash
ssh -L 3001:localhost:3001 user@YOUR_VPS_IP
```
Then open `http://localhost:3001` in your browser.

Login: username `supabase`, password = `DASHBOARD_PASSWORD` from your env.

---

## Shared Values (must be identical in both resources)

| Variable | App resource | Supabase resource |
|---|---|---|
| `ANON_KEY` | ✅ | ✅ |
| `SERVICE_ROLE_KEY` | ✅ | ✅ |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | = `SUPABASE_PUBLIC_URL` |
| `NEXT_PUBLIC_APP_URL` | ✅ | = `SITE_URL` |
| `ENABLE_GOOGLE_AUTH` | ✅ | ✅ |

If these don't match, auth will fail with JWT errors or redirect loops.

---

## Local Development

### Full stack (everything in one command):
```bash
cp .env.example .env
bash scripts/generate-secrets.sh   # paste output into .env
docker compose --profile supabase up -d
```

### Separate stacks (mirrors Coolify setup):
```bash
# Terminal 1 — Supabase
cp .env.supabase.example .env.supabase  # fill in values
docker compose -f docker-compose.supabase.yaml up -d

# Terminal 2 — App
cp .env.app.example .env.app  # fill in values
docker compose -f docker-compose.app.yaml up -d

# Connect the app to the Supabase network
docker network connect ttleave_supabase_net ttleave-app-1
```
