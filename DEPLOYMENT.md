# TTLeave — Deployment & Local Development

For port mappings, Coolify proxy setup, and SSH tunnel instructions see **[SERVICES.md](./SERVICES.md)**.
For email and OAuth configuration see **[AUTH.md](./AUTH.md)**.

---

## 1. Deploy with Coolify

Coolify runs a reverse proxy (HTTPS, Let's Encrypt) and deploys your stack via Docker Compose.

### Prerequisites

- A VPS with Docker installed
- [Coolify](https://coolify.io/) installed on that server
- Two (sub)domains — one for the app, one for the API (e.g. `app.yourdomain.com`, `api.yourdomain.com`)
- Optionally: SMTP credentials for real email delivery (see [AUTH.md](./AUTH.md))

---

### Step 1 — Prepare `.env`

On your local machine:

```bash
cp .env.example .env
bash scripts/generate-secrets.sh   # paste the printed block into .env
```

Set the URL variables to your real domains:

```env
SUPABASE_PUBLIC_URL=https://api.yourdomain.com
API_EXTERNAL_URL=https://api.yourdomain.com
NEXT_PUBLIC_SUPABASE_URL=https://api.yourdomain.com
SITE_URL=https://app.yourdomain.com
NEXT_PUBLIC_APP_URL=https://app.yourdomain.com
```

Set SMTP for real email delivery — a real transactional provider (e.g. Resend) is required. See [AUTH.md](./AUTH.md) for configuration details.

---

### Step 2 — Add the resource in Coolify

1. Log in to your Coolify dashboard → **New Resource**
2. Choose **Docker Compose**
3. Connect the source:
   - **From repository:** connect GitHub, select this repo and branch — Coolify uses `docker-compose.yml` and `coolify.json`
   - **From server:** point to the directory containing `docker-compose.yml`

---

### Step 3 — Set environment variables

In the Coolify resource's **Environment Variables** panel, paste every variable from your `.env` — same names, same values.

Key variables Coolify must have:

| Variable | Description |
|---|---|
| `POSTGRES_PASSWORD` | DB superuser password (generated) |
| `JWT_SECRET` | Signing key for all JWTs (generated) |
| `ANON_KEY` | Public API key JWT (generated) |
| `SERVICE_ROLE_KEY` | Server-side API key JWT (generated) |
| `DASHBOARD_PASSWORD` | Supabase Studio login password (generated) |
| `SECRET_KEY_BASE` | Realtime secret (generated) |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://api.yourdomain.com` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same as `ANON_KEY` |
| `NEXT_PUBLIC_APP_URL` | `https://app.yourdomain.com` |
| `SITE_URL` | `https://app.yourdomain.com` |
| `API_EXTERNAL_URL` | `https://api.yourdomain.com` |

Do **not** commit `.env` to Git. Set everything in Coolify's UI.

---

### Step 4 — Add Coolify proxies

Two proxy entries are required. See **[SERVICES.md](./SERVICES.md)** for full details.

| Proxy | Domain | Forwards to |
|---|---|---|
| App | `app.yourdomain.com` | `localhost:3000` |
| API (Kong) | `api.yourdomain.com` | `localhost:8001` |

Enable HTTPS (Let's Encrypt) on both.

---

### Step 5 — Deploy

1. Click **Deploy** in Coolify
2. Coolify builds the Next.js image, pulls all other images, and starts the stack
3. Wait for the app to be healthy (~1 min on first run — the `migrate` service runs once then exits with code 0)
4. Open `https://app.yourdomain.com`

---

### Step 6 — Access Studio

Studio is bound to `localhost` only. Use an SSH tunnel from your local machine:

```bash
# Supabase Studio
ssh -L 3001:127.0.0.1:3001 user@your-server
# → http://localhost:3001   (login: supabase / DASHBOARD_PASSWORD)
```

---

### Auto-deploy on push (optional)

In Coolify's resource settings, enable **Webhook** / **Auto Deploy** so that pushes to the connected branch trigger a new deployment automatically.

---

## 2. Local development

### Option A — Full Docker stack (production-like)

Best for testing deployment behavior end-to-end.

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
docker compose up -d
```

| URL | What |
|---|---|
| http://localhost:3000 | The app |
| http://localhost:8001 | Supabase API (Kong) |
| http://localhost:3001 | Supabase Studio (login: supabase / DASHBOARD_PASSWORD) |

Stop: `docker compose down`

---

### Option B — Hot-reload dev server (frontend development)

Best for frontend work — Next.js runs natively with fast refresh while Supabase runs in Docker.

```bash
# Start only the backend services (no app container)
docker compose up -d db kong auth rest realtime storage imgproxy meta

# In a separate terminal, run the Next.js dev server
npm install
npm run dev
```

The dev server reads from `.env` directly — ensure `NEXT_PUBLIC_SUPABASE_URL=http://localhost:8001` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set there.

Stop: Ctrl+C, then `docker compose down`.

---

## 3. Common operations

### Reset database (deletes all data)
```bash
docker compose down -v
docker compose up -d
```

### Rebuild app after code or env changes
```bash
docker compose up -d --build app
```

### Restart auth after SMTP or OAuth changes
```bash
docker compose up -d --force-recreate auth
```

### View logs
```bash
docker compose logs -f app
docker compose logs -f auth
docker compose logs -f kong
```

### Check all service health
```bash
docker compose ps
```
All services should show `(healthy)`. The `migrate` service shows `Exited (0)` — this is correct.
