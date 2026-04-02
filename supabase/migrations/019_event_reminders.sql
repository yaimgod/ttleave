-- Store which reminder intervals the event owner wants (e.g. {30, 7, 1})
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS reminder_days integer[] NOT NULL DEFAULT '{}';

-- Track already-sent reminders to prevent duplicates on re-run
CREATE TABLE public.event_reminders (
  event_id    uuid    NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  days_before integer NOT NULL,
  sent_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, days_before)
);

ALTER TABLE public.event_reminders ENABLE ROW LEVEL SECURITY;

-- Only service role can read/write (cron uses service key)
CREATE POLICY "reminders_service_only" ON public.event_reminders
  FOR ALL USING (false);
