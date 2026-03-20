# TTLeave — Debugging Guide

A step-by-step methodology for diagnosing auth failures and other silent issues in this stack.

---

## The incident that prompted this guide

**Symptom:** User created via the Supabase Studio Admin dashboard could not log in. Login appeared to succeed (no error shown in the UI), but the user was silently redirected back to `/login`.

**Root cause:** `NEXT_PUBLIC_SUPABASE_URL=http://localhost:8001` was used for both browser and server-side requests. The browser can reach `localhost:8001` (Kong, exposed on the host), but the Next.js server running _inside_ a Docker container cannot — `localhost` inside that container refers to the container itself, not the host. So every server-side `auth.getUser()` call in the middleware silently failed with a connection refused error, meaning the middleware never saw a valid session and redirected the user back to `/login`.

**Fix:** Added `SUPABASE_URL=http://kong:8000` as a separate env var for server-side use only. Kong is reachable as `kong:8000` from inside the Docker network (`ttleave_shared`). The server client and middleware now prefer `SUPABASE_URL` when available, while the browser continues to use `NEXT_PUBLIC_SUPABASE_URL`.

---

## How to debug an auth failure: the full methodology

When a user cannot log in or sign up, work through these layers in order — from the outside in.

### Layer 1 — What does the UI actually show?

Before going to logs, be precise about the symptom:

| Symptom | What it means |
|---|---|
| Error message shown (e.g. "Invalid login credentials") | GoTrue rejected the credentials — the problem is in auth itself |
| Spinner then nothing | Client-side JS threw a silent error — check the browser console |
| Form submits, then redirected back to login | Login succeeded but something server-side failed after |
| Confirmation email never arrived | SMTP misconfiguration — check all `SMTP_*` vars and provider logs |
| Login works but app is blank/broken | Session was established but a data fetch (RLS) failed |

Open the **browser developer tools** (F12) → Network tab → filter by `auth/v1` and watch what happens during login. Every Supabase auth call goes through Kong at `/auth/v1/*`.

---

### Layer 2 — Check the GoTrue logs

```bash
docker compose -f docker-compose.supabase.yaml logs auth --tail=50
```

GoTrue logs every request as structured JSON. Look for:
- `"status":400` or `"status":500` — server-side auth error
- `"error":` field — the actual failure reason
- `"action":"login"` with no following `"action":"token_refreshed"` — session was not established

Common errors and what they mean:

| Log message | Cause |
|---|---|
| `dial tcp: lookup smtp.xxx` | SMTP host doesn't exist — check `SMTP_HOST` in `.env.supabase` |
| `Error sending confirmation email` | SMTP misconfiguration — check all `SMTP_*` vars |
| `provider is not enabled` | OAuth provider requested but not configured in GoTrue env |
| `invalid JWT` | `ANON_KEY` or `SERVICE_ROLE_KEY` contains spaces — regenerate with `generate-secrets.sh` |
| `password authentication failed for user "supabase_auth_admin"` | `migrate` service didn't run or failed — check `docker compose -f docker-compose.supabase.yaml logs migrate` |

---

### Layer 3 — Check the database directly

```bash
PGPASS=$(grep '^POSTGRES_PASSWORD=' .env.supabase | cut -d= -f2-)
docker exec -it ttleave-db-1 psql "postgresql://supabase_admin:${PGPASS}@localhost:5432/postgres"
```

#### 3a — Check the audit log

Every GoTrue event (signup, login, logout, password reset) is recorded in `auth.audit_log_entries`:

```sql
-- Recent events for a specific email
SELECT
  created_at,
  payload->>'action'       AS action,
  payload->>'actor_username' AS email,
  payload->'traits'        AS traits
FROM auth.audit_log_entries
WHERE payload->>'actor_username' = 'user@example.com'
ORDER BY created_at DESC
LIMIT 20;
```

Key actions to look for:
- `user_signedup` — account was created
- `login` — password was verified, JWT was issued
- `token_refreshed` — session was renewed
- `user_confirmation_requested` — confirmation email was sent
- `user_modified` — admin changed the user

If you see `login` entries but the user still can't get in, the problem is **after** JWT issuance — in the app layer (middleware, RLS, missing profile row).

#### 3b — Check the user record

```sql
SELECT
  id,
  email,
  email_confirmed_at,   -- NULL = not confirmed yet
  banned_until,          -- non-NULL = banned
  deleted_at,            -- non-NULL = soft-deleted
  encrypted_password     -- empty = OAuth-only account (no password)
FROM auth.users
WHERE email = 'user@example.com';
```

Common issues:
- `email_confirmed_at IS NULL` — user never clicked the confirmation link
- `encrypted_password = ''` — account was created without a password (e.g. admin-created with no password set)
- `banned_until` in the future — account is banned

#### 3c — Check the profiles row

