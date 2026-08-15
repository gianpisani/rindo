-- ============================================================
-- Aprendizaje — Learning goals, sessions, items & sightings
-- ============================================================

-- 1. Goals ---------------------------------------------------

CREATE TABLE public.learning_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '🎯',
  north_star TEXT,
  level_current TEXT,
  level_target TEXT,
  daily_minutes_target INT NOT NULL DEFAULT 30,
  weekly_days_target INT NOT NULL DEFAULT 5,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_learning_goals_user ON public.learning_goals(user_id, is_active);

-- 2. Sessions ------------------------------------------------

CREATE TABLE public.learning_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id UUID NOT NULL REFERENCES public.learning_goals(id) ON DELETE CASCADE,

  -- Contenido
  content_type TEXT NOT NULL DEFAULT 'youtube'
    CHECK (content_type IN ('youtube', 'podcast', 'article', 'series', 'other')),
  content_url TEXT,
  external_id TEXT,                 -- youtube video id
  content_title TEXT,
  content_author TEXT,
  content_thumbnail TEXT,
  content_duration_seconds INT,     -- duración original del contenido

  -- Reloj
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'completed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  last_resumed_at TIMESTAMPTZ,      -- inicio del tramo activo actual (null si pausada)
  last_heartbeat_at TIMESTAMPTZ,    -- latido para detectar sesiones huérfanas
  effective_seconds INT NOT NULL DEFAULT 0,   -- tiempo estudiando (comprometido)
  consumed_seconds INT NOT NULL DEFAULT 0,    -- segundos de contenido realmente reproducidos
  elapsed_seconds INT,                        -- calendario total, se fija al terminar
  pause_count INT NOT NULL DEFAULT 0,
  last_position_seconds INT NOT NULL DEFAULT 0, -- para "continuar donde quedaste"

  -- Reflexión (0–2 cada una → comprehension /8)
  comp_main_idea INT CHECK (comp_main_idea BETWEEN 0 AND 2),
  comp_details INT CHECK (comp_details BETWEEN 0 AND 2),
  comp_subtitles INT CHECK (comp_subtitles BETWEEN 0 AND 2),
  comp_explain INT CHECK (comp_explain BETWEEN 0 AND 2),
  main_idea_text TEXT,
  difficulty TEXT CHECK (difficulty IN ('easy', 'comfortable', 'challenge', 'hard', 'too_hard')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_learning_sessions_user_goal ON public.learning_sessions(user_id, goal_id, started_at DESC);
CREATE INDEX idx_learning_sessions_status ON public.learning_sessions(user_id, status);

-- Solo una sesión abierta a la vez por usuario
CREATE UNIQUE INDEX idx_learning_sessions_one_open
  ON public.learning_sessions(user_id)
  WHERE status IN ('active', 'paused');

-- 3. Items (diccionario personal) ----------------------------

CREATE TABLE public.learning_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id UUID NOT NULL REFERENCES public.learning_goals(id) ON DELETE CASCADE,
  first_session_id UUID REFERENCES public.learning_sessions(id) ON DELETE SET NULL,

  expression TEXT NOT NULL,
  normalized TEXT NOT NULL,         -- lowercase/trim, para deduplicar
  item_type TEXT NOT NULL DEFAULT 'expression'
    CHECK (item_type IN ('word', 'expression', 'phrasal_verb', 'idiom', 'collocation', 'grammar', 'pronunciation', 'sentence', 'concept')),

  meaning TEXT,
  translation_es TEXT,
  my_sentence TEXT,

  mastery TEXT NOT NULL DEFAULT 'new'
    CHECK (mastery IN ('new', 'learning', 'familiar', 'mastered')),
  times_seen INT NOT NULL DEFAULT 1,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, goal_id, normalized)
);

CREATE INDEX idx_learning_items_goal ON public.learning_items(user_id, goal_id, created_at DESC);

-- 4. Sightings (cada vez que aparece en contenido real) ------

CREATE TABLE public.learning_item_sightings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.learning_items(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.learning_sessions(id) ON DELETE SET NULL,
  context TEXT,
  timestamp_seconds INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_learning_sightings_item ON public.learning_item_sightings(item_id, created_at);
CREATE INDEX idx_learning_sightings_session ON public.learning_item_sightings(session_id);

-- 5. RLS -----------------------------------------------------

ALTER TABLE public.learning_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_item_sightings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own goals select" ON public.learning_goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own goals insert" ON public.learning_goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own goals update" ON public.learning_goals FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own goals delete" ON public.learning_goals FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "own sessions select" ON public.learning_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own sessions insert" ON public.learning_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own sessions update" ON public.learning_sessions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own sessions delete" ON public.learning_sessions FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "own items select" ON public.learning_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own items insert" ON public.learning_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own items update" ON public.learning_items FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own items delete" ON public.learning_items FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "own sightings select" ON public.learning_item_sightings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own sightings insert" ON public.learning_item_sightings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own sightings update" ON public.learning_item_sightings FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own sightings delete" ON public.learning_item_sightings FOR DELETE USING (auth.uid() = user_id);

-- 6. updated_at ----------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_learning_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_learning_goals_updated_at BEFORE UPDATE ON public.learning_goals
  FOR EACH ROW EXECUTE FUNCTION public.handle_learning_updated_at();
CREATE TRIGGER set_learning_sessions_updated_at BEFORE UPDATE ON public.learning_sessions
  FOR EACH ROW EXECUTE FUNCTION public.handle_learning_updated_at();
CREATE TRIGGER set_learning_items_updated_at BEFORE UPDATE ON public.learning_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_learning_updated_at();

-- 7. Captura de expresiones con dedupe + avistamientos --------
-- Si la expresión ya existe, no duplica: registra un nuevo avistamiento.
-- Eso es lo que permite ver "esta expresión reapareció en otro contenido".

CREATE OR REPLACE FUNCTION public.capture_learning_expression(
  p_goal_id UUID,
  p_session_id UUID,
  p_expression TEXT,
  p_context TEXT DEFAULT NULL,
  p_timestamp_seconds INT DEFAULT NULL,
  p_item_type TEXT DEFAULT 'expression'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_normalized TEXT;
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
      user_id, goal_id, first_session_id, expression, normalized, item_type
    ) VALUES (
      v_user_id, p_goal_id, p_session_id, btrim(p_expression), v_normalized, p_item_type
    )
    RETURNING * INTO v_item;
    v_was_new := TRUE;
  ELSE
    UPDATE public.learning_items
    SET times_seen = times_seen + 1,
        last_seen_at = now()
    WHERE id = v_item.id
    RETURNING * INTO v_item;
  END IF;

  INSERT INTO public.learning_item_sightings (
    user_id, item_id, session_id, context, timestamp_seconds
  ) VALUES (
    v_user_id, v_item.id, p_session_id, NULLIF(btrim(coalesce(p_context, '')), ''), p_timestamp_seconds
  );

  RETURN jsonb_build_object(
    'item', to_jsonb(v_item),
    'was_new', v_was_new
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.capture_learning_expression(UUID, UUID, TEXT, TEXT, INT, TEXT) TO authenticated;
