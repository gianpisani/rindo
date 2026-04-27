-- ============================================================
-- BANK SYNC CRON — Sincronización bancaria automática configurable
-- ============================================================

-- Tabla de credenciales bancarias encriptadas por usuario
CREATE TABLE IF NOT EXISTS bank_sync_credentials (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank                 TEXT NOT NULL,
  rut                  TEXT NOT NULL,                  -- RUT en claro (para mostrar en UI)
  encrypted_password   TEXT NOT NULL,                  -- AES-256-GCM ciphertext (at-rest)
  key_version          SMALLINT DEFAULT 1 NOT NULL,    -- para rotación de llave
  is_active            BOOLEAN DEFAULT true NOT NULL,
  -- Horario de sync: daily_08, daily_14, daily_20, twice_daily, disabled
  sync_schedule        TEXT DEFAULT 'daily_20' NOT NULL,
  last_sync_at         TIMESTAMPTZ,
  last_sync_status     TEXT CHECK (last_sync_status IN ('success', 'failed', '2fa_blocked', 'invalid_credentials')),
  last_error           TEXT,
  consecutive_failures SMALLINT DEFAULT 0 NOT NULL,
  created_at           TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at           TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, bank)
);

ALTER TABLE bank_sync_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own bank credentials"
  ON bank_sync_credentials
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Tabla de log de sincronizaciones (una fila por banco por ejecución)
CREATE TABLE IF NOT EXISTS bank_sync_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank           TEXT NOT NULL,
  trigger        TEXT NOT NULL CHECK (trigger IN ('cron', 'manual')),
  sync_date      TIMESTAMPTZ DEFAULT now() NOT NULL,
  imported       INTEGER DEFAULT 0 NOT NULL,
  skipped        INTEGER DEFAULT 0 NOT NULL,
  status         TEXT NOT NULL CHECK (status IN ('success', 'failed', '2fa_blocked', 'invalid_credentials')),
  error          TEXT,
  imported_items JSONB,  -- [{date, description, amount, type}]
  skipped_items  JSONB,  -- [{date, description, amount, type, reason}]
  created_at     TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE bank_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own sync logs"
  ON bank_sync_log
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages sync logs"
  ON bank_sync_log
  USING (true)
  WITH CHECK (true);

-- Índice para consultas del historial por usuario y banco
CREATE INDEX IF NOT EXISTS bank_sync_log_user_bank_idx
  ON bank_sync_log(user_id, bank, sync_date DESC);

-- Trigger para actualizar updated_at en bank_sync_credentials
CREATE OR REPLACE FUNCTION update_bank_sync_credentials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bank_sync_credentials_updated_at
  BEFORE UPDATE ON bank_sync_credentials
  FOR EACH ROW EXECUTE FUNCTION update_bank_sync_credentials_updated_at();

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Programar cron job cada hora — la edge function filtra según sync_schedule
SELECT cron.schedule(
  'bank-sync-hourly',
  '0 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://fxlztcwqmlmhqwzbrebo.supabase.co/functions/v1/bank-sync-all',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      )
    );
  $$
);

COMMENT ON TABLE bank_sync_credentials IS 'Credenciales bancarias encriptadas para sync automático';
COMMENT ON TABLE bank_sync_log IS 'Historial de sincronizaciones bancarias (cron y manual)';

-- Para ver cron jobs activos:
-- SELECT * FROM cron.job;

-- Para eliminar el cron job:
-- SELECT cron.unschedule('bank-sync-hourly');
