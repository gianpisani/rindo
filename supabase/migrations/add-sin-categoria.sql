-- ============================================
-- Agregar categoría "Sin categoría" 
-- Para transacciones rápidas sin categorizar
-- ============================================

-- Agregar a usuarios existentes
INSERT INTO public.categories (name, type, color, user_id)
SELECT 'Sin categoría', 'Gasto', '#94a3b8', id 
FROM auth.users
ON CONFLICT (name, user_id, type) DO NOTHING;

-- Actualizar el trigger para incluirla en nuevos usuarios
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
    ('Sin categoría', 'Gasto', '#94a3b8', NEW.id),
    ('Inversiones', 'Inversión', '#3b82f6', NEW.id);
  RETURN NEW;
END;
$$;

