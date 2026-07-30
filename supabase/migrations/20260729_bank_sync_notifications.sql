-- ============================================================
-- BANK SYNC NOTIFICATIONS — Notificaciones por mail configurables por banco
-- ============================================================

ALTER TABLE bank_sync_credentials
  ADD COLUMN IF NOT EXISTS notify_email BOOLEAN DEFAULT true NOT NULL;

COMMENT ON COLUMN bank_sync_credentials.notify_email IS 'Si se envían mails de resumen/fallo de sync para este banco';
