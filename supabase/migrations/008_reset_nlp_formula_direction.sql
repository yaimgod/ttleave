-- ============================================================
-- TTLeave — Reset all nlp_feedback rows after formula direction fix
-- ============================================================
-- The LR centred input flipped from (0.5−score) to (score−0.5).
-- Any rows trained under the old direction will produce wrong
-- predictions under the new formula, so reset everything.
-- ============================================================

UPDATE public.nlp_feedback
SET
  lr_slope         = 14.0,
  lr_intercept     = 0.0,
  lr_learning_rate = 0.1,
  sample_count     = 0,
  last_updated     = now();
