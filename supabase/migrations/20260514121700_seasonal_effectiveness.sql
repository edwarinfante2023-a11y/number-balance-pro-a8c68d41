-- ═══════════════════════════════════════════════════════════════════════════
-- Memoria Estacional: efectividad por mes para cada patrón
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Agrega una columna JSONB que almacena la efectividad desglosada por mes:
-- {
--   "01": { "ocurrencias": 30, "aciertos": 22, "efectividad": 73 },
--   "02": { "ocurrencias": 25, "aciertos": 17, "efectividad": 68 },
--   ...
--   "12": { "ocurrencias": 28, "aciertos": 21, "efectividad": 75 }
-- }
--
-- Esto permite al robot de aprendizaje tomar decisiones basadas en la
-- temporada actual, no solo en el promedio global.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.patterns
  ADD COLUMN IF NOT EXISTS efectividad_mensual jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Permitir lectura pública para el motor de carteras
COMMENT ON COLUMN public.patterns.efectividad_mensual IS 
  'Efectividad desglosada por mes (01-12). Cada entrada tiene ocurrencias, aciertos y efectividad.';
