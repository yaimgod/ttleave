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
| Deployment | Docker Compose |

## Quick start

```bash
cp .env.example .env
bash scripts/generate-secrets.sh   # paste output into top of .env
docker compose up -d
```

Open **http://localhost:3000**.

> **Email / SMTP:** A real transactional SMTP provider (e.g. [Resend](https://resend.com)) is required for auth emails (confirmation, password reset). Set the `SMTP_*` variables in `.env` before starting the stack — see `.env.supabase.example` for the full reference. For local dev you can set `ENABLE_EMAIL_AUTOCONFIRM=true` in `.env` to skip email verification entirely.

## Documentation

| Doc | What it covers |
|---|---|
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Coolify setup, domains, Coolify proxy config, SSH tunnels |
| [SERVICES.md](./SERVICES.md) | Every Docker service, its port, and what it does |
| [AUTH.md](./AUTH.md) | Email auth, Google OAuth, adding GitHub OAuth |
| [DATABASE.md](./DATABASE.md) | Schema overview, migrations, RLS, helper functions |
| [DEBUGGING.md](./DEBUGGING.md) | How to diagnose auth failures and silent errors layer by layer |

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
├── migrations/         # 001 schema · 002 RLS · 003 functions/triggers · 004 realtime
├── kong.yml            # Kong declarative config template
└── kong-entrypoint.sh  # Renders kong.yml at startup (perl env substitution)

scripts/
├── generate-secrets.sh # Generates POSTGRES_PASSWORD, JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY
└── generate-icons.mjs  # PWA icon generation
```
