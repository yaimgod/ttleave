-- ============================================================
-- TTLeave — Row Level Security Policies
-- ============================================================

-- Helper: check if the current user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

-- Helper: check if user is a member of a group
CREATE OR REPLACE FUNCTION public.is_group_member(p_group_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

-- ── PROFILES ─────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- ── GROUPS ───────────────────────────────────────────────────
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "groups_select_member" ON public.groups
  FOR SELECT USING (
    public.is_group_member(id) OR
    auth.uid() = created_by OR
    public.is_admin()
  );

CREATE POLICY "groups_insert_auth" ON public.groups
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "groups_update_owner" ON public.groups
  FOR UPDATE USING (auth.uid() = created_by OR public.is_admin());

CREATE POLICY "groups_delete_owner" ON public.groups
  FOR DELETE USING (auth.uid() = created_by OR public.is_admin());

-- ── GROUP MEMBERS ─────────────────────────────────────────────
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group_members_select" ON public.group_members
  FOR SELECT USING (
    user_id = auth.uid() OR
    public.is_group_member(group_id) OR
    public.is_admin()
  );

CREATE POLICY "group_members_insert_self" ON public.group_members
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "group_members_delete_self_or_owner" ON public.group_members
  FOR DELETE USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.group_members gm2
      WHERE gm2.group_id = group_members.group_id
        AND gm2.user_id = auth.uid()
        AND gm2.role = 'owner'
    ) OR
    public.is_admin()
  );

-- ── GROUP INVITES ─────────────────────────────────────────────
ALTER TABLE public.group_invites ENABLE ROW LEVEL SECURITY;

-- Anyone (even unauthenticated) can read a token to preview the group
CREATE POLICY "group_invites_select_all" ON public.group_invites
  FOR SELECT USING (true);

CREATE POLICY "group_invites_insert_owner" ON public.group_invites
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_id = group_invites.group_id
        AND user_id = auth.uid()
        AND role = 'owner'
    )
  );

CREATE POLICY "group_invites_delete_owner" ON public.group_invites
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_id = group_invites.group_id
        AND user_id = auth.uid()
        AND role = 'owner'
    ) OR public.is_admin()
  );

CREATE POLICY "group_invites_update_owner" ON public.group_invites
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_id = group_invites.group_id
        AND user_id = auth.uid()
        AND role = 'owner'
    ) OR public.is_admin()
  );

-- ── EVENTS ───────────────────────────────────────────────────
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Owner has full access
CREATE POLICY "events_all_owner" ON public.events
  FOR ALL USING (auth.uid() = owner_id);

-- Public events readable by anyone authenticated
CREATE POLICY "events_select_public" ON public.events
  FOR SELECT USING (is_public = true AND auth.uid() IS NOT NULL);

-- Group members can read shared events (respects member_permissions per event)
-- Note: actual write restriction for adjustments is enforced in date_adjustments RLS
CREATE POLICY "events_select_group_member" ON public.events
  FOR SELECT USING (
    group_id IS NOT NULL AND
    public.is_group_member(group_id) AND
    member_permissions IN ('view_only', 'view_comment', 'can_adjust')
  );

-- Admins can read all
CREATE POLICY "events_select_admin" ON public.events
  FOR SELECT USING (public.is_admin());

-- ── EVENT CHAINS ─────────────────────────────────────────────
ALTER TABLE public.event_chains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chains_select" ON public.event_chains
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.events
      WHERE id = predecessor_id AND (
        owner_id = auth.uid() OR
        is_public = true OR
        (group_id IS NOT NULL AND public.is_group_member(group_id))
      )
    )
  );

CREATE POLICY "chains_insert_owner" ON public.event_chains
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events WHERE id = predecessor_id AND owner_id = auth.uid()
    )
  );

CREATE POLICY "chains_delete_owner" ON public.event_chains
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.events WHERE id = predecessor_id AND owner_id = auth.uid()
    ) OR public.is_admin()
  );

-- ── EVENT COMMENTS ────────────────────────────────────────────
ALTER TABLE public.event_comments ENABLE ROW LEVEL SECURITY;

-- Author manages own comments
CREATE POLICY "comments_all_author" ON public.event_comments
  FOR ALL USING (auth.uid() = author_id);

-- Event participants with view_comment or can_adjust can read comments
CREATE POLICY "comments_select_participant" ON public.event_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id AND (
        e.owner_id = auth.uid() OR
        e.is_public = true OR
        (
          e.group_id IS NOT NULL AND
          public.is_group_member(e.group_id) AND
          e.member_permissions IN ('view_comment', 'can_adjust')
        )
      )
    )
  );

-- Group members with view_comment or can_adjust can insert comments
CREATE POLICY "comments_insert_participant" ON public.event_comments
  FOR INSERT WITH CHECK (
    auth.uid() = author_id AND
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id AND (
        e.owner_id = auth.uid() OR
        (
          e.group_id IS NOT NULL AND
          public.is_group_member(e.group_id) AND
          e.member_permissions IN ('view_comment', 'can_adjust')
        )
      )
    )
  );

-- ── DATE ADJUSTMENTS ─────────────────────────────────────────
ALTER TABLE public.date_adjustments ENABLE ROW LEVEL SECURITY;

-- User sees own adjustments
CREATE POLICY "adjustments_select_own" ON public.date_adjustments
  FOR SELECT USING (auth.uid() = user_id);

-- Event owner sees all adjustments on their events
CREATE POLICY "adjustments_select_event_owner" ON public.date_adjustments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.events WHERE id = event_id AND owner_id = auth.uid()
    )
  );

-- User inserts own adjustments (if they are the event owner OR a can_adjust member)
CREATE POLICY "adjustments_insert" ON public.date_adjustments
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id AND (
        e.owner_id = auth.uid() OR
        (
          e.group_id IS NOT NULL AND
          public.is_group_member(e.group_id) AND
          e.member_permissions = 'can_adjust'
        )
      )
    )
  );

-- ── NLP FEEDBACK ─────────────────────────────────────────────
ALTER TABLE public.nlp_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nlp_feedback_all_own" ON public.nlp_feedback
  FOR ALL USING (auth.uid() = user_id);
