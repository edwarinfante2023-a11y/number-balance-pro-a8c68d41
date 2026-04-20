-- Nivel 6A: Agregar campos primarios a la tabla alerts
ALTER TABLE public.alerts 
  ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'new' CHECK (estado IN ('new', 'seen', 'dismissed')),
  ADD COLUMN IF NOT EXISTS score INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hora TEXT,
  ADD COLUMN IF NOT EXISTS fecha DATE;

-- Para registros viejos si existían
UPDATE public.alerts SET estado = 'new' WHERE estado IS NULL;
