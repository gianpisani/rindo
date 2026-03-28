-- ─── Training Sessions: New columns ─────────────────────

-- Race/event support
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS is_race BOOLEAN DEFAULT false;
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS race_name TEXT;
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS race_distance_label TEXT;

-- Workout subtype
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS workout_subtype TEXT;

-- Post-session feedback
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS feeling_rating SMALLINT CHECK (feeling_rating BETWEEN 1 AND 5);
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS post_notes TEXT;
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS actual_duration_minutes INTEGER;
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS actual_distance_meters REAL;
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS actual_avg_hr INTEGER;
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS actual_avg_pace TEXT;

-- Periodization
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS training_phase TEXT;

-- Garmin sync metadata
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS garmin_synced_at TIMESTAMPTZ;
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS garmin_activity_name TEXT;


-- ─── Training Goals: New table ──────────────────────────

CREATE TABLE IF NOT EXISTS training_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_type TEXT NOT NULL,
  sport_type TEXT,
  target_value REAL NOT NULL,
  race_distance TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE training_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own goals"
  ON training_goals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own goals"
  ON training_goals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own goals"
  ON training_goals FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own goals"
  ON training_goals FOR DELETE
  USING (auth.uid() = user_id);
