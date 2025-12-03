-- ========================================
-- CATEGORY INSIGHTS - SQL MIGRATION
-- ========================================
-- Ejecuta este SQL en tu proyecto de Supabase
-- (SQL Editor → New Query → Pega esto → Run)
-- ========================================

-- Category Limits table
CREATE TABLE IF NOT EXISTS category_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_name TEXT NOT NULL,
  monthly_limit DECIMAL(12, 2) NOT NULL,
  alert_at_percentage INTEGER DEFAULT 80,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, category_name)
);

-- Enable RLS
ALTER TABLE category_limits ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own category limits"
  ON category_limits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own category limits"
  ON category_limits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own category limits"
  ON category_limits FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own category limits"
  ON category_limits FOR DELETE
  USING (auth.uid() = user_id);

-- Add indexes for faster queries
CREATE INDEX idx_category_limits_user_id ON category_limits(user_id);
CREATE INDEX idx_category_limits_user_category ON category_limits(user_id, category_name);

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_category_limits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-update
CREATE TRIGGER set_category_limits_updated_at
  BEFORE UPDATE ON category_limits
  FOR EACH ROW
  EXECUTE FUNCTION update_category_limits_updated_at();

-- ========================================
-- VERIFICATION QUERIES (opcional)
-- ========================================
-- Descomenta y ejecuta para verificar:

-- SELECT * FROM category_limits LIMIT 1;
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'category_limits';
