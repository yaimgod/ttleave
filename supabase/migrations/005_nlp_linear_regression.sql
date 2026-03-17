-- ============================================================
-- TTLeave — Migrate nlp_feedback from EMA to linear regression
-- ============================================================
-- Replaces the EMA (exponential moving average) adaptation columns
-- with per-user online linear regression model parameters.
--
-- Linear model: days = lr_slope * score_0_to_1 + lr_intercept
-- Updated via online gradient descent after each user override.
-- ============================================================

-- Add new LR columns with sensible defaults
ALTER TABLE public.nlp_feedback
  ADD COLUMN IF NOT EXISTS lr_slope         FLOAT NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS lr_intercept     FLOAT NOT NULL DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS lr_learning_rate FLOAT NOT NULL DEFAULT 0.1;

-- Remove old EMA columns (no longer used by the application)
ALTER TABLE public.nlp_feedback
  DROP COLUMN IF EXISTS ema_ratio,
  DROP COLUMN IF EXISTS ema_alpha;

-- Note: sample_count and last_updated are preserved.
-- sample_count still gates cold-start logic (< 3 samples → base curve).
