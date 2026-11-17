-- Tablas sin código en la app (restos de un análisis inmobiliario y de un
-- modelo viejo de tarjetas). Conteo al 2026-11-17 antes de borrar:
--   properties = 1 (una "Casa Prueba" de test), comparables = 0,
--   investment_analyses = 0, card_transactions = 0.
-- Respaldo verificado de la fila de properties fuera del repo
-- (rindo-respaldos/2026-11-17-tablas-huerfanas.json).
-- Ninguna vista ni función depende de estas tablas. La función de trigger
-- update_updated_at_column se comparte con otras tablas y NO se borra.

DROP TABLE IF EXISTS public.comparables CASCADE;
DROP TABLE IF EXISTS public.investment_analyses CASCADE;
DROP TABLE IF EXISTS public.properties CASCADE;
DROP TABLE IF EXISTS public.card_transactions CASCADE;
