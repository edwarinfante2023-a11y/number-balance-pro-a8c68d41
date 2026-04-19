-- Add missing columns to existing patterns table to match application code
ALTER TABLE public.patterns
  ADD COLUMN IF NOT EXISTS nombre TEXT,
  ADD COLUMN IF NOT EXISTS tipo public.rule_tipo NOT NULL DEFAULT 'patron'::public.rule_tipo,
  ADD COLUMN IF NOT EXISTS resultado_esperado TEXT,
  ADD COLUMN IF NOT EXISTS hora TEXT,
  ADD COLUMN IF NOT EXISTS activa BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'observacion',
  ADD COLUMN IF NOT EXISTS score_confianza INTEGER;

-- Backfill nombre for any pre-existing rows so we can later make it NOT NULL safely
UPDATE public.patterns
SET nombre = COALESCE(nombre, LEFT(descripcion, 100))
WHERE nombre IS NULL;

-- Now enforce nombre NOT NULL
ALTER TABLE public.patterns
  ALTER COLUMN nombre SET NOT NULL;

-- Unique index to dedupe auto-mined patterns per hour bucket
CREATE UNIQUE INDEX IF NOT EXISTS patterns_descripcion_hora_unique
  ON public.patterns (descripcion, COALESCE(hora, ''));

-- Ensure updated_at trigger exists
DROP TRIGGER IF EXISTS update_patterns_updated_at ON public.patterns;
CREATE TRIGGER update_patterns_updated_at
  BEFORE UPDATE ON public.patterns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();