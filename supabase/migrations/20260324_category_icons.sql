-- Add icon column to categories
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS icon TEXT;

-- Backfill default category icons by name (case-insensitive match)
UPDATE public.categories SET icon = '💵' WHERE lower(name) IN ('sueldo', 'salario');
UPDATE public.categories SET icon = '💵' WHERE lower(name) = 'aguinaldo';
UPDATE public.categories SET icon = '💵' WHERE lower(name) IN ('otros ingresos', 'ingreso');
UPDATE public.categories SET icon = '↔️' WHERE lower(name) = 'reembolsos';
UPDATE public.categories SET icon = '🍔' WHERE lower(name) = 'comida';
UPDATE public.categories SET icon = '✈️' WHERE lower(name) IN ('viajes', 'viaje');
UPDATE public.categories SET icon = '🎁' WHERE lower(name) IN ('regalos', 'regalo');
UPDATE public.categories SET icon = '🛍️' WHERE lower(name) = 'gustos personales';
UPDATE public.categories SET icon = '👕' WHERE lower(name) IN ('ropa', 'vestuario');
UPDATE public.categories SET icon = '🔄' WHERE lower(name) IN ('suscripciones', 'suscripción');
UPDATE public.categories SET icon = '💻' WHERE lower(name) IN ('computador', 'tecnología', 'electrónica');
UPDATE public.categories SET icon = '💊' WHERE lower(name) = 'salud';
UPDATE public.categories SET icon = '🏠' WHERE lower(name) = 'necesidades básicas';
UPDATE public.categories SET icon = '🏦' WHERE lower(name) = 'conciliación';
UPDATE public.categories SET icon = '🏷️' WHERE lower(name) = 'otros gastos';
UPDATE public.categories SET icon = '📈' WHERE lower(name) IN ('inversiones', 'inversión', 'fondos');

-- Update the handle_new_user_categories function to include icons
CREATE OR REPLACE FUNCTION public.handle_new_user_categories()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.categories (name, type, color, icon, user_id) VALUES
    ('Sueldo',             'Ingreso',   '#10b981', '💵',  NEW.id),
    ('Aguinaldo',          'Ingreso',   '#059669', '💵',  NEW.id),
    ('Otros ingresos',     'Ingreso',   '#34d399', '💵',  NEW.id),
    ('Reembolsos',         'Ingreso',   '#6ee7b7', '↔️',  NEW.id),
    ('Comida',             'Gasto',     '#ef4444', '🍔',  NEW.id),
    ('Viajes',             'Gasto',     '#dc2626', '✈️',  NEW.id),
    ('Regalos',            'Gasto',     '#f87171', '🎁',  NEW.id),
    ('Gustos personales',  'Gasto',     '#fb923c', '🛍️', NEW.id),
    ('Ropa',               'Gasto',     '#fbbf24', '👕',  NEW.id),
    ('Suscripciones',      'Gasto',     '#facc15', '🔄',  NEW.id),
    ('Computador',         'Gasto',     '#a3e635', '💻',  NEW.id),
    ('Salud',              'Gasto',     '#f472b6', '💊',  NEW.id),
    ('Necesidades básicas','Gasto',     '#e11d48', '🏠',  NEW.id),
    ('Conciliación',       'Gasto',     '#be123c', '🏦',  NEW.id),
    ('Otros gastos',       'Gasto',     '#f43f5e', '🏷️', NEW.id),
    ('Inversiones',        'Inversión', '#3b82f6', '📈',  NEW.id);
  RETURN NEW;
END;
$$;
