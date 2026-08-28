-- ── Reiniciar devuelve el video a la lista ──────────────────
--
-- Reiniciar borraba las sesiones y el video desaparecía de la pantalla: la
-- cola de "para ver después" guarda la fila con `watched_at` puesto en vez de
-- borrarla, así que quedaba invisible en los dos lados. Ni pendiente ni a
-- medias: en ninguna parte.
--
-- Reiniciar no es borrar. Es querer empezarlo de nuevo, así que el video tiene
-- que quedar donde estaba antes de que lo abrieras: pendiente. Si venía de la
-- lista, vuelve a la lista; si lo pegaste directo al empezar la sesión, entra
-- ahora con los datos que traía la sesión, porque si no el link se pierde.

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
  v_meta RECORD;
  v_deleted_sessions INT := 0;
  v_deleted_items INT := 0;
  v_deleted_sightings INT := 0;
  v_restored INT := 0;
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
    RETURN jsonb_build_object('sessions', 0, 'items', 0, 'sightings', 0, 'queued', 0);
  END IF;

  -- Los datos del video se guardan antes de borrar sus sesiones: son lo único
  -- que queda para devolverlo a la lista si no venía de ahí.
  SELECT content_type, content_url, content_title, content_author,
         content_thumbnail, content_duration_seconds
    INTO v_meta
  FROM public.learning_sessions
  WHERE id = ANY(v_sessions)
  ORDER BY started_at DESC
  LIMIT 1;

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

  -- ── De vuelta a "para ver después" ────────────────────────
  -- Solo si no hay ya una fila pendiente del mismo video: el índice único
  -- parcial de la cola no admite dos, y con razón.
  IF p_external_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.learning_queue
    WHERE user_id = v_user_id AND goal_id = p_goal_id
      AND external_id = p_external_id AND watched_at IS NULL
  ) THEN
    -- Si venía de la lista, vuelve la misma fila con su nota y su fecha
    UPDATE public.learning_queue
    SET watched_at = NULL, session_id = NULL, updated_at = now()
    WHERE id = (
      SELECT id FROM public.learning_queue
      WHERE user_id = v_user_id AND goal_id = p_goal_id
        AND external_id = p_external_id AND watched_at IS NOT NULL
      ORDER BY watched_at DESC
      LIMIT 1
    );
    GET DIAGNOSTICS v_restored = ROW_COUNT;

    -- Y si nunca estuvo en la lista, entra ahora: reiniciar no es perder
    -- el link de lo que ibas a ver.
    IF v_restored = 0 THEN
      INSERT INTO public.learning_queue (
        user_id, goal_id, content_type, content_url, external_id,
        content_title, content_author, content_thumbnail, content_duration_seconds
      ) VALUES (
        v_user_id, p_goal_id, COALESCE(v_meta.content_type, 'youtube'),
        v_meta.content_url, p_external_id, v_meta.content_title,
        v_meta.content_author, v_meta.content_thumbnail,
        v_meta.content_duration_seconds
      );
      v_restored := 1;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'sessions', v_deleted_sessions,
    'items', v_deleted_items,
    'sightings', v_deleted_sightings,
    'queued', v_restored
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_learning_content(UUID, TEXT) TO authenticated;
