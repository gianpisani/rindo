-- ============================================================
-- Fecha de liquidación bancaria + origen de importación + feriados de Chile
--
-- Problema que resuelve: una transferencia hecha en fin de semana (o después
-- del cierre del día bancario) es reportada por el banco con fecha del
-- siguiente día hábil. process-email-v2 la guardaba con la fecha real del
-- email y bank-sync con la fecha del banco, así que la deduplicación —que
-- compara por día calendario exacto— no las reconocía como el mismo
-- movimiento y se generaba un duplicado.
-- ============================================================

-- ── transactions: nuevas columnas ───────────────────────────────────────────

-- Fecha (día hábil) en que el banco liquida el movimiento. Distinta de `date`,
-- que sigue guardando la fecha/hora real de la transacción.
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS bank_settlement_date DATE NULL;

COMMENT ON COLUMN public.transactions.bank_settlement_date IS
  'Fecha (día hábil) en que el banco liquida el movimiento. La escribe process-email-v2 '
  'para transferencias; bank-sync no la necesita porque su `date` ya viene liquidada.';

-- Origen de la fila. Se agrega SIN default a propósito: un ADD COLUMN ... DEFAULT
-- rellenaría las filas existentes, y marcar todo lo histórico como 'manual' sería
-- falso. Las filas previas a esta migración quedan en NULL = origen desconocido.
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS import_source TEXT NULL;

-- El default aplica solo a inserts nuevos: cubre los puntos de inserción manual
-- del frontend y de quick-add sin tener que tocarlos.
ALTER TABLE public.transactions
  ALTER COLUMN import_source SET DEFAULT 'manual';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_import_source_check'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_import_source_check
      CHECK (import_source IS NULL OR import_source IN ('manual', 'email', 'bank-sync', 'wallet'));
  END IF;
END $$;

COMMENT ON COLUMN public.transactions.import_source IS
  'Origen de la fila: manual | email | bank-sync | wallet. NULL en filas previas a la migración.';

-- Acelera el lookup de deduplicación por fecha de liquidación.
CREATE INDEX IF NOT EXISTS idx_transactions_settlement_dedup
  ON public.transactions (user_id, bank_settlement_date, amount)
  WHERE bank_description IS NOT NULL AND bank_settlement_date IS NOT NULL;

-- ── Feriados de Chile ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.chilean_holidays (
  date        DATE PRIMARY KEY,
  title       TEXT NOT NULL,
  type        TEXT,
  inalienable BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Registra qué años ya se resolvieron. Es imprescindible: sin esta tabla,
-- "no hay filas para 2028" es ambiguo entre "nunca se consultó" y "se consultó
-- y vino vacío", y la API de feriados devuelve `data: []` (con status success,
-- no 404) para los años que todavía no publica.
CREATE TABLE IF NOT EXISTS public.chilean_holidays_sync (
  year          INT PRIMARY KEY,
  holiday_count INT NOT NULL,
  synced_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Datos de referencia globales, no por usuario: lectura para cualquier usuario
-- autenticado, escritura solo vía service role (que hace bypass de RLS).
ALTER TABLE public.chilean_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chilean_holidays_sync ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can read holidays" ON public.chilean_holidays;
CREATE POLICY "Anyone authenticated can read holidays"
  ON public.chilean_holidays FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Anyone authenticated can read holidays sync" ON public.chilean_holidays_sync;
CREATE POLICY "Anyone authenticated can read holidays sync"
  ON public.chilean_holidays_sync FOR SELECT
  TO authenticated
  USING (true);

-- Seed 2026-2027 (fuente: https://api.boostr.cl/holidays/{year}.json).
-- Los años faltantes se auto-rellenan desde esa misma API en
-- supabase/functions/_shared/business-day.ts, así que esto es solo un punto
-- de partida para no depender de la red desde el día uno.
INSERT INTO public.chilean_holidays (date, title, type, inalienable) VALUES
  ('2026-01-01', 'Año Nuevo',                                      'Civil', true),
  ('2026-04-03', 'Viernes Santo',                                  'Civil', false),
  ('2026-04-04', 'Sábado Santo',                                   'Civil', false),
  ('2026-05-01', 'Día Nacional del Trabajo',                       'Civil', true),
  ('2026-05-21', 'Día de las Glorias Navales',                     'Civil', false),
  ('2026-06-21', 'Día Nacional de los Pueblos Indígenas',          'Civil', false),
  ('2026-06-29', 'San Pedro y San Pablo',                          'Civil', false),
  ('2026-07-16', 'Día de la Virgen del Carmen',                    'Civil', false),
  ('2026-08-15', 'Asunción de la Virgen',                          'Civil', false),
  ('2026-09-18', 'Independencia Nacional',                         'Civil', true),
  ('2026-09-19', 'Día de las Glorias del Ejército',                'Civil', true),
  ('2026-10-12', 'Encuentro de Dos Mundos',                        'Civil', false),
  ('2026-10-31', 'Día de las Iglesias Evangélicas y Protestantes', 'Civil', false),
  ('2026-11-01', 'Día de Todos los Santos',                        'Civil', false),
  ('2026-12-08', 'Inmaculada Concepción',                          'Civil', false),
  ('2026-12-25', 'Navidad',                                        'Civil', true),

  ('2027-01-01', 'Año Nuevo',                                      'Civil', true),
  ('2027-03-26', 'Viernes Santo',                                  'Civil', false),
  ('2027-03-27', 'Sábado Santo',                                   'Civil', false),
  ('2027-05-01', 'Día Nacional del Trabajo',                       'Civil', true),
  ('2027-05-21', 'Día de las Glorias Navales',                     'Civil', false),
  ('2027-06-21', 'Día Nacional de los Pueblos Indígenas',          'Civil', false),
  ('2027-06-28', 'San Pedro y San Pablo',                          'Civil', false),
  ('2027-07-16', 'Día de la Virgen del Carmen',                    'Civil', false),
  ('2027-08-15', 'Asunción de la Virgen',                          'Civil', false),
  ('2027-09-17', 'Feriado Adicional Fiestas Patrias',              'Civil', false),
  ('2027-09-18', 'Independencia Nacional',                         'Civil', true),
  ('2027-09-19', 'Día de las Glorias del Ejército',                'Civil', true),
  ('2027-10-11', 'Encuentro de Dos Mundos',                        'Civil', false),
  ('2027-10-31', 'Día de las Iglesias Evangélicas y Protestantes', 'Civil', false),
  ('2027-11-01', 'Día de Todos los Santos',                        'Civil', false),
  ('2027-12-08', 'Inmaculada Concepción',                          'Civil', false),
  ('2027-12-25', 'Navidad',                                        'Civil', true)
ON CONFLICT (date) DO NOTHING;

INSERT INTO public.chilean_holidays_sync (year, holiday_count) VALUES
  (2026, 16),
  (2027, 17)
ON CONFLICT (year) DO NOTHING;
