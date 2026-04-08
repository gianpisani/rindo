-- ============================================================
-- Tutoring Classes Tracker
-- Tables: tutoring_students, tutoring_classes
-- ============================================================

-- ── Students ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tutoring_students (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.tutoring_students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own students"
  ON public.tutoring_students FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own students"
  ON public.tutoring_students FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own students"
  ON public.tutoring_students FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own students"
  ON public.tutoring_students FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_tutoring_students_user ON public.tutoring_students(user_id);

-- ── Classes ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tutoring_classes (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id          UUID NOT NULL REFERENCES public.tutoring_students(id) ON DELETE CASCADE,
  date                DATE NOT NULL DEFAULT CURRENT_DATE,
  duration_hours      NUMERIC(3,1) NOT NULL DEFAULT 1.0,
  price_per_hour      INTEGER NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'scheduled'
                        CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  is_paid             BOOLEAN NOT NULL DEFAULT false,
  notes               TEXT,
  cancellation_reason TEXT,
  created_at          TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.tutoring_classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own classes"
  ON public.tutoring_classes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own classes"
  ON public.tutoring_classes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own classes"
  ON public.tutoring_classes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own classes"
  ON public.tutoring_classes FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_tutoring_classes_user_date ON public.tutoring_classes(user_id, date DESC);
CREATE INDEX idx_tutoring_classes_student   ON public.tutoring_classes(student_id);
