-- ============================================
-- ADIÓS FINTUAL
-- Fintual deprecó su API: se va el cron, las tablas y la función de push.
-- ============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fintual-daily-sync') THEN
    PERFORM cron.unschedule('fintual-daily-sync');
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.notify_fintual_sync_complete() CASCADE;

DROP TABLE IF EXISTS public.fintual_sync_log;
DROP TABLE IF EXISTS public.fintual_investments;
DROP TABLE IF EXISTS public.fintual_tokens;
