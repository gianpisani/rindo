-- El ledger de dos baldes: completa los movimientos de inversión.
--
-- Hasta ahora la inversión era de una sola vía (líquido → invertido). Faltaban
-- los dos movimientos que cierran el modelo:
--   Rescate     — sacaste plata de las inversiones y volvió a tu liquidez.
--                 No es un ingreso: el patrimonio no cambia, cambia de balde.
--   Rendimiento — lo que las inversiones ganaron (o perdieron) solas.
--                 No es un aporte: sube el patrimonio sin tocar la liquidez.
--
-- `Rendimiento` es el único tipo que admite monto negativo: un mes malo es un
-- dato, no un error de tipeo.

-- ── Tipos válidos ──────────────────────────────────────────────────────────

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_type_check
  CHECK (type IN ('Ingreso', 'Gasto', 'Inversión', 'Reembolso', 'Rescate', 'Rendimiento'));

ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_type_check;
ALTER TABLE public.categories ADD CONSTRAINT categories_type_check
  CHECK (type IN ('Ingreso', 'Gasto', 'Inversión', 'Reembolso', 'Rescate', 'Rendimiento'));

-- ── Monto negativo, solo para rendimiento ──────────────────────────────────

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_amount_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_amount_check
  CHECK (amount >= 0 OR type = 'Rendimiento');

-- ── Categorías por defecto para los tipos nuevos ───────────────────────────

INSERT INTO public.categories (name, type, color, icon, user_id)
SELECT name, type, color, icon, id FROM auth.users, (VALUES
  ('Rescate', 'Rescate', '#06b6d4', '↩️'),
  ('Rendimiento', 'Rendimiento', '#8b5cf6', '📈')
) AS new_categories(name, type, color, icon)
ON CONFLICT DO NOTHING;

-- Y para los usuarios que se creen de aquí en adelante.
CREATE OR REPLACE FUNCTION public.handle_new_user_categories()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.categories (name, type, color, user_id) VALUES
    ('Sueldo', 'Ingreso', '#10b981', NEW.id),
    ('Aguinaldo', 'Ingreso', '#059669', NEW.id),
    ('Otros ingresos', 'Ingreso', '#34d399', NEW.id),
    ('Reembolsos', 'Ingreso', '#6ee7b7', NEW.id),
    ('Comida', 'Gasto', '#ef4444', NEW.id),
    ('Viajes', 'Gasto', '#dc2626', NEW.id),
    ('Regalos', 'Gasto', '#f87171', NEW.id),
    ('Gustos personales', 'Gasto', '#fb923c', NEW.id),
    ('Ropa', 'Gasto', '#fbbf24', NEW.id),
    ('Suscripciones', 'Gasto', '#facc15', NEW.id),
    ('Computador', 'Gasto', '#a3e635', NEW.id),
    ('Salud', 'Gasto', '#f472b6', NEW.id),
    ('Necesidades básicas', 'Gasto', '#e11d48', NEW.id),
    ('Conciliación', 'Gasto', '#be123c', NEW.id),
    ('Otros gastos', 'Gasto', '#f43f5e', NEW.id),
    ('Inversiones', 'Inversión', '#3b82f6', NEW.id),
    ('Rescate', 'Rescate', '#06b6d4', NEW.id),
    ('Rendimiento', 'Rendimiento', '#8b5cf6', NEW.id);
  RETURN NEW;
END;
$$;
