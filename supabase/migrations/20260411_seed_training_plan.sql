-- ============================================================
-- Training plan for Gianfranco: 3-week block
-- Week 1: Taper for 15km race (Apr 12)
-- Week 2: Recovery + progressive return
-- Week 3: Taper for Half Marathon (Apr 26)
-- ============================================================

DO $$
DECLARE
  _uid UUID := '42f87eb6-3bb8-4a8d-83b0-8dc8f2680879';
BEGIN

  -- ── Clean existing sessions in the 3-week window ──────────
  DELETE FROM public.training_sessions
    WHERE user_id = _uid
      AND session_date >= '2026-04-09'
      AND session_date <= '2026-04-26';

  -- ============================================================
  -- WEEK 1: Taper for 15km race (Apr 6-12)
  -- ============================================================

  -- Jueves 9 — Natación (ya programada)
  INSERT INTO public.training_sessions
    (user_id, session_date, week_start_date, time_of_day, scheduled_time,
     sport_type, session_name, description, intensity,
     target_duration_minutes, target_distance_meters, status,
     training_phase)
  VALUES
    (_uid, '2026-04-09', '2026-04-06', 'evening', '19:30',
     'swimming', 'Natación - Mantenimiento',
     'Entrenamiento normal de piscina. Mantener cardio sin impacto en piernas.',
     'moderate', 90, 1600, 'pending', 'taper');

  -- Viernes 10 — Carrera de activación
  INSERT INTO public.training_sessions
    (user_id, session_date, week_start_date, time_of_day,
     sport_type, session_name, description, intensity,
     target_duration_minutes, target_distance_meters, target_pace_min_km,
     status, training_phase, coach_notes)
  VALUES
    (_uid, '2026-04-10', '2026-04-06', 'evening',
     'running', 'Activación pre-carrera',
     '10 min trote suave (5:30-6:00/km) → 4x30s a ritmo carrera (4:40/km) con 1 min trote entre cada una → 5 min trote suave vuelta.',
     'moderate', 30, 4500, '5:30',
     'pending', 'taper',
     'Objetivo: despertar las piernas y recordar el ritmo 4:40. NO hacer más de lo indicado.');

  -- Sábado 11 — Descanso total
  INSERT INTO public.training_sessions
    (user_id, session_date, week_start_date, time_of_day,
     sport_type, session_name, description, intensity,
     status, training_phase, coach_notes)
  VALUES
    (_uid, '2026-04-11', '2026-04-06', 'morning',
     'rest', 'Descanso total',
     'Día de descanso completo. Caminata suave opcional (20-30 min). Hidratarse bien todo el día.',
     'rest', 'pending', 'taper',
     'Nada de bici, Zwift ni nada intenso. Piernas frescas para mañana.');

  -- Domingo 12 — CARRERA 15km
  INSERT INTO public.training_sessions
    (user_id, session_date, week_start_date, time_of_day,
     sport_type, session_name, description, intensity,
     target_duration_minutes, target_distance_meters, target_pace_min_km,
     target_hr_max, status, training_phase,
     is_race, race_name, race_distance_label, coach_notes)
  VALUES
    (_uid, '2026-04-12', '2026-04-06', 'morning',
     'running', 'Carrera 15K',
     'Estrategia negative split: Km 1-5 a 4:50 → Km 6-10 a 4:45 → Km 11-15 a 4:35-4:40. Objetivo ~1:10:30-1:11:15.',
     'hard', 72, 15000, '4:45',
     170, 'pending', 'taper',
     true, 'Carrera 15K', '15K',
     'NO salir a 4:40 desde el inicio. Conservar energía los primeros 5km. Si te sientes bien al km 10, ahí largas todo.');

  -- ============================================================
  -- WEEK 2: Recovery + progressive return (Apr 13-19)
  -- ============================================================

  -- Lunes 13 — Descanso activo
  INSERT INTO public.training_sessions
    (user_id, session_date, week_start_date, time_of_day,
     sport_type, session_name, description, intensity,
     target_duration_minutes, status, training_phase)
  VALUES
    (_uid, '2026-04-13', '2026-04-13', 'morning',
     'rest', 'Descanso activo',
     'Recuperación post-carrera. Caminata suave o nada. Estiramientos y foam roller si tienes.',
     'rest', 0, 'pending', 'recovery');

  -- Martes 14 — Natación recuperación
  INSERT INTO public.training_sessions
    (user_id, session_date, week_start_date, time_of_day, scheduled_time,
     sport_type, session_name, description, intensity,
     target_duration_minutes, target_distance_meters, status, training_phase)
  VALUES
    (_uid, '2026-04-14', '2026-04-13', 'evening', '19:30',
     'swimming', 'Natación - Recuperación',
     'Nadar suave, sin exigencia. Ideal para soltar piernas post-carrera.',
     'recovery', 60, 1200, 'pending', 'recovery');

  -- Miércoles 15 — Trote regenerativo
  INSERT INTO public.training_sessions
    (user_id, session_date, week_start_date, time_of_day,
     sport_type, session_name, description, intensity,
     target_duration_minutes, target_distance_meters, target_pace_min_km,
     status, training_phase, coach_notes)
  VALUES
    (_uid, '2026-04-15', '2026-04-13', 'evening',
     'running', 'Trote regenerativo',
     'Trote muy suave, sin presión de ritmo. Solo mover las piernas.',
     'recovery', 30, 5000, '6:00',
     'pending', 'recovery',
     'Si las piernas están pesadas, caminar está bien. No forzar nada.');

  -- Jueves 16 — Natación
  INSERT INTO public.training_sessions
    (user_id, session_date, week_start_date, time_of_day, scheduled_time,
     sport_type, session_name, description, intensity,
     target_duration_minutes, target_distance_meters, status, training_phase)
  VALUES
    (_uid, '2026-04-16', '2026-04-13', 'evening', '19:30',
     'swimming', 'Natación - Moderada',
     'Entrenamiento normal de natación. Buen cross-training sin impacto.',
     'moderate', 90, 1600, 'pending', 'build');

  -- Viernes 17 — Carrera con ritmo
  INSERT INTO public.training_sessions
    (user_id, session_date, week_start_date, time_of_day,
     sport_type, session_name, description, intensity,
     target_duration_minutes, target_distance_meters, target_pace_min_km,
     status, training_phase, workout_subtype, coach_notes)
  VALUES
    (_uid, '2026-04-17', '2026-04-13', 'evening',
     'running', 'Tempo run',
     '10 min calentamiento (5:30) → 20 min a ritmo tempo (4:50-5:00/km) → 5 min enfriamiento.',
     'moderate', 35, 7000, '5:00',
     'pending', 'build', 'tempo',
     'El bloque de tempo debe sentirse "cómodamente incómodo". HR ~155-160.');

  -- Sábado 18 — Ciclismo
  INSERT INTO public.training_sessions
    (user_id, session_date, week_start_date, time_of_day,
     sport_type, session_name, description, intensity,
     target_duration_minutes, target_distance_meters, status, training_phase)
  VALUES
    (_uid, '2026-04-18', '2026-04-13', 'morning',
     'cycling', 'Ciclismo aeróbico',
     'Salida en bici a ritmo suave-moderado. Buen volumen aeróbico sin castigar piernas.',
     'moderate', 90, 35000, 'pending', 'build');

  -- Domingo 19 — Long run
  INSERT INTO public.training_sessions
    (user_id, session_date, week_start_date, time_of_day,
     sport_type, session_name, description, intensity,
     target_duration_minutes, target_distance_meters, target_pace_min_km,
     status, training_phase, workout_subtype, coach_notes)
  VALUES
    (_uid, '2026-04-19', '2026-04-13', 'morning',
     'running', 'Long run con progresión',
     '14km total: 10km a 5:15-5:30/km → últimos 4km bajando a 4:50-5:00/km.',
     'moderate', 75, 14000, '5:15',
     'pending', 'build', 'long_run',
     'Esta es la última tirada larga antes de la media. No ser héroe, mantener ritmo controlado.');

  -- ============================================================
  -- WEEK 3: Taper for Half Marathon (Apr 20-26)
  -- ============================================================

  -- Lunes 20 — Descanso
  INSERT INTO public.training_sessions
    (user_id, session_date, week_start_date, time_of_day,
     sport_type, session_name, description, intensity,
     status, training_phase)
  VALUES
    (_uid, '2026-04-20', '2026-04-20', 'morning',
     'rest', 'Descanso',
     'Recuperación del long run. Estiramientos suaves.',
     'rest', 'pending', 'taper');

  -- Martes 21 — Natación suave
  INSERT INTO public.training_sessions
    (user_id, session_date, week_start_date, time_of_day, scheduled_time,
     sport_type, session_name, description, intensity,
     target_duration_minutes, target_distance_meters, status, training_phase)
  VALUES
    (_uid, '2026-04-21', '2026-04-20', 'evening', '19:30',
     'swimming', 'Natación - Suave',
     'Natación liviana. Soltar el cuerpo, mantener movilidad.',
     'easy', 60, 1200, 'pending', 'taper');

  -- Miércoles 22 — Carrera con cambios de ritmo
  INSERT INTO public.training_sessions
    (user_id, session_date, week_start_date, time_of_day,
     sport_type, session_name, description, intensity,
     target_duration_minutes, target_distance_meters, target_pace_min_km,
     status, training_phase, workout_subtype, coach_notes)
  VALUES
    (_uid, '2026-04-22', '2026-04-20', 'evening',
     'running', 'Fartlek corto',
     '10 min calentamiento → 5x(1 min a 4:30 + 2 min trote suave) → 10 min enfriamiento.',
     'moderate', 35, 6000, '5:00',
     'pending', 'taper', 'fartlek',
     'Última sesión de calidad. Los intervalos rápidos deben sentirse fluidos, no forzados.');

  -- Jueves 23 — Natación
  INSERT INTO public.training_sessions
    (user_id, session_date, week_start_date, time_of_day, scheduled_time,
     sport_type, session_name, description, intensity,
     target_duration_minutes, target_distance_meters, status, training_phase)
  VALUES
    (_uid, '2026-04-23', '2026-04-20', 'evening', '19:30',
     'swimming', 'Natación - Mantenimiento',
     'Entrenamiento normal pero sin excederse. Mantener cardio activo.',
     'moderate', 75, 1400, 'pending', 'taper');

  -- Viernes 24 — Activación pre media maratón
  INSERT INTO public.training_sessions
    (user_id, session_date, week_start_date, time_of_day,
     sport_type, session_name, description, intensity,
     target_duration_minutes, target_distance_meters, target_pace_min_km,
     status, training_phase, coach_notes)
  VALUES
    (_uid, '2026-04-24', '2026-04-20', 'evening',
     'running', 'Activación pre-media maratón',
     '10 min trote suave → 4x30s a ritmo media maratón (4:50/km) con 1 min trote → 5 min trote vuelta.',
     'easy', 25, 4000, '5:30',
     'pending', 'taper',
     'Mismo protocolo que antes de los 15K. Piernas frescas, solo despertar el ritmo.');

  -- Sábado 25 — Descanso total
  INSERT INTO public.training_sessions
    (user_id, session_date, week_start_date, time_of_day,
     sport_type, session_name, description, intensity,
     status, training_phase, coach_notes)
  VALUES
    (_uid, '2026-04-25', '2026-04-20', 'morning',
     'rest', 'Descanso total',
     'Descanso completo. Hidratación y carbohidratos. Preparar todo para mañana.',
     'rest', 'pending', 'taper',
     'Cargar carbohidratos en cena (pasta, arroz). Dormir temprano. Dejar ropa lista.');

  -- Domingo 26 — MEDIA MARATÓN
  INSERT INTO public.training_sessions
    (user_id, session_date, week_start_date, time_of_day,
     sport_type, session_name, description, intensity,
     target_duration_minutes, target_distance_meters, target_pace_min_km,
     target_hr_max, status, training_phase,
     is_race, race_name, race_distance_label, coach_notes)
  VALUES
    (_uid, '2026-04-26', '2026-04-20', 'morning',
     'running', 'Media Maratón',
     'Estrategia negative split: Km 1-7 a 4:55-5:00 → Km 8-14 a 4:50 → Km 15-21 a 4:40-4:45. Objetivo sub 1:42.',
     'hard', 102, 21097, '4:50',
     170, 'pending', 'taper',
     true, 'Media Maratón', '21K',
     'Si los 15K del domingo anterior salieron bien, puedes ser un poco más agresivo en la segunda mitad. La clave es NO salir rápido. Los primeros 7km son de inversión.');

END $$;
