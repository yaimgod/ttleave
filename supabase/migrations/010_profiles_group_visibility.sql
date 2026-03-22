-- ============================================================
-- Allow group co-members to see each other's profiles
--
-- Previously profiles_select_own only allowed auth.uid() = id,
-- so PostgREST JOINs on profiles returned null for other members
-- (group detail page showed count=2 but only rendered own name).
--
-- Fix: also allow SELECT when the viewer and the profile owner
-- share at least one group together.
-- ============================================================

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;

CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (
    -- own profile
    (select auth.uid()) = id
    OR
    -- co-member in any shared group
    EXISTS (
      SELECT 1
      FROM public.group_members gm1
      JOIN public.group_members gm2 ON gm1.group_id = gm2.group_id
      WHERE gm1.user_id = (select auth.uid())
        AND gm2.user_id = profiles.id
    )
    OR
    public.is_admin()
  );
