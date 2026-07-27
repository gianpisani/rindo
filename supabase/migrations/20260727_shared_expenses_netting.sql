-- Conciliación neta de deudas por persona.
--
-- Hasta acá una persona podía aparecer en los dos lados (yo le debo $15.000 a
-- Cata y Cata me debe $10.000) sin que la app lo reconociera: dos filas en dos
-- direcciones, cada una saldada por separado. En la práctica sólo se mueven
-- $5.000 y el resto se compensa.
--
-- Esta migración agrega lo necesario para leer y cerrar la deuda a nivel de
-- persona:
--   1. person_key: identidad estable de la contraparte, tolerante a mayúsculas,
--      tildes y espacios. Sin esto "cata" y "Cata" nunca se netean.
--   2. settlement_kind / settlement_id: cómo se cerró cada fila (con plata o
--      compensada contra el otro lado) y qué filas se cerraron juntas.
--   3. get_balances_by_person: los dos lados y el neto en una sola consulta.
--   4. settle_shared_expenses: el cierre completo en una transacción. Antes eran
--      3-4 escrituras encadenadas desde el cliente; si fallaba a mitad la data
--      quedaba inconsistente.
--
-- Nombre de archivo: ordena después de 20260726_shared_expenses_i_owe_detail.sql,
-- que es quien crea la versión previa de la vista.


-- 1. Identidad normalizada de la contraparte -------------------------------