GoTrue creates users in `auth.users`. Your `handle_new_user` trigger then creates a row in `public.profiles`. If the trigger failed, the profile row is missing — and every RLS policy that references `profiles` will silently block the user.

```sql
-- Does a profiles row exist?
SELECT * FROM public.profiles WHERE id = '<user-id-from-auth.users>';

-- If missing, create it manually:
INSERT INTO public.profiles (id, email, full_name, avatar_url)
SELECT id, email, raw_user_meta_data->>'full_name', raw_user_meta_data->>'avatar_url'
FROM auth.users
WHERE id = '<user-id>';
```

#### 3d — Check for active sessions

```sql
SELECT id, created_at, not_after, refreshed_at
FROM auth.sessions
WHERE user_id = '<user-id>'
ORDER BY created_at DESC;
```

If sessions exist but the app keeps bouncing back to `/login`, the problem is in middleware — the server-side `getUser()` call is failing silently (see Layer 4).

---

### Layer 4 — Check internal network connectivity

This is the cause of the incident above. The Next.js server runs inside a Docker container. Any server-side code (middleware, Server Components, route handlers) that calls Supabase must reach Kong via the **internal Docker network** (`http://kong:8000`), not via `localhost:8001` which only works from the host machine.

Both the App stack (`docker-compose.yaml`) and the Supabase stack (`docker-compose.supabase.yaml`) must share the `ttleave_shared` Docker network for this to work.

**Test from inside the app container:**
```bash
# Can the app container reach Kong internally?
docker exec ttleave-app-1 wget -qO- http://kong:8000/auth/v1/health \
  --header "apikey: <ANON_KEY>" 2>&1

# Can it reach localhost:8001? (it should NOT be able to)
docker exec ttleave-app-1 wget -qO- http://localhost:8001/auth/v1/health 2>&1
```

If the first command fails (connection refused), your internal routing is broken — check that both stacks are up and sharing the `ttleave_shared` network:
```bash
docker network inspect ttleave_shared
```
Both the app container and kong container should appear in the output.

If the second succeeds, your server-side code is misconfigured — it's accidentally using the browser-facing URL.

**The fix:** ensure the app has `SUPABASE_URL=http://kong:8000` set as an env var (in `.env.app` or Coolify's env panel), and that server-side Supabase clients use `process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL`.

---

### Layer 5 — Check RLS policies

If login succeeds and the user lands on the app but sees no data or gets kicked out, RLS policies may be blocking them. Test as the specific user:

```sql
-- Temporarily set the role and JWT to simulate a specific user
SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<user-id>","role":"authenticated"}';

-- Now test what they can see
SELECT * FROM public.events;
SELECT * FROM public.profiles WHERE id = '<user-id>';
```

If these return nothing (or error), find the blocking policy:

```sql
-- List all policies on a table
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'events' AND schemaname = 'public';
```

---

### Layer 6 — Check Kong routing

If the browser gets unexpected 401 or 403 errors for all API calls, Kong may have loaded config incorrectly (e.g. env vars not substituted in `kong.yml`).

**Test whether Kong is accepting your ANON_KEY:**
```bash
ANON_KEY=$(grep '^ANON_KEY=' .env.supabase | cut -d= -f2-)
curl -s http://localhost:8001/rest/v1/ -H "apikey: $ANON_KEY" | head -c 100
```

If this returns `No API key found in request` or `Invalid authentication credentials`, Kong loaded the literal string `${SUPABASE_ANON_KEY}` instead of the real key — meaning the `kong-entrypoint.sh` env substitution failed.

Check:
```bash
# Did the rendered kong.yml get the real JWT value?
docker exec ttleave-kong-1 grep -c 'eyJ' /home/kong/kong.yml
# Should print 2 (one for ANON, one for SERVICE_ROLE)

docker compose -f docker-compose.supabase.yaml logs kong | grep -i error
```

---

## Quick-reference checklist

When a user can't log in, run through this in order:

```
1. Browser devtools → Network → what does /auth/v1/token return?
2. docker compose -f docker-compose.supabase.yaml logs auth --tail=50 → any error lines?
3. SELECT * FROM auth.users WHERE email = '...' → confirmed? banned? has password?
4. SELECT * FROM public.profiles WHERE id = '<id>' → profile row exists?
5. SELECT * FROM auth.audit_log_entries WHERE actor_username = '...' → login recorded?
6. SELECT * FROM auth.sessions WHERE user_id = '<id>' → sessions issued?
7. docker exec ttleave-app-1 wget -qO- http://kong:8000/auth/v1/health → internal network OK?
8. curl localhost:8001/rest/v1/ -H "apikey: $ANON_KEY" → Kong accepting keys?
```

If steps 1–6 all pass (login recorded, session issued, profile exists) but the user still bounces to `/login`, the problem is always in **Layer 4** — server-side code cannot reach the Supabase URL it's been given.
