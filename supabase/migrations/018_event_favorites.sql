-- Users can favourite any event they can see (own or group)
CREATE TABLE public.event_favorites (
  user_id  uuid NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id)    ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, event_id)
);

ALTER TABLE public.event_favorites ENABLE ROW LEVEL SECURITY;

-- Users manage only their own favourites
CREATE POLICY "favorites_all_own" ON public.event_favorites
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
