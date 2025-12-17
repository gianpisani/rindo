-- ============================================
-- FINTUAL CRON JOB CON PG_CRON
-- Sincronización automática diaria a las 7:30 PM
-- Solo de lunes a viernes (mercado abierto)
-- ============================================

-- Habilitar extensión pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Tabla para logging de sincronizaciones
CREATE TABLE IF NOT EXISTS fintual_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_date TIMESTAMPTZ DEFAULT now() NOT NULL,
  users_synced INTEGER DEFAULT 0,
  goals_synced INTEGER DEFAULT 0,
  errors_count INTEGER DEFAULT 0,
  duration_ms INTEGER,
  status TEXT CHECK (status IN ('success', 'partial', 'failed')),
  error_details JSONB
);

ALTER TABLE fintual_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage sync logs"
  ON fintual_sync_log
  USING (true)
  WITH CHECK (true);

-- Programar cron job que llama a la Edge Function
-- Ejecuta de lunes a viernes a las 22:30 UTC (19:30 Chile)
SELECT cron.schedule(
  'fintual-daily-sync',
  '30 22 * * 1-5',
  $$
    SELECT net.http_post(
      url := 'https://fxlztcwqmlmhqwzbrebo.supabase.co/functions/v1/fintual-sync-all',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      )
    );
  $$
);

COMMENT ON TABLE fintual_sync_log IS 'Log de sincronizaciones automáticas de Fintual';

-- Para ver los cron jobs activos:
-- SELECT * FROM cron.job;

-- Para ver el historial de ejecuciones:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;

-- Para eliminar el cron job si es necesario:
-- SELECT cron.unschedule('fintual-daily-sync');
