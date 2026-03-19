-- ============================================================
-- TTLeave — Reset nlp_feedback rows to new LR model defaults
-- ============================================================
-- The LR model formula changed from:
--   days = slope × score + intercept          (old, slope default 1.0)
-- to:
--   days = slope × (0.5 − score) + intercept  (new, slope default 14.0)
--
-- Rows with lr_slope = 1.0 (the old default) were never meaningfully
-- trained (the upsert bug also meant most updates were lost). Reset
-- them to the new defaults so they start from the correct base curve.
-- Rows with lr_slope ≠ 1.0 had at least one real update; preserve them
-- (they will re-learn under the new formula naturally).
-- ============================================================

UPDATE public.nlp_feedback
SET
  lr_slope         = 14.0,
  lr_intercept     = 0.0,
  lr_learning_rate = 0.1,
  sample_count     = 0,
  last_updated     = now()
WHERE lr_slope = 1.0;
