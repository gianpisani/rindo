-- ============================================================
-- Rindo es solo finanzas: se eliminan Clases y Aprendizaje.
--
-- Borra todo lo que crearon estas migraciones (que quedan como historia):
--   20260407_tutoring_classes.sql, 20260410_tutoring_date_to_timestamptz.sql
--   20260814_learning.sql, 20260815_learning_transcripts_queue.sql,
--   20260816_learning_meaning_es.sql, 20260824_learning_reflection_v2.sql,
--   20260827_learning_reset_content.sql, 20260827_learning_reset_requeue.sql
--
-- Las policies, índices y triggers de cada tabla caen con su tabla.
-- Ninguna tabla de finanzas referencia a estas, así que CASCADE solo
-- arrastra objetos de las mismas features.
-- ============================================================

-- ── Aprendizaje: funciones (RPC) ────────────────────────────
-- Todas las sobrecargas que existieron de capture_learning_expression.
DROP FUNCTION IF EXISTS public.capture_learning_expression(UUID, UUID, TEXT, TEXT, INT, TEXT);
DROP FUNCTION IF EXISTS public.capture_learning_expression(UUID, UUID, TEXT, TEXT, INT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.capture_learning_expression(UUID, UUID, TEXT, TEXT, INT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.capture_learning_expression(UUID, UUID, TEXT, TEXT, INT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.reset_learning_content(UUID, TEXT);

-- ── Aprendizaje: tablas (hijas primero) ─────────────────────
DROP TABLE IF EXISTS public.learning_item_sightings CASCADE;
DROP TABLE IF EXISTS public.learning_queue CASCADE;
DROP TABLE IF EXISTS public.learning_items CASCADE;
DROP TABLE IF EXISTS public.learning_sessions CASCADE;
DROP TABLE IF EXISTS public.learning_goals CASCADE;
DROP TABLE IF EXISTS public.learning_transcripts CASCADE;
-- Respaldo manual que quedó de una purga anterior.
DROP TABLE IF EXISTS public.learning_purge_backup_20260824 CASCADE;

-- Función de trigger usada solo por las tablas learning_*.
DROP FUNCTION IF EXISTS public.handle_learning_updated_at();

-- ── Clases particulares ─────────────────────────────────────
DROP TABLE IF EXISTS public.tutoring_classes CASCADE;
DROP TABLE IF EXISTS public.tutoring_students CASCADE;

