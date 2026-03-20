# TTLeave

A self-hosted countdown and event tracking app. Create events with target dates, track time remaining, chain events together, collaborate in groups, and get NLP-powered date scoring.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), Tailwind CSS, shadcn/ui |
| Auth | Supabase GoTrue (email + Google OAuth) |
| Database | PostgreSQL 15 (via `supabase/postgres`) |
| API gateway | Kong 2.8 (DB-less) |
| Realtime | Supabase Realtime |
| Storage | Supabase Storage + imgproxy |
| Mail | Real transactional SMTP (e.g. Resend) |
| Deployment | Two Docker Compose files (app + supabase), deployed as separate Coolify resources |

## Quick start

```bash
cp .env.supabase.example .env.supabase
cp .env.app.example .env.app
bash scripts/generate-secrets.sh   # paste output into both env files
docker compose -f docker-compose.supabase.yaml up -d   # start Supabase first (creates ttleave_shared network)
docker compose up -d --build                            # then start the app
```

Open **http://localhost:3000**.

> **Email / SMTP:** A real transactional SMTP provider (e.g. [Resend](https://resend.com)) is required for auth emails (confirmation, password reset). Set the `SMTP_*` variables in `.env.supabase` before starting the stack — see `.env.supabase.example` for the full reference. For local dev you can set `ENABLE_EMAIL_AUTOCONFIRM=true` in `.env.supabase` to skip email verification entirely.

## Documentation

| Doc | What it covers |
|---|---|
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Coolify setup, two-resource architecture, domains, SSH tunnels |
| [SERVICES.md](./SERVICES.md) | Every Docker service, its port, which compose file it lives in |
| [AUTH.md](./AUTH.md) | Email auth, Google OAuth, adding GitHub OAuth |
| [DATABASE.md](./DATABASE.md) | Schema overview, migrations, RLS, helper functions |
| [DEBUGGING.md](./DEBUGGING.md) | How to diagnose auth failures and silent errors layer by layer |
| [docs/coolify.md](./docs/coolify.md) | Coolify-specific step-by-step deployment guide |

## Project layout

```
src/
├── app/
│   ├── (app)/          # Authenticated pages: dashboard, events, groups, calendar, admin
│   ├── (auth)/         # login, signup, OAuth callback
│   └── api/            # Route handlers: events, groups, invites, nlp/score, health
├── components/
│   ├── auth/           # LoginForm, SignupForm, OAuthButtons
│   ├── countdown/      # CountdownCard, CountdownTimer, ChainVisualizer
│   ├── calendar/       # CalendarView
│   └── layout/         # Navbar, Sidebar, MobileNav
└── lib/                # Supabase clients, utils

supabase/
├── migrations/         # 001 schema · 002 RLS · 003 functions/triggers · 004 realtime · 005-007 NLP/LR
├── kong.yml            # Kong declarative config template
└── kong-entrypoint.sh  # Renders kong.yml at startup (perl env substitution)

scripts/
├── generate-secrets.sh # Generates POSTGRES_PASSWORD, JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY
└── generate-icons.mjs  # PWA icon generation

docker-compose.yaml          # App stack only (Next.js + NLP sidecar) — joins ttleave_shared network
docker-compose.supabase.yaml # Supabase stack only — creates ttleave_shared network
```
