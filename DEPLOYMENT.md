# TTLeave — Deployment & Local Development

This guide covers deploying TTLeave with **self-hosted Coolify** (Docker Compose or GitHub) and running it **locally** for development and testing.

---

## 1. Deploy with self-hosted Coolify

Coolify runs a reverse proxy (HTTPS, Let’s Encrypt) and deploys your stack. You can use either **Docker Compose** (recommended for this project) or **GitHub** (Coolify builds and runs from your repo).

### Prerequisites

- A server (VPS) with Docker installed.
- [Coolify](https://coolify.io/) installed on that server (or on another server that can reach the VPS).
- A domain (or subdomain) for the app and optionally one for the API (e.g. `app.yourdomain.com`, `api.yourdomain.com`).
- SMTP credentials for signup/password-reset emails (e.g. Resend, Postmark, Mailgun), or use `ENABLE_EMAIL_AUTOCONFIRM=true` only for testing.

**Note:** Kong (the API gateway) uses port **8001** by default so it doesn’t conflict with Coolify, which often uses 8000. In Coolify, point the API domain to the **kong** service on port **8001**. To use 8000 instead, set `KONG_HTTP_PORT=8000` in your env.

---

### Option A: Deploy with Docker Compose (recommended)

Use this when you have the repo (or a copy of the compose file and config) and want Coolify to run the full stack via `docker compose`.

#### Step 1: Prepare environment variables

On your **local machine** (or wherever you have the repo):

1. Copy the example env file:
   ```bash
   cp .env.example .env
   ```

2. Generate secrets and paste them into `.env`:
   ```bash
   bash scripts/generate-secrets.sh
   ```
   Copy the printed block into `.env`, replacing the placeholder values.

3. Set **URLs** in `.env` to match your Coolify deployment (use your real domain and ports; Coolify will expose the app on 443):
   - `SUPABASE_PUBLIC_URL` = URL where the Supabase API (Kong) will be reached (e.g. `https://api.yourdomain.com`)
   - `API_EXTERNAL_URL` = same as `SUPABASE_PUBLIC_URL`
   - `SITE_URL` = URL of the Next.js app (e.g. `https://app.yourdomain.com`)
   - `NEXT_PUBLIC_SUPABASE_URL` = same as `SUPABASE_PUBLIC_URL`
   - `NEXT_PUBLIC_APP_URL` = same as `SITE_URL`

4. Set **SMTP** variables (or set `ENABLE_EMAIL_AUTOCONFIRM=true` for testing without email).

5. Set **Kong dashboard** password: `DASHBOARD_USERNAME` and `DASHBOARD_PASSWORD` (used for Supabase Studio / Kong when accessed via the API domain).

#### Step 2: Add the resource in Coolify

1. Log in to your Coolify dashboard.
2. Create a **New Resource**.
3. Choose **Docker Compose** as the deployment type.
4. Connect the Compose source:
   - **From repository:** Connect your Git (e.g. GitHub), select this repo, set branch (e.g. `main`). Coolify will use `docker-compose.yml` and `coolify.json` from the repo.
   - **From server:** If you already have the project on the server, choose “From Server” and point to the directory that contains `docker-compose.yml`.

#### Step 3: Configure the Compose deployment

1. **Compose file:** Ensure Coolify uses `docker-compose.yml` (and that `coolify.json` is in the same directory so Coolify knows the primary service and port).
2. **Environment variables:** In the resource’s **Environment Variables** (or **Build / Deploy** section), paste or type **every** variable from your `.env` (the same names and values). Coolify will inject them into the Compose stack. Do **not** commit `.env` to Git; only set them in Coolify.
3. **Build args** (if shown): For the app service, Coolify may expose build args. Set:
   - `NEXT_PUBLIC_SUPABASE_URL` = same as in env (e.g. `https://api.yourdomain.com`)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your `ANON_KEY`
   - `NEXT_PUBLIC_APP_URL` = same as `SITE_URL` (e.g. `https://app.yourdomain.com`)

   If Coolify reads these from the environment, you only need them in the env list.

#### Step 4: Set domains and deploy

1. **Domains:**
   - Add a domain for the **app** (e.g. `app.yourdomain.com`) and set it to forward to the **app** service, port **3000** (Coolify usually detects this from `coolify.json`: primary service, port 3000).
   - Add a domain for the **API** (e.g. `api.yourdomain.com`) and set it to forward to the **kong** service, port **8001** (default; avoids Coolify port 8000).
2. Enable **HTTPS** (Let’s Encrypt) for both domains if desired.
3. **Deploy** the resource. Coolify will run `docker compose up` (or equivalent), build the Next.js app image, and start all services.
4. Wait for the app to be healthy. Open `https://app.yourdomain.com` in your browser.

#### Step 5: Optional — Supabase Studio

- **Studio** is bound to localhost only (`127.0.0.1:3001`). To use it, SSH into the server and create a tunnel:  
  `ssh -L 3001:127.0.0.1:3001 user@your-server`  
  Then open `http://localhost:3001` and log in with `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD`.
- Alternatively, expose Kong’s root path `/` (which serves Studio) on your API domain; access it with the same basic-auth credentials.

---

### Option B: Deploy with GitHub

Use this when you want Coolify to clone from GitHub and build/deploy on each push.

#### Step 1: Push code and prepare env

1. Push this repository to GitHub (if it’s not already there).
2. On your machine, prepare `.env` as in **Option A, Step 1** (generate secrets, set URLs and SMTP). You will copy these into Coolify later; do not commit `.env`.

#### Step 2: Create the resource in Coolify

1. In Coolify, create a **New Resource**.
2. Choose **Application** (or the option that lets you connect a Git repository).
3. Connect **GitHub**: authorize Coolify, select this repo and the branch (e.g. `main`).

#### Step 3: Choose how to run the stack

- **Docker Compose (recommended):**  
  - Set the deployment type to **Docker Compose**.  
  - Set the compose file path to `docker-compose.yml` (or leave default if Coolify auto-detects it).  
  - Ensure `coolify.json` is in the repo root so Coolify knows primary service and port (app, 3000).

- **Single container (app only):**  
  If you prefer to run only the Next.js app and use an external Supabase (or a separate Compose stack), choose **Dockerfile** and use the repo’s `Dockerfile`. You must then configure env to point to that Supabase (e.g. `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`). This is more advanced and not covered step-by-step here.

#### Step 4: Set environment variables

In the Coolify resource’s **Environment Variables** (or **Build / Deploy**), add **all** variables from your `.env` (same names and values). Include at least:

- All generated secrets (from `scripts/generate-secrets.sh`).
- All URL variables (`SUPABASE_PUBLIC_URL`, `API_EXTERNAL_URL`, `SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_APP_URL`).
- SMTP (or `ENABLE_EMAIL_AUTOCONFIRM=true` for testing).
- `DASHBOARD_USERNAME` and `DASHBOARD_PASSWORD`.

For Compose deployments, Coolify injects these into the Compose project.

#### Step 5: Set domains and deploy

1. Add the **app** domain (e.g. `app.yourdomain.com`) and map it to the **app** service, port **3000**.
2. Add the **API** domain (e.g. `api.yourdomain.com`) and map it to **kong**, port **8001**.
3. Enable HTTPS if desired.
4. Trigger **Deploy**. Coolify will clone the repo, build the app image, and start the stack.
5. After the deploy finishes, open `https://app.yourdomain.com`.

#### Step 6: Auto-deploy on push (optional)

In the resource settings, enable **Webhook** or **Auto Deploy** so that pushes to the connected branch trigger a new deployment.

---

## 2. Local development and testing

Run TTLeave on your machine with the full stack (Postgres, Kong, Auth, Next.js) or with the app in dev mode against a running backend.

### Prerequisites

- **Node.js** 20+ and **npm**
- **Docker** and **Docker Compose**
- **Bash** (for `scripts/generate-secrets.sh`; on Windows use WSL or run the script in Git Bash)

### Option 1: Full stack with Docker Compose (production-like)

Best for testing the full stack and deployment behavior.

1. **Clone and enter the repo:**
   ```bash
   git clone <your-repo-url>
   cd ttleave
   ```

2. **Create and fill `.env`:**
   ```bash
   cp .env.example .env
   bash scripts/generate-secrets.sh
   ```
   Paste the output into `.env`.

3. **Set local URLs in `.env`:**
   - `SUPABASE_PUBLIC_URL=http://localhost:8001`
   - `API_EXTERNAL_URL=http://localhost:8001`
   - `SITE_URL=http://localhost:3000`
   - `NEXT_PUBLIC_SUPABASE_URL=http://localhost:8001`
   - `NEXT_PUBLIC_APP_URL=http://localhost:3000`

4. **Email (choose one):**
   - Set real SMTP in `.env`, or  
   - For quick local testing: `ENABLE_EMAIL_AUTOCONFIRM=true` (no verification emails).

5. **Start the stack:**
   ```bash
   docker compose up -d
   ```
   Wait for the app and Kong to be healthy (about a minute). Logs: `docker compose logs -f app`.

6. **Open the app:**  
   - App: [http://localhost:3000](http://localhost:3000)  
   - Supabase API (Kong): [http://localhost:8001](http://localhost:8001)  
   - Studio (if you need it): bind is `127.0.0.1:3001`; use `ssh -L 3001:127.0.0.1:3001 localhost` or access via Kong’s `/` with `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD`.

7. **Stop when done:**
   ```bash
   docker compose down
   ```

### Option 2: Next.js dev server + Docker backend (hot reload)

Best for frontend and API development with fast refresh.

1. **Start only the backend (no Next.js container):**
   ```bash
   cp .env.example .env
   bash scripts/generate-secrets.sh   # paste into .env
   # Set URLs to localhost as in Option 1, step 3
   docker compose up -d db kong auth rest realtime storage imgproxy meta studio
   ```
   Omit the `app` service (or run `docker compose up -d` and then stop the `app` container). Ensure Kong is up on port 8001.

2. **Install dependencies and run the dev server:**
   ```bash
   npm install
   npm run dev
   ```

3. **Env for the dev server:**  
   Create `.env.local` (or use `.env`) so Next.js sees:
   - `NEXT_PUBLIC_SUPABASE_URL=http://localhost:8001`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY=<your ANON_KEY from .env>`
   - `NEXT_PUBLIC_APP_URL=http://localhost:3000`
   - `SUPABASE_SERVICE_ROLE_KEY=<your SERVICE_ROLE_KEY from .env>`

4. Open [http://localhost:3000](http://localhost:3000). The app will talk to the local Kong (and thus Auth, Postgres, etc.). Edit code and use hot reload.

5. **Stop:** Stop the Next dev server (Ctrl+C). Run `docker compose down` to stop the backend.

### Quick checks

- **Health:** [http://localhost:3000/api/health](http://localhost:3000/api/health) (when the app is running).
- **Sign up / log in:** Use the app UI; with `ENABLE_EMAIL_AUTOCONFIRM=true` you don’t need to click email links.
- **Database:** Migrations run on first `docker compose up` (via `supabase/migrations/`). For a clean DB, remove volumes: `docker compose down -v` then `docker compose up -d` (this deletes all data).

---

## Summary

| Goal                    | Method                                      |
|-------------------------|---------------------------------------------|
| Deploy on a VPS         | Coolify + Docker Compose or GitHub          |
| Production-like local   | `docker compose up -d` with localhost URLs  |
| Local dev with hot reload | Backend in Docker + `npm run dev` + `.env.local` |

For Coolify, always set **all** variables from `.env` in the Coolify resource (and use the correct app and API domains). For local dev, keep URLs on `http://localhost` and use `ENABLE_EMAIL_AUTOCONFIRM=true` if you don’t need real email.
