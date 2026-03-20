# TTLeave — Database

TTLeave uses **PostgreSQL 15** via the `supabase/postgres` image, which ships with the `auth`, `storage`, and `extensions` schemas pre-configured.

## Migrations

Migrations live in `supabase/migrations/` and are applied by the `migrate` service (part of `docker-compose.supabase.yaml`) on every deploy. They are **idempotent** — safe to re-run.

| File | What it creates |
|---|---|
| `001_initial_schema.sql` | All tables, indexes, foreign keys |
| `002_rls_policies.sql` | Row Level Security policies + `is_admin`, `is_group_member` helpers |
| `003_functions_triggers.sql` | `handle_new_user`, `set_updated_at`, `handle_group_created`, `activate_chain_successors` |
| `004_realtime_publication.sql` | Adds `events`, `event_comments`, `date_adjustments` to the Realtime publication |
| `005_nlp_linear_regression.sql` | NLP feedback table + linear regression columns (`lr_slope`, `lr_intercept`, etc.) |
| `006_*.sql` | Additional NLP/scoring schema updates |
| `007_*.sql` | Additional NLP/scoring schema updates |

Migrations 005–007 are applied on every deploy (always re-run, fully idempotent).

To reset the database completely (deletes all data):
```bash
docker compose down
docker compose -f docker-compose.supabase.yaml down -v
docker compose -f docker-compose.supabase.yaml up -d
docker compose up -d --build
```

---

## Schema overview

### `profiles`
One row per user, created automatically when a user signs up (via the `handle_new_user` trigger on `auth.users`).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | Matches `auth.users.id` |
| `email` | text | Copied from GoTrue on signup |
| `full_name` | text | From OAuth metadata or signup form |
| `avatar_url` | text | From OAuth metadata |
| `role` | text | `'user'` or `'admin'` |
| `created_at` / `updated_at` | timestamptz | Auto-managed |

### `events`
The core entity. Each event has a target date and a countdown.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `owner_id` | uuid FK → profiles | |
| `title` | text | |
| `description` | text | |
| `target_date` | date | The countdown target |
| `original_target_date` | date | Preserved when date is adjusted |
| `is_public` | boolean | Visible without login if true |
| `is_completed` | boolean | |
| `group_id` | uuid FK → groups | Optional — shared with a group |
| `created_at` / `updated_at` | timestamptz | |

### `groups`
Collaborative spaces. Members can share events and view each other's countdowns.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `name` | text | |
| `created_by` | uuid FK → profiles | Auto-added as `owner` via trigger |
| `created_at` / `updated_at` | timestamptz | |

### `group_members`
Join table between groups and profiles.

| Column | Type | Notes |
|---|---|---|
| `group_id` | uuid FK → groups | |
| `user_id` | uuid FK → profiles | |
| `role` | text | `'owner'` or `'member'` |
| `joined_at` | timestamptz | |

### `group_invites`
Token-based invite links for joining a group.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `group_id` | uuid FK → groups | |
| `token` | text UNIQUE | Random token in the invite URL |
| `created_by` | uuid FK → profiles | |
| `expires_at` | timestamptz | Optional expiry |
| `created_at` | timestamptz | |

### `event_chains`
Links two events so that when the predecessor completes, the successor is activated.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `predecessor_id` | uuid FK → events | The event that must complete first |
| `successor_id` | uuid FK → events | The event activated after |
| `link_type` | text | `'relative'` or `'absolute'` |
| `offset_days` | integer | Used when `link_type = 'relative'` — successor's target_date = predecessor's target_date + offset_days |
| `created_at` | timestamptz | |

### `event_comments`
Comments on an event, visible to the event owner and group members.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `event_id` | uuid FK → events | |
| `author_id` | uuid FK → profiles | |
| `content` | text | |
| `created_at` / `updated_at` | timestamptz | |

### `date_adjustments`
Audit log of every date change made to an event.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `event_id` | uuid FK → events | |
| `adjusted_by` | uuid FK → profiles | |
| `old_date` | date | |
| `new_date` | date | |
| `reason` | text | Optional |
| `created_at` | timestamptz | |

### `nlp_feedback`
Stores NLP scoring feedback submitted by users on event date suggestions.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → profiles | |
| `input_text` | text | The raw text the user typed |
| `suggested_date` | date | What the NLP model suggested |
| `accepted` | boolean | Whether the user accepted the suggestion |
| `created_at` | timestamptz | |

---

## Row Level Security

RLS is enabled on all tables. The general rules are:

| Table | Who can read | Who can write |
|---|---|---|
| `profiles` | Own row, or admin | Own row only |
| `events` | Owner, public events (all), group members if group event, admin | Owner only |
| `groups` | Members | Owner (update/delete), any auth user (insert) |
| `group_members` | Members of the same group | Self (insert/delete), group owner (delete others) |
| `group_invites` | Any authenticated user | Group owner |
| `event_chains` | Event owner | Event owner |
| `event_comments` | Event owner + group members if group event | Author (own comments) |
| `date_adjustments` | Own adjustments, event owner | Any authenticated user (on events they can see) |
| `nlp_feedback` | Own rows | Own rows |

### Helper functions

Two `SECURITY DEFINER` SQL functions used inside RLS policies:

```sql
-- True if the current user has role = 'admin' in profiles
public.is_admin() → boolean

-- True if the current user is a member of the given group
public.is_group_member(group_id uuid) → boolean
```

Both have `SET search_path = public, pg_temp` to prevent search path injection attacks.

---

## Triggers

| Trigger | Table | When | What it does |
|---|---|---|---|
| `on_auth_user_created` | `auth.users` | AFTER INSERT | Calls `handle_new_user()` — creates a `profiles` row |
| `on_group_created` | `groups` | AFTER INSERT | Calls `handle_group_created()` — adds creator as `owner` in `group_members` |
| `profiles_updated_at` | `profiles` | BEFORE UPDATE | Sets `updated_at = now()` |
| `events_updated_at` | `events` | BEFORE UPDATE | Sets `updated_at = now()` |
| `comments_updated_at` | `event_comments` | BEFORE UPDATE | Sets `updated_at = now()` |

---

## Realtime

The following tables are added to the `supabase_realtime` publication, enabling live subscriptions from the browser:

- `events`
- `event_comments`
- `date_adjustments`

The browser subscribes using the Supabase JS client:
```ts
supabase.channel('events').on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, handler).subscribe()
```