-- unaccent() no es IMMUTABLE, así que no sirve dentro de una columna generada.
-- normalize(..., NFD) sí lo es: descompone cada letra acentuada en la letra base
-- más su marca combinante, y esas marcas se borran por rango. Es exactamente lo
-- que hace personKey() en src/lib/debtNetting.ts — si las dos implementaciones se
-- separan, la UI agrupa distinto que get_balances_by_person.
CREATE OR REPLACE FUNCTION public.normalize_person_name(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT regexp_replace(
    lower(regexp_replace(normalize(btrim(p), NFD), '[\u0300-\u036f]', '', 'g')),
    '\s+', ' ', 'g');
$$;

ALTER TABLE public.shared_expenses
  ADD COLUMN IF NOT EXISTS person_key text
  GENERATED ALWAYS AS (public.normalize_person_name(debtor_name)) STORED;

CREATE INDEX IF NOT EXISTS idx_shared_expenses_person
  ON public.shared_expenses(user_id, person_key, paid);


-- 2. Cómo se cerró cada deuda ----------------------------------------------

-- paid sigue siendo la fuente de verdad de "cerrada". settlement_kind dice de
-- qué forma: 'cash' se movió plata, 'offset' se compensó contra el otro lado y
-- nunca hubo transferencia. Las filas históricas quedan en NULL, que la UI lee
-- como 'cash'. settlement_id agrupa todo lo que se cerró en una misma operación.
ALTER TABLE public.shared_expenses
  ADD COLUMN IF NOT EXISTS settlement_kind text,
  ADD COLUMN IF NOT EXISTS settlement_id uuid;

DO $$
BEGIN
  ALTER TABLE public.shared_expenses
    ADD CONSTRAINT shared_expenses_settlement_kind_check
    CHECK (settlement_kind IS NULL OR settlement_kind IN ('cash', 'offset'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_shared_expenses_settlement
  ON public.shared_expenses(settlement_id)
  WHERE settlement_id IS NOT NULL;


-- 3. Balance por persona ----------------------------------------------------

-- Reemplaza a get_pending_by_debtor / get_pending_by_creditor, que agrupaban por
-- debtor_name crudo y sólo veían una dirección a la vez. Esas dos quedan
-- existiendo para no romper nada, pero ya no tienen consumidores.
CREATE OR REPLACE FUNCTION public.get_balances_by_person(p_user_id uuid)
RETURNS TABLE(
  person_key text,
  display_name text,
  owed_to_me numeric,
  i_owe numeric,
  net numeric,
  count_owed_to_me bigint,
  count_i_owe bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    s.person_key,
    -- La grafía de la deuda pendiente más reciente, que es la que el usuario
    -- escribió última.
    (SELECT s2.debtor_name
       FROM public.shared_expenses s2
      WHERE s2.user_id = p_user_id
        AND s2.person_key = s.person_key
        AND s2.paid = false
      ORDER BY s2.created_at DESC
      LIMIT 1) AS display_name,
    COALESCE(SUM(s.amount_owed) FILTER (WHERE s.direction = 'they_owe_me'), 0) AS owed_to_me,
    COALESCE(SUM(s.amount_owed) FILTER (WHERE s.direction = 'i_owe_them'), 0) AS i_owe,
    COALESCE(SUM(s.amount_owed) FILTER (WHERE s.direction = 'they_owe_me'), 0)
      - COALESCE(SUM(s.amount_owed) FILTER (WHERE s.direction = 'i_owe_them'), 0) AS net,
    COUNT(*) FILTER (WHERE s.direction = 'they_owe_me') AS count_owed_to_me,
    COUNT(*) FILTER (WHERE s.direction = 'i_owe_them') AS count_i_owe
  FROM public.shared_expenses s
  WHERE s.user_id = p_user_id
    AND s.paid = false
  GROUP BY s.person_key;
$$;


-- 4. Cierre atómico ---------------------------------------------------------

-- p_cash_ids:   filas que se cierran con plata, contra p_transaction_id.
-- p_offset_ids: filas compensadas contra el otro lado. No hubo transferencia,
--               pero quedan vinculadas a la misma operación.
-- p_transaction_id: NULL cuando el neto es 0 y sólo hubo compensación.
--
-- SECURITY INVOKER es obligatorio: con DEFINER la función correría como owner y
-- saltaría las policies de RLS de shared_expenses y transactions.
CREATE OR REPLACE FUNCTION public.settle_shared_expenses(
  p_cash_ids uuid[],
  p_offset_ids uuid[],
  p_transaction_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_settlement_id uuid := gen_random_uuid();
  v_now timestamptz := now();
  v_all_ids uuid[] := COALESCE(p_cash_ids, '{}'::uuid[]) || COALESCE(p_offset_ids, '{}'::uuid[]);
  r record;
BEGIN
  IF array_length(v_all_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'settle_shared_expenses: no se recibió ninguna deuda';
  END IF;

  UPDATE public.shared_expenses
     SET paid = true,
         paid_at = v_now,
         paid_transaction_id = p_transaction_id,
         settlement_kind = 'cash',
         settlement_id = v_settlement_id
   WHERE id = ANY(COALESCE(p_cash_ids, '{}'::uuid[]))
     AND paid = false;

  -- Las compensadas también se vinculan a la transacción del neto cuando existe:
  -- es la operación que las cerró, aunque su plata no se haya movido.
  UPDATE public.shared_expenses
     SET paid = true,
         paid_at = v_now,
         paid_transaction_id = p_transaction_id,
         settlement_kind = 'offset',
         settlement_id = v_settlement_id
   WHERE id = ANY(COALESCE(p_offset_ids, '{}'::uuid[]))
     AND paid = false;

  -- Restarle a cada gasto original lo que quedó conciliado, agrupando por
  -- transacción porque varias deudas pueden venir del mismo gasto. Sólo aplica a
  -- 'they_owe_me': son las únicas que nacen de un Gasto propio que el reembolso
  -- (o la compensación) deja de representar. El guard > 0 evita dejar la
  -- transacción en cero o negativa, igual que la lógica que reemplaza.
  FOR r IN
    SELECT se.transaction_id, SUM(se.amount_owed) AS total
      FROM public.shared_expenses se
     WHERE se.settlement_id = v_settlement_id
       AND se.direction = 'they_owe_me'
       AND se.transaction_id IS NOT NULL
     GROUP BY se.transaction_id
  LOOP
    UPDATE public.transactions
       SET amount = amount - r.total
     WHERE id = r.transaction_id
       AND amount - r.total > 0;
  END LOOP;

  RETURN v_settlement_id;
END;
$$;


-- 5. Vista con las columnas nuevas ------------------------------------------

DROP VIEW IF EXISTS public.shared_expenses_with_transaction;

CREATE VIEW public.shared_expenses_with_transaction
WITH (security_invoker = on) AS
SELECT
  se.id,
  se.user_id,
  se.transaction_id,
  se.debtor_name,
  se.person_key,
  se.amount_owed,
  se.paid,
  se.paid_at,
  se.paid_transaction_id,
  se.settlement_kind,
  se.settlement_id,
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
GRANT EXECUTE ON FUNCTION public.get_balances_by_person(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.settle_shared_expenses(uuid[], uuid[], uuid) TO authenticated;
