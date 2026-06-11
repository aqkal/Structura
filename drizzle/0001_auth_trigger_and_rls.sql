-- ─────────────────────────────────────────────────────────────
-- Custom migration: mirror auth.users → public.users + RLS
-- ─────────────────────────────────────────────────────────────

-- 1) Function that copies a newly-created auth.users row into public.users.
--    SECURITY DEFINER so it can write to public.users regardless of caller.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'full_name'
    ),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 2) Trigger that fires the function on every new auth.users insert.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- 3) Enable Row Level Security on every table.
--    With RLS on and NO policies, nothing is readable/writable
--    via the anon/publishable key — only the service-role key
--    can touch the data. Then we add specific allow-policies below.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.steps               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hints               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.confidence_ratings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retrospectives      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_pins      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_tasks     ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────
-- 4) Policies. Pattern: each authenticated user can only see/modify
--    rows where they're the owner. Subjects are read-only public.
-- ─────────────────────────────────────────────────────────────

-- users: a user can read/update only their own profile row.
CREATE POLICY "users_self_select" ON public.users
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "users_self_update" ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- subjects: read-only, available to everyone (incl. anon).
CREATE POLICY "subjects_public_read" ON public.subjects
  FOR SELECT TO anon, authenticated
  USING (true);

-- sessions: full CRUD on your own rows.
CREATE POLICY "sessions_own_all" ON public.sessions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- steps: tied to sessions you own.
CREATE POLICY "steps_via_session" ON public.steps
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = steps.session_id AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = steps.session_id AND s.user_id = auth.uid()
    )
  );

-- hints: tied to steps -> sessions you own.
CREATE POLICY "hints_via_step" ON public.hints
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.steps st
      JOIN public.sessions s ON s.id = st.session_id
      WHERE st.id = hints.step_id AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.steps st
      JOIN public.sessions s ON s.id = st.session_id
      WHERE st.id = hints.step_id AND s.user_id = auth.uid()
    )
  );

-- confidence_ratings: tied to sessions you own.
CREATE POLICY "confidence_via_session" ON public.confidence_ratings
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = confidence_ratings.session_id AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = confidence_ratings.session_id AND s.user_id = auth.uid()
    )
  );

-- retrospectives: tied to sessions you own.
CREATE POLICY "retrospectives_via_session" ON public.retrospectives
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = retrospectives.session_id AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = retrospectives.session_id AND s.user_id = auth.uid()
    )
  );

-- portfolio_pins: owner has full CRUD; anyone can READ pins marked public.
CREATE POLICY "portfolio_owner_all" ON public.portfolio_pins
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = portfolio_pins.session_id AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = portfolio_pins.session_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "portfolio_public_read" ON public.portfolio_pins
  FOR SELECT TO anon, authenticated
  USING (is_public = true);

-- scheduled_tasks: a user can see their own scheduled tasks.
-- The cron worker uses the service-role key, which bypasses RLS, so it
-- can read every pending row without needing a separate policy.
CREATE POLICY "scheduled_own_select" ON public.scheduled_tasks
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- 5) Seed initial subjects.
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.subjects (slug, label, sort_order) VALUES
  ('calculus',    'Calculus',    1),
  ('algebra',     'Algebra',     2),
  ('programming', 'Programming', 3),
  ('statistics',  'Statistics',  4),
  ('physics',     'Physics',     5),
  ('other',       'Other',       99)
ON CONFLICT (slug) DO NOTHING;
