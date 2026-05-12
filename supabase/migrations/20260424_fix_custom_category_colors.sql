-- Fix ALL categories still stuck on #ef4444 (default red)
-- These are custom categories that weren't covered by the previous migration

-- Ocio y entretenimiento → coral/salmon (fun vibes)
UPDATE public.categories SET color = '#f43f5e' WHERE name = 'Ocio y entretenimiento' AND type = 'Gasto';

-- Transporte → cyan (movement/road)
UPDATE public.categories SET color = '#06b6d4' WHERE name = 'Transporte' AND type = 'Gasto';

-- Viajes y hospedaje → sky blue (travel/sky)
UPDATE public.categories SET color = '#0ea5e9' WHERE name = 'Viajes y hospedaje' AND type = 'Gasto';

-- Servicios → amber (utilities/essential)
UPDATE public.categories SET color = '#d97706' WHERE name = 'Servicios' AND type = 'Gasto';

-- Comisiones → slate blue (bank/formal)
UPDATE public.categories SET color = '#475569' WHERE name = 'Comisiones' AND type = 'Gasto';

-- Reembolsos (Gasto type) → lime green (money back)
UPDATE public.categories SET color = '#84cc16' WHERE name = 'Reembolsos' AND type = 'Gasto';

-- Tecnología → teal (tech)
UPDATE public.categories SET color = '#14b8a6' WHERE name = 'Tecnología' AND type = 'Gasto';

-- Salud → red (stays red - cross/medical)
UPDATE public.categories SET color = '#ef4444' WHERE name = 'Salud' AND type = 'Gasto';
