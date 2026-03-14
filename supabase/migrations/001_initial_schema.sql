-- ============================================================
-- TTLeave — Initial Schema
-- ============================================================

-- PROFILES (extends auth.users 1-to-1)
CREATE TABLE public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       text NOT NULL,
  full_name   text,
  avatar_url  text,
  role        text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- GROUPS
CREATE TABLE public.groups (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  created_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- GROUP MEMBERS
CREATE TABLE public.group_members (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id  uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role      text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

CREATE INDEX idx_group_members_group_id ON public.group_members(group_id);
CREATE INDEX idx_group_members_user_id  ON public.group_members(user_id);

-- GROUP INVITES (shareable link tokens)
CREATE TABLE public.group_invites (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  token      text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  max_uses   integer DEFAULT NULL,  -- NULL = unlimited
  use_count  integer NOT NULL DEFAULT 0,
  expires_at timestamptz DEFAULT NULL,  -- NULL = never
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_group_invites_group_id ON public.group_invites(group_id);
CREATE INDEX idx_group_invites_token    ON public.group_invites(token);

-- EVENTS (core — all three event types)
CREATE TABLE public.events (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id             uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  group_id             uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  title                text NOT NULL,
  description          text,
  event_type           text NOT NULL CHECK (event_type IN ('set_date', 'linked', 'mutable')),
  target_date          timestamptz NOT NULL,
  original_target_date timestamptz NOT NULL,
  is_completed         boolean NOT NULL DEFAULT false,
  is_public            boolean NOT NULL DEFAULT false,
  -- 'view_only' | 'view_comment' | 'can_adjust'
  member_permissions   text NOT NULL DEFAULT 'view_comment'
                         CHECK (member_permissions IN ('view_only', 'view_comment', 'can_adjust')),
  color                text NOT NULL DEFAULT '#6366f1',
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_events_owner_id   ON public.events(owner_id);
CREATE INDEX idx_events_group_id   ON public.events(group_id);
CREATE INDEX idx_events_target_date ON public.events(target_date);

-- EVENT CHAINS (sequence links between events)
CREATE TABLE public.event_chains (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_name          text,
  predecessor_id      uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  successor_id        uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  -- 'relative' = offset_days after predecessor ends; 'absolute' = fixed date
  link_type           text NOT NULL CHECK (link_type IN ('relative', 'absolute')),
  offset_days         integer,
  absolute_start_date timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (predecessor_id, successor_id)
);

CREATE INDEX idx_chains_predecessor ON public.event_chains(predecessor_id);
CREATE INDEX idx_chains_successor   ON public.event_chains(successor_id);

-- EVENT COMMENTS
CREATE TABLE public.event_comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  author_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_comments_event_id   ON public.event_comments(event_id);
CREATE INDEX idx_comments_created_at ON public.event_comments(created_at DESC);

-- DATE ADJUSTMENTS (full audit log for mutable events)
CREATE TABLE public.date_adjustments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason_text      text NOT NULL,
  sentiment_score  integer NOT NULL CHECK (sentiment_score BETWEEN 0 AND 100),
  days_suggested   integer NOT NULL,
  days_chosen      integer NOT NULL,
  date_before      timestamptz NOT NULL,
  date_after       timestamptz NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_adjustments_event_id ON public.date_adjustments(event_id);
CREATE INDEX idx_adjustments_user_id  ON public.date_adjustments(user_id);

-- NLP FEEDBACK (per-user-per-event EMA state for adaptation)
CREATE TABLE public.nlp_feedback (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id     uuid REFERENCES public.events(id) ON DELETE SET NULL,
  ema_ratio    float NOT NULL DEFAULT 1.0,
  ema_alpha    float NOT NULL DEFAULT 0.3,
  sample_count integer NOT NULL DEFAULT 0,
  last_updated timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_id)
);

CREATE INDEX idx_nlp_feedback_user_id ON public.nlp_feedback(user_id);
