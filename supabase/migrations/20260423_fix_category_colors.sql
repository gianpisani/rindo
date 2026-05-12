-- Fix category colors: make them visually distinct for donut charts
-- Before: most expense categories were red/rose, looked like a blob

-- Update existing categories for all users
UPDATE public.categories SET color = '#f97316' WHERE name = 'Comida' AND type = 'Gasto';
UPDATE public.categories SET color = '#0ea5e9' WHERE name = 'Viajes' AND type = 'Gasto';
UPDATE public.categories SET color = '#a855f7' WHERE name = 'Regalos' AND type = 'Gasto';
UPDATE public.categories SET color = '#ec4899' WHERE name = 'Gustos personales' AND type = 'Gasto';
UPDATE public.categories SET color = '#8b5cf6' WHERE name = 'Ropa' AND type = 'Gasto';
UPDATE public.categories SET color = '#6366f1' WHERE name = 'Suscripciones' AND type = 'Gasto';
UPDATE public.categories SET color = '#14b8a6' WHERE name = 'Computador' AND type = 'Gasto';
UPDATE public.categories SET color = '#ef4444' WHERE name = 'Salud' AND type = 'Gasto';
UPDATE public.categories SET color = '#f59e0b' WHERE name = 'Necesidades básicas' AND type = 'Gasto';
UPDATE public.categories SET color = '#64748b' WHERE name = 'Conciliación' AND type = 'Gasto';
UPDATE public.categories SET color = '#78716c' WHERE name = 'Otros gastos' AND type = 'Gasto';

-- Update the trigger function so new users get the good colors too
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
    ('Comida', 'Gasto', '#f97316', NEW.id),
    ('Viajes', 'Gasto', '#0ea5e9', NEW.id),
    ('Regalos', 'Gasto', '#a855f7', NEW.id),
    ('Gustos personales', 'Gasto', '#ec4899', NEW.id),
    ('Ropa', 'Gasto', '#8b5cf6', NEW.id),
    ('Suscripciones', 'Gasto', '#6366f1', NEW.id),
    ('Computador', 'Gasto', '#14b8a6', NEW.id),
    ('Salud', 'Gasto', '#ef4444', NEW.id),
    ('Necesidades básicas', 'Gasto', '#f59e0b', NEW.id),
    ('Conciliación', 'Gasto', '#64748b', NEW.id),
    ('Otros gastos', 'Gasto', '#78716c', NEW.id),
    ('Inversiones', 'Inversión', '#3b82f6', NEW.id);
  RETURN NEW;
END;
$$;
