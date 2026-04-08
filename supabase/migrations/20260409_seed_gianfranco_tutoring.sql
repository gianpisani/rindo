-- ============================================================
-- Seed tutoring data for Gianfranco (gpisani9@gmail.com)
-- user_id: 42f87eb6-3bb8-4a8d-83b0-8dc8f2680879
-- Same data as Marina for testing/preview
-- ============================================================

DO $$
DECLARE
  _uid UUID := '42f87eb6-3bb8-4a8d-83b0-8dc8f2680879';
  _diego UUID;
  _antonia UUID;
  _franca UUID;
  _sofia UUID;
  _vicky UUID;
  _pascale UUID;
  _france UUID;
BEGIN
  INSERT INTO public.tutoring_students (user_id, name) VALUES (_uid, 'Diego Fantini')  RETURNING id INTO _diego;
  INSERT INTO public.tutoring_students (user_id, name) VALUES (_uid, 'Antonia')        RETURNING id INTO _antonia;
  INSERT INTO public.tutoring_students (user_id, name) VALUES (_uid, 'Franca')         RETURNING id INTO _franca;
  INSERT INTO public.tutoring_students (user_id, name) VALUES (_uid, 'Sofia')          RETURNING id INTO _sofia;
  INSERT INTO public.tutoring_students (user_id, name) VALUES (_uid, 'Vicky')          RETURNING id INTO _vicky;
  INSERT INTO public.tutoring_students (user_id, name) VALUES (_uid, 'Pascale Larsen') RETURNING id INTO _pascale;
  INSERT INTO public.tutoring_students (user_id, name) VALUES (_uid, 'France')         RETURNING id INTO _france;

  -- MARZO — all completed & paid
  INSERT INTO public.tutoring_classes (user_id, student_id, date, duration_hours, price_per_hour, status, is_paid) VALUES
    (_uid, _diego,   '2026-03-02', 1, 22000, 'completed', true),
    (_uid, _diego,   '2026-03-09', 1, 22000, 'completed', true),
    (_uid, _diego,   '2026-03-16', 1, 22000, 'completed', true),
    (_uid, _diego,   '2026-03-23', 1, 22000, 'completed', true),
    (_uid, _antonia, '2026-03-10', 1, 20000, 'completed', true),
    (_uid, _antonia, '2026-03-17', 1, 20000, 'completed', true),
    (_uid, _antonia, '2026-03-24', 1, 20000, 'completed', true),
    (_uid, _franca,  '2026-03-17', 1, 22000, 'completed', true),
    (_uid, _franca,  '2026-03-24', 1, 22000, 'completed', true),
    (_uid, _sofia,   '2026-03-11', 1, 22000, 'completed', true),
    (_uid, _sofia,   '2026-03-18', 1, 22000, 'completed', true),
    (_uid, _vicky,   '2026-03-11', 1, 22000, 'completed', true),
    (_uid, _vicky,   '2026-03-18', 1, 22000, 'completed', true),
    (_uid, _vicky,   '2026-03-25', 1, 22000, 'completed', true),
    (_uid, _pascale, '2026-03-26', 1, 25000, 'completed', true);

  -- ABRIL semana 1 — completed
  INSERT INTO public.tutoring_classes (user_id, student_id, date, duration_hours, price_per_hour, status, is_paid) VALUES
    (_uid, _diego,   '2026-03-30', 1, 22000, 'completed', true),
    (_uid, _antonia, '2026-03-31', 1, 20000, 'completed', true),
    (_uid, _franca,  '2026-03-31', 1, 22000, 'completed', false),
    (_uid, _sofia,   '2026-04-01', 1, 22000, 'completed', false),
    (_uid, _vicky,   '2026-04-01', 1, 22000, 'completed', false),
    (_uid, _pascale, '2026-04-02', 1, 25000, 'completed', true),
    (_uid, _france,  '2026-04-05', 1, 22000, 'completed', false);

  -- ABRIL semana 2 — completed
  INSERT INTO public.tutoring_classes (user_id, student_id, date, duration_hours, price_per_hour, status, is_paid) VALUES
    (_uid, _diego,   '2026-04-06', 1, 22000, 'completed', false),
    (_uid, _antonia, '2026-04-07', 1, 20000, 'completed', false),
    (_uid, _franca,  '2026-04-07', 1, 22000, 'completed', false),
    (_uid, _sofia,   '2026-04-08', 1, 22000, 'completed', false),
    (_uid, _vicky,   '2026-04-08', 1, 22000, 'completed', false),
    (_uid, _pascale, '2026-04-09', 1, 25000, 'completed', false),
    (_uid, _france,  '2026-04-12', 1, 22000, 'completed', false);

  -- ABRIL semanas 3-4 — scheduled
  INSERT INTO public.tutoring_classes (user_id, student_id, date, duration_hours, price_per_hour, status, is_paid) VALUES
    (_uid, _diego,   '2026-04-13', 1, 22000, 'scheduled', false),
    (_uid, _antonia, '2026-04-14', 1, 20000, 'scheduled', false),
    (_uid, _franca,  '2026-04-14', 1, 22000, 'scheduled', false),
    (_uid, _sofia,   '2026-04-15', 1, 22000, 'scheduled', false),
    (_uid, _vicky,   '2026-04-15', 1, 22000, 'scheduled', false),
    (_uid, _pascale, '2026-04-16', 1, 25000, 'scheduled', false),
    (_uid, _france,  '2026-04-19', 1, 22000, 'scheduled', false),
    (_uid, _diego,   '2026-04-20', 1, 22000, 'scheduled', false),
    (_uid, _antonia, '2026-04-21', 1, 20000, 'scheduled', false),
    (_uid, _franca,  '2026-04-21', 1, 22000, 'scheduled', false),
    (_uid, _sofia,   '2026-04-22', 1, 22000, 'scheduled', false),
    (_uid, _vicky,   '2026-04-22', 1, 22000, 'scheduled', false),
    (_uid, _pascale, '2026-04-23', 1, 25000, 'scheduled', false),
    (_uid, _france,  '2026-04-26', 1, 22000, 'scheduled', false);
END $$;
