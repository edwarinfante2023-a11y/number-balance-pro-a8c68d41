ALTER TABLE public.cartera_resultados
  ADD COLUMN IF NOT EXISTS numero_segundo INTEGER,
  ADD COLUMN IF NOT EXISTS numero_tercero INTEGER,
  ADD COLUMN IF NOT EXISTS acierto_segundo BOOLEAN,
  ADD COLUMN IF NOT EXISTS acierto_tercero BOOLEAN;