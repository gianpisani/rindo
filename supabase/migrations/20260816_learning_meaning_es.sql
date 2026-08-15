-- ============================================================
-- Modo automático de captura: guarda el significado en los dos
-- idiomas de una sola vez, sin abrir el formulario.
-- ============================================================

ALTER TABLE public.learning_items
  ADD COLUMN IF NOT EXISTS meaning_es TEXT;

DROP FUNCTION IF EXISTS public.capture_learning_expression(UUID, UUID, TEXT, TEXT, INT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.capture_learning_expression(
  p_goal_id UUID,
  p_session_id UUID,
  p_expression TEXT,
  p_context TEXT DEFAULT NULL,
  p_timestamp_seconds INT DEFAULT NULL,
  p_item_type TEXT DEFAULT 'expression',
  p_meaning TEXT DEFAULT NULL,
  p_translation_es TEXT DEFAULT NULL,
  p_meaning_es TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_normalized TEXT;
  v_meaning TEXT := NULLIF(btrim(coalesce(p_meaning, '')), '');
  v_meaning_es TEXT := NULLIF(btrim(coalesce(p_meaning_es, '')), '');
  v_translation TEXT := NULLIF(btrim(coalesce(p_translation_es, '')), '');
  v_item public.learning_items;
  v_was_new BOOLEAN := FALSE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_normalized := lower(btrim(regexp_replace(p_expression, '\s+', ' ', 'g')));
  IF v_normalized = '' THEN
    RAISE EXCEPTION 'Empty expression';
  END IF;

  SELECT * INTO v_item
  FROM public.learning_items
  WHERE user_id = v_user_id AND goal_id = p_goal_id AND normalized = v_normalized;

  IF NOT FOUND THEN
    INSERT INTO public.learning_items (
      user_id, goal_id, first_session_id, expression, normalized,
      item_type, meaning, meaning_es, translation_es
    ) VALUES (
      v_user_id, p_goal_id, p_session_id, btrim(p_expression), v_normalized,
      p_item_type, v_meaning, v_meaning_es, v_translation
    )
    RETURNING * INTO v_item;
    v_was_new := TRUE;
  ELSE
    UPDATE public.learning_items
    SET times_seen = times_seen + 1,
        last_seen_at = now(),
        -- No pisa lo que ya escribiste a mano
        meaning = coalesce(meaning, v_meaning),
        meaning_es = coalesce(meaning_es, v_meaning_es),
        translation_es = coalesce(translation_es, v_translation)
    WHERE id = v_item.id
    RETURNING * INTO v_item;
  END IF;

  INSERT INTO public.learning_item_sightings (
    user_id, item_id, session_id, context, timestamp_seconds
  ) VALUES (
    v_user_id, v_item.id, p_session_id,
    NULLIF(btrim(coalesce(p_context, '')), ''), p_timestamp_seconds
  );

  RETURN jsonb_build_object('item', to_jsonb(v_item), 'was_new', v_was_new);
END;
$$;

GRANT EXECUTE ON FUNCTION public.capture_learning_expression(UUID, UUID, TEXT, TEXT, INT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
