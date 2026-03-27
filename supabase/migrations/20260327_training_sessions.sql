-- Training Sessions table for weekly training plans
CREATE TABLE public.training_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_date DATE NOT NULL,
  week_start_date DATE NOT NULL,
  time_of_day TEXT NOT NULL DEFAULT 'morning',
  scheduled_time TEXT,
  sport_type TEXT NOT NULL,
  session_name TEXT NOT NULL,
  description TEXT,
  target_duration_minutes INTEGER,
  target_distance_meters REAL,
  target_hr_zone INTEGER,
  target_hr_min INTEGER,
  target_hr_max INTEGER,
  target_pace_min_km TEXT,
  target_power_watts INTEGER,
  intensity TEXT NOT NULL DEFAULT 'moderate',
  status TEXT NOT NULL DEFAULT 'pending',
  garmin_activity_id BIGINT,
  completed_at TIMESTAMPTZ,
  coach_notes TEXT,
  plan_context TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_training_user_week ON training_sessions(user_id, week_start_date);

ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own training sessions"
  ON training_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own training sessions"
  ON training_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own training sessions"
  ON training_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own training sessions"
  ON training_sessions FOR DELETE
  USING (auth.uid() = user_id);
