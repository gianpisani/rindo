-- ============================================================
-- Bank Sync: add bank_description column to transactions
-- ============================================================

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS bank_description TEXT NULL;

-- Index to accelerate deduplication lookups in the edge function
-- Checks (user_id, date, amount, bank_description) per movement
CREATE INDEX IF NOT EXISTS idx_transactions_bank_dedup
  ON public.transactions (user_id, date, amount, bank_description)
  WHERE bank_description IS NOT NULL;

COMMENT ON COLUMN public.transactions.bank_description IS
  'Descripción original del banco (scraping). NULL para transacciones manuales.';
