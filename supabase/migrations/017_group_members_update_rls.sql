-- Allow members to update their own row in group_members
-- (needed for notifications_enabled toggle and other per-member settings)
CREATE POLICY "group_members_update_self" ON public.group_members
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Allow owners to update any member's row in their group
-- (needed for changing member_permissions)
CREATE POLICY "group_members_update_owner" ON public.group_members
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_members.group_id
        AND gm.user_id = auth.uid()
        AND gm.role = 'owner'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_members.group_id
        AND gm.user_id = auth.uid()
        AND gm.role = 'owner'
    )
  );
