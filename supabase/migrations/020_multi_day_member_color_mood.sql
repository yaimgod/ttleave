-- Feature 1: Multi-day event ranges
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS start_date timestamptz;

-- Feature 2: Per-member color in each group (for team calendar)
ALTER TABLE public.group_members
  ADD COLUMN IF NOT EXISTS member_color varchar(7) NOT NULL DEFAULT '#6366f1';

-- Feature 3: Store VAD valence per adjustment (for weekly mood bar)
ALTER TABLE public.date_adjustments
  ADD COLUMN IF NOT EXISTS vad_v float;
