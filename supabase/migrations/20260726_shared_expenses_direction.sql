-- Soporta deudas en ambas direcciones sobre shared_expenses:
--   'they_owe_me'  (default, comportamiento actual: a mí me deben)
--   'i_owe_them'   (nuevo: yo le debo a alguien)
--
-- debtor_name se reutiliza como "nombre de la contraparte" en ambas direcciones
-- (quién me debe, o a quién le debo) — direction desambigua el rol.

ALTER TABLE public.shared_expenses
  ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'they_owe_me';

ALTER TABLE public.shared_expenses
  DROP CONSTRAINT IF EXISTS shared_expenses_direction_check;
ALTER TABLE public.shared_expenses
  ADD CONSTRAINT shared_expenses_direction_check
  CHECK (direction IN ('they_owe_me', 'i_owe_them'));

-- transaction_id pasa a nullable: una deuda "i_owe_them" registrada
-- manualmente no tiene un Gasto real previo (se vincula recién al saldarla).
-- Para "they_owe_me" se sigue exigiendo a nivel de constraint.
ALTER TABLE public.shared_expenses
  ALTER COLUMN transaction_id DROP NOT NULL;

ALTER TABLE public.shared_expenses
  DROP CONSTRAINT IF EXISTS shared_expenses_transaction_required_when_owed;
ALTER TABLE public.shared_expenses
  ADD CONSTRAINT shared_expenses_transaction_required_when_owed
  CHECK (direction = 'i_owe_them' OR transaction_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_shared_expenses_direction
  ON public.shared_expenses(user_id, direction, paid);

-- DROP + CREATE (no CREATE OR REPLACE): el orden de columnas de la vista
-- existente no coincide con el original asumido, y Postgres no permite
-- reordenar/renombrar columnas de una vista vía REPLACE.
DROP VIEW IF EXISTS public.shared_expenses_with_transaction;

-- LEFT JOIN porque transaction_id ahora puede ser null.
-- security_invoker = on es obligatorio: sin esto, la vista corre con los
-- permisos del owner (el rol de la migración, que hace BYPASSRLS) y expone
-- las filas de TODOS los usuarios, ignorando las policies de RLS de
-- shared_expenses/transactions. La vista original ya lo tenía seteado
-- (por eso nunca se vio el problema hasta que se recreó sin esta opción).
CREATE VIEW public.shared_expenses_with_transaction
WITH (security_invoker = on) AS
SELECT
  se.id,
  se.user_id,
  se.transaction_id,
  se.debtor_name,
  se.amount_owed,
  se.paid,
  se.paid_at,
  se.paid_transaction_id,
  se.direction,
  se.created_at,
  t.date AS transaction_date,
  t.detail AS transaction_detail,
  t.amount AS transaction_amount,
  t.category_name AS transaction_category
FROM public.shared_expenses se
LEFT JOIN public.transactions t ON t.id = se.transaction_id;

-- Re-otorgar los grants que se pierden al recrear la vista (mismo patrón
-- usado para credit_card_summary en 20260223_credit_card_last4.sql)
GRANT SELECT ON public.shared_expenses_with_transaction TO authenticated;

-- Filtrar explícitamente por direction para no mezclar con deudas "i_owe_them"
CREATE OR REPLACE FUNCTION public.get_pending_by_debtor(p_user_id uuid)
RETURNS TABLE(debtor_name text, total_owed numeric, count_expenses bigint)
LANGUAGE sql STABLE
AS $$
  SELECT debtor_name, SUM(amount_owed) AS total_owed, COUNT(*) AS count_expenses
  FROM public.shared_expenses
  WHERE user_id = p_user_id AND paid = false AND direction = 'they_owe_me'
  GROUP BY debtor_name;
$$;

-- Función simétrica para deudas que yo debo. debtor_name se remapea a
-- creditor_name en el resultado (misma columna física, distinto rol).
CREATE OR REPLACE FUNCTION public.get_pending_by_creditor(p_user_id uuid)
RETURNS TABLE(creditor_name text, total_owed numeric, count_expenses bigint)
LANGUAGE sql STABLE
AS $$
  SELECT debtor_name AS creditor_name, SUM(amount_owed) AS total_owed, COUNT(*) AS count_expenses
  FROM public.shared_expenses
  WHERE user_id = p_user_id AND paid = false AND direction = 'i_owe_them'
  GROUP BY debtor_name;
$$;
