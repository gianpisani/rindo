-- ============================================
-- FINTUAL INTEGRATION
-- Tablas para almacenar tokens y datos de inversiones
-- ============================================

-- Tabla para guardar tokens de acceso de Fintual (read-only)
CREATE TABLE IF NOT EXISTS public.fintual_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  token TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  last_synced_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.fintual_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies: cada usuario solo ve su propio token
CREATE POLICY "Users can view own fintual token"
  ON public.fintual_tokens
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own fintual token"
  ON public.fintual_tokens
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own fintual token"
  ON public.fintual_tokens
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own fintual token"
  ON public.fintual_tokens
  FOR DELETE
  USING (auth.uid() = user_id);

-- Tabla para almacenar snapshots de inversiones de Fintual
CREATE TABLE IF NOT EXISTS public.fintual_investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  goal_id TEXT NOT NULL,
  goal_name TEXT NOT NULL,
  nav NUMERIC NOT NULL, -- saldo actual
  deposited NUMERIC NOT NULL, -- total depositado
  profit NUMERIC NOT NULL, -- ganancia/pérdida
  profit_percentage NUMERIC, -- rentabilidad calculada
  fund_name TEXT, -- nombre del fondo (si aplica)
  snapshot_date TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.fintual_investments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own fintual investments"
  ON public.fintual_investments
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own fintual investments"
  ON public.fintual_investments
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own fintual investments"
  ON public.fintual_investments
  FOR DELETE
  USING (auth.uid() = user_id);

-- Índices para performance
CREATE INDEX idx_fintual_tokens_user ON public.fintual_tokens(user_id);
CREATE INDEX idx_fintual_investments_user_date ON public.fintual_investments(user_id, snapshot_date DESC);
CREATE INDEX idx_fintual_investments_goal ON public.fintual_investments(user_id, goal_id, snapshot_date DESC);

-- Comentarios
COMMENT ON TABLE public.fintual_tokens IS 'Tokens de acceso read-only de Fintual por usuario';
COMMENT ON TABLE public.fintual_investments IS 'Snapshots históricos de inversiones de Fintual para tracking';
