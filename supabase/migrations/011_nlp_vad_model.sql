-- ============================================================
-- Migrate nlp_feedback from 1-D linear model (slope / intercept)
-- to 3-D VAD linear model (w_v, w_a, w_d, bias).
--
-- Old formula:  days = lr_slope × (score − 0.5) + lr_intercept
-- New formula:  days = lr_w_v × V + lr_w_a × A + lr_w_d × D + lr_bias
--
-- Where V, A, D are the Valence-Arousal-Dominance centroid of the
-- user's text, derived by the Python NLP sidecar from the probability-
-- weighted average of the 7 emotion class VAD anchors.
--
-- Default weights reproduce the ordering:
--   fear ≈ 7 days > hate/anger ≈ 6 days > sadness ≈ 4 days
--                 > neutral ≈ 0 days > joy ≈ −5 days
--
-- Existing rows (if any) are reset to defaults — the old slope/intercept
-- parameters are not convertible to the 3-D space, so starting fresh
-- gives the most predictable behaviour.
-- ============================================================

ALTER TABLE public.nlp_feedback
  DROP COLUMN IF EXISTS lr_slope,
  DROP COLUMN IF EXISTS lr_intercept,
  ADD COLUMN IF NOT EXISTS lr_w_v  double precision NOT NULL DEFAULT -8.0,
  ADD COLUMN IF NOT EXISTS lr_w_a  double precision NOT NULL DEFAULT  4.0,
  ADD COLUMN IF NOT EXISTS lr_w_d  double precision NOT NULL DEFAULT -2.0,
  ADD COLUMN IF NOT EXISTS lr_bias double precision NOT NULL DEFAULT  0.0;

-- Reset lr_learning_rate and sample_count on existing rows so the 3-D model
-- starts fresh rather than inheriting convergence state from the 1-D model.
UPDATE public.nlp_feedback
SET
  lr_w_v          = -8.0,
  lr_w_a          =  4.0,
  lr_w_d          = -2.0,
  lr_bias         =  0.0,
  lr_learning_rate = 0.1,
  sample_count    =  0;
