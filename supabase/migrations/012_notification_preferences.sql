-- ============================================================
-- Notification preferences
-- ============================================================
-- Global email opt-in/out on profiles
-- Per-group notification toggle on group_members
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_notifications boolean NOT NULL DEFAULT true;

ALTER TABLE public.group_members
  ADD COLUMN IF NOT EXISTS notifications_enabled boolean NOT NULL DEFAULT true;
