-- ============================================================
-- Group default member permissions (broadcast rules)
-- ============================================================
-- default_member_permissions: the permission level automatically
-- assigned to new members when joining via invite link.
-- ============================================================

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS default_member_permissions text NOT NULL DEFAULT 'view_comment'
  CHECK (default_member_permissions IN ('view_only', 'view_comment', 'can_adjust'));
