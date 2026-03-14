-- ============================================================
-- TTLeave — Functions & Triggers
-- ============================================================

-- Auto-create profile when a new user signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER comments_updated_at
  BEFORE UPDATE ON public.event_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- When a group is created, automatically add the creator as 'owner'
CREATE OR REPLACE FUNCTION public.handle_group_created()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_group_created
  AFTER INSERT ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.handle_group_created();

-- When an event chain predecessor completes, activate the successor
-- Note: successor activation is handled at the application layer via a
-- database function that can be called from the API route when an event
-- is marked complete. This keeps business logic explicit and testable.
-- Security: only the event owner can activate successors (prevents IDOR via direct RPC calls).
CREATE OR REPLACE FUNCTION public.activate_chain_successors(p_event_id uuid)
RETURNS void AS $$
DECLARE
  v_chain record;
  v_event record;
BEGIN
  -- Get the completed event
  SELECT * INTO v_event FROM public.events WHERE id = p_event_id;

  IF v_event IS NULL THEN
    RETURN;
  END IF;

  -- Only the event owner (or admin via is_admin()) may activate chain successors
  IF v_event.owner_id IS DISTINCT FROM auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized to activate chain for this event';
  END IF;

  -- Find all successors of this event
  FOR v_chain IN
    SELECT * FROM public.event_chains WHERE predecessor_id = p_event_id
  LOOP
    IF v_chain.link_type = 'relative' THEN
      -- Set successor target_date = predecessor target_date + offset_days
      UPDATE public.events
      SET
        target_date = v_event.target_date + (v_chain.offset_days || ' days')::interval,
        original_target_date = CASE
          WHEN original_target_date = target_date
          THEN v_event.target_date + (v_chain.offset_days || ' days')::interval
          ELSE original_target_date
        END,
        is_completed = false,
        updated_at = now()
      WHERE id = v_chain.successor_id AND is_completed = false;
    ELSE
      -- absolute: successor already has its own target_date set; just ensure not completed
      UPDATE public.events
      SET is_completed = false, updated_at = now()
      WHERE id = v_chain.successor_id AND is_completed = false;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable Realtime on key tables (run after migrations in Supabase dashboard,
-- or via: ALTER PUBLICATION supabase_realtime ADD TABLE ...)
-- Included here as a comment reminder:
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.event_comments;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.date_adjustments;
