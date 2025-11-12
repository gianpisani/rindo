-- Create categories table
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Ingreso', 'Gasto', 'Inversión')),
  color TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(name, user_id, type)
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own categories"
  ON public.categories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own categories"
  ON public.categories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own categories"
  ON public.categories FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own categories"
  ON public.categories FOR DELETE
  USING (auth.uid() = user_id);

-- Create transactions table
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  detail TEXT,
  category_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Ingreso', 'Gasto', 'Inversión')),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own transactions"
  ON public.transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own transactions"
  ON public.transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own transactions"
  ON public.transactions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own transactions"
  ON public.transactions FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for better query performance
CREATE INDEX idx_transactions_user_date ON public.transactions(user_id, date DESC);
CREATE INDEX idx_transactions_user_type ON public.transactions(user_id, type);
CREATE INDEX idx_categories_user_type ON public.categories(user_id, type);

-- Insert default categories
INSERT INTO public.categories (name, type, color, user_id)
SELECT name, type, color, id FROM auth.users, (VALUES
  ('Sueldo', 'Ingreso', '#10b981'),
  ('Aguinaldo', 'Ingreso', '#059669'),
  ('Otros ingresos', 'Ingreso', '#34d399'),
  ('Reembolsos', 'Ingreso', '#6ee7b7'),
  ('Comida', 'Gasto', '#ef4444'),
  ('Viajes', 'Gasto', '#dc2626'),
  ('Regalos', 'Gasto', '#f87171'),
  ('Gustos personales', 'Gasto', '#fb923c'),
  ('Ropa', 'Gasto', '#fbbf24'),
  ('Suscripciones', 'Gasto', '#facc15'),
  ('Computador', 'Gasto', '#a3e635'),
  ('Salud', 'Gasto', '#f472b6'),
  ('Necesidades básicas', 'Gasto', '#e11d48'),
  ('Conciliación', 'Gasto', '#be123c'),
  ('Otros gastos', 'Gasto', '#f43f5e'),
  ('Inversiones', 'Inversión', '#3b82f6')
) AS default_categories(name, type, color)
ON CONFLICT DO NOTHING;

-- Function to automatically add default categories for new users
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
    ('Inversiones', 'Inversión', '#3b82f6', NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_categories
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_categories();