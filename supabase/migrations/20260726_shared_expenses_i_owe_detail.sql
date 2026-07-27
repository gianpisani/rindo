-- Detalle propio para deudas registradas manualmente.
--
-- Las deudas "they_owe_me" nacen de un Gasto real y muestran su detalle vía
-- transactions.detail (la vista lo expone como transaction_detail). Las deudas
-- "i_owe_them" se registran sin transacción (transaction_id NULL), así que no
-- tenían dónde guardar el detalle que escribe el usuario y se perdía.
--
-- Nombre de archivo: ordena después de 20260726_shared_expenses_direction.sql
-- ("i_owe..." > "direction"), que es quien crea la versión previa de la vista.

ALTER TABLE public.shared_expenses
  ADD COLUMN IF NOT EXISTS detail text;

-- Recrear la vista para exponer la columna nueva.
DROP VIEW IF EXISTS public.shared_expenses_with_transaction;

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
  se.detail,
  se.created_at,
  t.date AS transaction_date,
  t.detail AS transaction_detail,
  t.amount AS transaction_amount,
  t.category_name AS transaction_category
FROM public.shared_expenses se
LEFT JOIN public.transactions t ON t.id = se.transaction_id;

GRANT SELECT ON public.shared_expenses_with_transaction TO authenticated;
