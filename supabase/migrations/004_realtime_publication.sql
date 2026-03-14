-- ============================================================
-- 004_realtime_publication.sql
--
-- Enables Supabase Realtime on the TTLeave tables that need
-- live updates: events, event_comments, date_adjustments.
--
-- The supabase/postgres image creates the `supabase_realtime`
-- publication during its own init. This migration adds our
-- application tables to it after the schema is in place.
--
-- The DO block is idempotent — safe to re-run.
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN

    -- events: calendar auto-refresh when target_date changes
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'events'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
    END IF;

    -- event_comments: live comment feed on the event detail page
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'event_comments'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.event_comments;
    END IF;

    -- date_adjustments: live notifications when a mutable date is adjusted
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'date_adjustments'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.date_adjustments;
    END IF;

  END IF;
END $$;
