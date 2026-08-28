-- ── Reiniciar un contenido ──────────────────────────────────
--
-- A veces uno abre un video para probar algo y queda registrado como si lo
-- hubiera estudiado: minutos, comprensión y expresiones que nunca capturó de
-- verdad. Como todas las métricas de Aprendizaje se calculan sobre lo que
-- efectivamente escuchaste, esa basura no es cosmética: corre la línea de
-- progreso.
--
-- Esto lo deja como si nunca lo hubieras visto. Va en una función y no en tres
-- borrados desde el cliente porque tiene que pasar entero o no pasar: dejar los
-- avistamientos sin sesión —el borrado en cascada los pone en NULL en vez de
-- eliminarlos— dejaría el diccionario contando apariciones fantasma.
--
-- Lo que NO se toca: la transcripción, que es del video y no tuya, y las
-- expresiones que además aparecen en otros videos. Esas solo pierden la marca
-- que venía de acá.

CREATE OR REPLACE FUNCTION public.reset_learning_content(
  p_goal_id UUID,
  p_external_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_sessions UUID[];
  v_items UUID[];
  v_deleted_sessions INT := 0;
  v_deleted_items INT := 0;
  v_deleted_sightings INT := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT array_agg(id) INTO v_sessions
  FROM public.learning_sessions
  WHERE user_id = v_user_id
    AND goal_id = p_goal_id
    AND external_id = p_external_id;

  IF v_sessions IS NULL THEN
    RETURN jsonb_build_object('sessions', 0, 'items', 0, 'sightings', 0);
  END IF;

  -- Qué expresiones tocan estas sesiones, antes de perderles el rastro
  SELECT array_agg(DISTINCT item_id) INTO v_items
  FROM public.learning_item_sightings
  WHERE user_id = v_user_id
    AND session_id = ANY(v_sessions);

  DELETE FROM public.learning_item_sightings
  WHERE user_id = v_user_id
    AND session_id = ANY(v_sessions);
  GET DIAGNOSTICS v_deleted_sightings = ROW_COUNT;

  IF v_items IS NOT NULL THEN
    -- Las que sobreviven quedan contando solo lo que de verdad les queda.
    -- Se recalcula en vez de restar: así el contador se arregla solo si venía
    -- torcido de antes.
    UPDATE public.learning_items i
    SET times_seen = GREATEST(
          1,
          (SELECT count(*)
             FROM public.learning_item_sightings s
            WHERE s.item_id = i.id)
        ),
        updated_at = now()
    WHERE i.id = ANY(v_items)
      AND i.user_id = v_user_id;

    -- Las que solo existían por este video no existieron nunca
    DELETE FROM public.learning_items i
    WHERE i.id = ANY(v_items)
      AND i.user_id = v_user_id
      AND NOT EXISTS (
        SELECT 1 FROM public.learning_item_sightings s WHERE s.item_id = i.id
      );
    GET DIAGNOSTICS v_deleted_items = ROW_COUNT;
  END IF;

  DELETE FROM public.learning_sessions
  WHERE id = ANY(v_sessions)
    AND user_id = v_user_id;
  GET DIAGNOSTICS v_deleted_sessions = ROW_COUNT;

  RETURN jsonb_build_object(
    'sessions', v_deleted_sessions,
    'items', v_deleted_items,
    'sightings', v_deleted_sightings
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_learning_content(UUID, TEXT) TO authenticated;
