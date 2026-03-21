-- ============================================================
-- RLS Performance: wrap auth.<function>() in (SELECT ...)
--
-- PostgreSQL re-evaluates auth.uid() / auth.role() for every row
-- unless wrapped in a sub-SELECT, which forces a single evaluation
-- per query. Supabase recommends this for all RLS policies.
-- ============================================================

-- ── PROFILES ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING ((select auth.uid()) = id OR public.is_admin());

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING ((select auth.uid()) = id);

-- ── GROUPS ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "groups_select_member" ON public.groups;
CREATE POLICY "groups_select_member" ON public.groups
  FOR SELECT USING (
    public.is_group_member(id) OR
    (select auth.uid()) = created_by OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "groups_insert_auth" ON public.groups;
CREATE POLICY "groups_insert_auth" ON public.groups
  FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "groups_update_owner" ON public.groups;
CREATE POLICY "groups_update_owner" ON public.groups
  FOR UPDATE USING ((select auth.uid()) = created_by OR public.is_admin());

DROP POLICY IF EXISTS "groups_delete_owner" ON public.groups;
CREATE POLICY "groups_delete_owner" ON public.groups
  FOR DELETE USING ((select auth.uid()) = created_by OR public.is_admin());

-- ── GROUP MEMBERS ─────────────────────────────────────────────
DROP POLICY IF EXISTS "group_members_select" ON public.group_members;
CREATE POLICY "group_members_select" ON public.group_members
  FOR SELECT USING (
    user_id = (select auth.uid()) OR
    public.is_group_member(group_id) OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "group_members_insert_self" ON public.group_members;
CREATE POLICY "group_members_insert_self" ON public.group_members
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "group_members_delete_self_or_owner" ON public.group_members;
CREATE POLICY "group_members_delete_self_or_owner" ON public.group_members
  FOR DELETE USING (
    user_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.group_members gm2
      WHERE gm2.group_id = group_members.group_id
        AND gm2.user_id = (select auth.uid())
        AND gm2.role = 'owner'
    ) OR
    public.is_admin()
  );

-- ── GROUP INVITES ─────────────────────────────────────────────
DROP POLICY IF EXISTS "group_invites_insert_owner" ON public.group_invites;
CREATE POLICY "group_invites_insert_owner" ON public.group_invites
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_id = group_invites.group_id
        AND user_id = (select auth.uid())
        AND role = 'owner'
    )
  );

DROP POLICY IF EXISTS "group_invites_delete_owner" ON public.group_invites;
CREATE POLICY "group_invites_delete_owner" ON public.group_invites
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_id = group_invites.group_id
        AND user_id = (select auth.uid())
        AND role = 'owner'
    ) OR public.is_admin()
  );

DROP POLICY IF EXISTS "group_invites_update_owner" ON public.group_invites;
CREATE POLICY "group_invites_update_owner" ON public.group_invites
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_id = group_invites.group_id
        AND user_id = (select auth.uid())
        AND role = 'owner'
    ) OR public.is_admin()
  );

-- ── EVENTS ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "events_all_owner" ON public.events;
CREATE POLICY "events_all_owner" ON public.events
  FOR ALL USING ((select auth.uid()) = owner_id);

DROP POLICY IF EXISTS "events_select_public" ON public.events;
CREATE POLICY "events_select_public" ON public.events
  FOR SELECT USING (is_public = true AND (select auth.uid()) IS NOT NULL);

-- ── EVENT CHAINS ─────────────────────────────────────────────
DROP POLICY IF EXISTS "chains_select" ON public.event_chains;
CREATE POLICY "chains_select" ON public.event_chains
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.events
      WHERE id = predecessor_id AND (
        owner_id = (select auth.uid()) OR
        is_public = true OR
        (group_id IS NOT NULL AND public.is_group_member(group_id))
      )
    )
  );

DROP POLICY IF EXISTS "chains_insert_owner" ON public.event_chains;
CREATE POLICY "chains_insert_owner" ON public.event_chains
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events
      WHERE id = predecessor_id AND owner_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "chains_delete_owner" ON public.event_chains;
CREATE POLICY "chains_delete_owner" ON public.event_chains
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.events
      WHERE id = predecessor_id AND owner_id = (select auth.uid())
    ) OR public.is_admin()
  );

-- ── EVENT COMMENTS ────────────────────────────────────────────
DROP POLICY IF EXISTS "comments_all_author" ON public.event_comments;
CREATE POLICY "comments_all_author" ON public.event_comments
  FOR ALL USING ((select auth.uid()) = author_id);

DROP POLICY IF EXISTS "comments_select_participant" ON public.event_comments;
CREATE POLICY "comments_select_participant" ON public.event_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id AND (
        e.owner_id = (select auth.uid()) OR
        e.is_public = true OR
        (
          e.group_id IS NOT NULL AND
          public.is_group_member(e.group_id) AND
          e.member_permissions IN ('view_comment', 'can_adjust')
        )
      )
    )
  );

DROP POLICY IF EXISTS "comments_insert_participant" ON public.event_comments;
CREATE POLICY "comments_insert_participant" ON public.event_comments
  FOR INSERT WITH CHECK (
    (select auth.uid()) = author_id AND
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id AND (
        e.owner_id = (select auth.uid()) OR
        (
          e.group_id IS NOT NULL AND
          public.is_group_member(e.group_id) AND
          e.member_permissions IN ('view_comment', 'can_adjust')
        )
      )
    )
  );

-- ── DATE ADJUSTMENTS ─────────────────────────────────────────
DROP POLICY IF EXISTS "adjustments_select_own" ON public.date_adjustments;
CREATE POLICY "adjustments_select_own" ON public.date_adjustments
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "adjustments_select_event_owner" ON public.date_adjustments;
CREATE POLICY "adjustments_select_event_owner" ON public.date_adjustments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.events
      WHERE id = event_id AND owner_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "adjustments_insert" ON public.date_adjustments;
CREATE POLICY "adjustments_insert" ON public.date_adjustments
  FOR INSERT WITH CHECK (
    (select auth.uid()) = user_id AND
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id AND (
        e.owner_id = (select auth.uid()) OR
        (
          e.group_id IS NOT NULL AND
          public.is_group_member(e.group_id) AND
          e.member_permissions = 'can_adjust'
        )
      )
    )
  );

-- ── NLP FEEDBACK ─────────────────────────────────────────────
DROP POLICY IF EXISTS "nlp_feedback_all_own" ON public.nlp_feedback;
CREATE POLICY "nlp_feedback_all_own" ON public.nlp_feedback
  FOR ALL USING ((select auth.uid()) = user_id);

-- ── HELPER FUNCTIONS (also fix auth.uid() inside) ────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (select auth.uid()) AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.is_group_member(p_group_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id AND user_id = (select auth.uid())
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_temp;
