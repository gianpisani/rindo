-- ============================================================
-- Mes financiero: día en que empieza el periodo mensual de la analítica.
-- 1 = mes calendario. El término es el día anterior al siguiente inicio.
-- ============================================================

ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS period_start_day SMALLINT NOT NULL DEFAULT 1
  CHECK (period_start_day BETWEEN 1 AND 31);

COMMENT ON COLUMN public.user_profiles.period_start_day IS 'Día (1-31) en que empieza el mes financiero del usuario. 1 = mes calendario; en meses más cortos se ajusta al último día.';
