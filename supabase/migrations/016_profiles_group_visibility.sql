-- Allow users to read profiles of people they share a group with.
-- The existing "profiles_select_own" only allows reading your own profile,
-- which causes group member lists to show null for all other members.

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;

CREATE POLICY "profiles_select_own_or_co_member" ON public.profiles
  FOR SELECT USING (
    -- Own profile
    auth.uid() = id
    OR
    -- Admin
    public.is_admin()
    OR
    -- Share at least one group
    EXISTS (
      SELECT 1
      FROM public.group_members gm1
      JOIN public.group_members gm2 ON gm1.group_id = gm2.group_id
      WHERE gm1.user_id = auth.uid()
        AND gm2.user_id = profiles.id
    )
  );
