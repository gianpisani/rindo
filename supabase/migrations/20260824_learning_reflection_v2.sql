-- ============================================================
-- Aprendizaje — el check de salida v2
--
-- Tres preguntas en vez de cuatro, escala de cinco caras (0–4)
-- en vez de tres opciones de texto (0–2).
--
-- Por qué se puede cambiar la escala sin migrar nada: al momento de
-- escribir esto no existe NI UNA sesión completada con reflexión
-- (0 filas con comp_main_idea IS NOT NULL). El formulario viejo pedía
-- escribir un párrafo en inglés y leer 12 opciones; nadie lo contestó
-- nunca. No hay historia que preservar.
--
-- `comp_details` se cae porque "la idea principal" y "los detalles"
-- medían lo mismo con dos preguntas. Las tres que quedan son las únicas
-- que el corpus de transcripciones NO puede calcular solo.
-- ============================================================

ALTER TABLE public.learning_sessions
  DROP CONSTRAINT IF EXISTS learning_sessions_comp_main_idea_check,
  DROP CONSTRAINT IF EXISTS learning_sessions_comp_details_check,
  DROP CONSTRAINT IF EXISTS learning_sessions_comp_subtitles_check,
  DROP CONSTRAINT IF EXISTS learning_sessions_comp_explain_check;

ALTER TABLE public.learning_sessions
  DROP COLUMN IF EXISTS comp_details;

ALTER TABLE public.learning_sessions
  ADD CONSTRAINT learning_sessions_comp_main_idea_check
    CHECK (comp_main_idea BETWEEN 0 AND 4),
  ADD CONSTRAINT learning_sessions_comp_subtitles_check
    CHECK (comp_subtitles BETWEEN 0 AND 4),
  ADD CONSTRAINT learning_sessions_comp_explain_check
    CHECK (comp_explain BETWEEN 0 AND 4);
