-- ============================================================
-- TTLeave — Fix nlp_feedback duplicate rows
-- ============================================================
-- Previous versions called .upsert() without specifying onConflict,
-- causing Supabase/PostgREST to INSERT a new row on every adjustment
-- instead of updating the existing one. This means users may have
-- multiple rows per (user_id, event_id) pair in nlp_feedback.
--
-- This migration:
--   1. Deletes duplicate rows, keeping the most-trained one
--      (highest sample_count, then most recently updated).
--   2. Leaves the schema intact — UNIQUE(user_id, event_id) already
--      exists and enforces the constraint going forward once the
--      application passes onConflict: 'user_id,event_id' correctly.
-- ============================================================

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, event_id
      ORDER BY sample_count DESC, last_updated DESC
    ) AS rn
  FROM public.nlp_feedback
)
DELETE FROM public.nlp_feedback
WHERE id IN (
  SELECT id FROM ranked WHERE rn > 1
);
