-- Classification metadata only: existing transaction categories stay untouched.
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.categories ADD CONSTRAINT categories_description_length CHECK (char_length(description) <= 600);
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS category_source text;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_category_source_check
  CHECK (category_source IS NULL OR category_source IN ('manual', 'jev'));

-- Explicit, owner-scoped setup. Installing the migration does not activate it
-- for every account. SECURITY INVOKER preserves the caller's existing RLS.
CREATE OR REPLACE FUNCTION public.configure_food_categories(p_user_id uuid DEFAULT auth.uid())
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF p_user_id IS NULL OR (auth.uid() IS NOT NULL AND auth.uid() <> p_user_id) THEN
    RAISE EXCEPTION 'Se requiere el usuario propietario';
  END IF;
  INSERT INTO public.categories (user_id, name, type, color, icon, description, is_active)
  VALUES
    (p_user_id, 'Supermercado', 'Gasto', '#34d399', '🛒',
     'Compras para abastecer la casa: supermercado, feria y despensa. Si solo se conoce un supermercado como Jumbo, elegir esta categoría. Si el detalle identifica explícitamente un café, barrita, bebida, helado o snack individual para consumir, elegir Café y snacks.', true),
    (p_user_id, 'Café y snacks', 'Gasto', '#fbbf24', '☕',
     'Cafés, barritas, bebidas, helados y picoteos individuales. Siempre aquí aunque se consuman con pareja o amigos, en la pega o durante un panorama. Una comida completa no es snack. No inferir el producto solo por un monto pequeño.', true),
    (p_user_id, 'Comida diaria', 'Gasto', '#fb923c', '🥪',
     'Comidas completas para resolver el día: almuerzo de trabajo, sándwich de almuerzo o delivery cotidiano. Excluye cafés y picoteos, compras para la casa y comidas descritas como una ocasión social o especial. Delivery por sí solo no significa panorama.', true),
    (p_user_id, 'Comidas y panoramas', 'Gasto', '#f472b6', '🍽️',
     'Comidas completas para disfrutar una ocasión: cena con pareja, almuerzo familiar o con amigos, salir a comer o pedir sushi con la pareja en casa. Importa la ocasión, no el monto ni que sea delivery. Excluye cafés, bebidas, helados y snacks aunque sean acompañados. No inventar acompañantes.', true)
  ON CONFLICT (name, user_id, type) DO UPDATE
    SET description = EXCLUDED.description, is_active = true;

  -- Keep names, past expenses, reimbursements and limits intact for history.
  UPDATE public.categories SET is_active = false
    WHERE user_id = p_user_id AND type = 'Gasto' AND name IN ('Comida', 'Café');
END;
$$;
REVOKE ALL ON FUNCTION public.configure_food_categories(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.configure_food_categories(uuid) TO authenticated, service_role;
