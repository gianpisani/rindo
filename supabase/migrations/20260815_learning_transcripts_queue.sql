-- ============================================================
-- Aprendizaje — transcripciones, cola de contenido y captura
-- con significado en un solo paso
-- ============================================================

-- 1. Transcripciones ------------------------------------------
--
-- Nota sobre por qué esto se guarda en vez de descargarse:
-- el endpoint timedtext de YouTube responde 200 con cuerpo vacío a toda
-- petición sin un token de BotGuard emitido por su propio reproductor.
-- Comprobado desde el mismo origen de youtube.com, con sesión iniciada y
-- cookies: 0 bytes. El panel "Mostrar transcripción" sí la renderiza en el
-- DOM, así que se trae desde ahí (bookmarklet) y se cachea acá una sola vez
-- por video.

CREATE TABLE public.learning_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'paste'
    CHECK (source IN ('paste', 'auto')),
  lang TEXT NOT NULL DEFAULT 'en',
  cues JSONB NOT NULL,                    -- [{ t: segundos, text: "..." }]
  cue_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, external_id)
);

CREATE INDEX idx_learning_transcripts_lookup
  ON public.learning_transcripts(user_id, external_id);

ALTER TABLE public.learning_transcripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own transcripts select" ON public.learning_transcripts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own transcripts insert" ON public.learning_transcripts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own transcripts update" ON public.learning_transcripts
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own transcripts delete" ON public.learning_transcripts
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER set_learning_transcripts_updated_at
  BEFORE UPDATE ON public.learning_transcripts
  FOR EACH ROW EXECUTE FUNCTION public.handle_learning_updated_at();

-- 2. Cola de contenido para ver después ------------------------

CREATE TABLE public.learning_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id UUID NOT NULL REFERENCES public.learning_goals(id) ON DELETE CASCADE,

  content_type TEXT NOT NULL DEFAULT 'youtube'
    CHECK (content_type IN ('youtube', 'podcast', 'article', 'series', 'other')),
  content_url TEXT,
  external_id TEXT,
  content_title TEXT,
  content_author TEXT,
  content_thumbnail TEXT,
  content_duration_seconds INT,
  note TEXT,

  watched_at TIMESTAMPTZ,
  session_id UUID REFERENCES public.learning_sessions(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_learning_queue_pending
  ON public.learning_queue(user_id, goal_id, watched_at, created_at DESC);

-- El mismo video no entra dos veces mientras siga pendiente
CREATE UNIQUE INDEX idx_learning_queue_no_dupes
  ON public.learning_queue(user_id, goal_id, external_id)
  WHERE watched_at IS NULL AND external_id IS NOT NULL;

ALTER TABLE public.learning_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own queue select" ON public.learning_queue
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own queue insert" ON public.learning_queue
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own queue update" ON public.learning_queue
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own queue delete" ON public.learning_queue
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER set_learning_queue_updated_at
  BEFORE UPDATE ON public.learning_queue
  FOR EACH ROW EXECUTE FUNCTION public.handle_learning_updated_at();

-- 3. Captura con significado y traducción en la misma llamada --

DROP FUNCTION IF EXISTS public.capture_learning_expression(UUID, UUID, TEXT, TEXT, INT, TEXT);
DROP FUNCTION IF EXISTS public.capture_learning_expression(UUID, UUID, TEXT, TEXT, INT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.capture_learning_expression(
  p_goal_id UUID,
  p_session_id UUID,
  p_expression TEXT,
  p_context TEXT DEFAULT NULL,
  p_timestamp_seconds INT DEFAULT NULL,
  p_item_type TEXT DEFAULT 'expression',
  p_meaning TEXT DEFAULT NULL,
  p_translation_es TEXT DEFAULT NULL
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
      item_type, meaning, translation_es
    ) VALUES (
      v_user_id, p_goal_id, p_session_id, btrim(p_expression), v_normalized,
      p_item_type, v_meaning, v_translation
    )
    RETURNING * INTO v_item;
    v_was_new := TRUE;
  ELSE
    UPDATE public.learning_items
    SET times_seen = times_seen + 1,
        last_seen_at = now(),
        -- No pisa lo que ya escribiste a mano
        meaning = coalesce(meaning, v_meaning),
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

GRANT EXECUTE ON FUNCTION public.capture_learning_expression(UUID, UUID, TEXT, TEXT, INT, TEXT, TEXT, TEXT) TO authenticated;
