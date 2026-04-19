-- =============================================================================
-- Documentación idempotente del schema REAL de public.rules
-- =============================================================================
-- Las dos migraciones previas relacionadas (`*_create_rules.sql` y
-- `*_create_rules_table.sql`) quedaron desalineadas con la tabla real que
-- ya existía en producción. Esta migración:
--   1. Garantiza el enum `rule_tipo` con sus 5 valores reales.
--   2. Garantiza la tabla `public.rules` con el schema correcto SIN destruir
--      datos existentes.
--   3. Garantiza RLS + policy admin.
--   4. Garantiza el trigger `update_rules_updated_at`.
-- 100% idempotente: se puede correr N veces sin efectos secundarios.
-- =============================================================================

-- 1. Enum rule_tipo (crear solo si no existe)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rule_tipo') THEN
    CREATE TYPE public.rule_tipo AS ENUM ('racha', 'compensacion', 'patron', 'bloqueo', 'otro');
  END IF;
END$$;

-- 2. Tabla rules (esquema real — NO usar 'condicion'/'activa', son 'condiciones'/'activo')
CREATE TABLE IF NOT EXISTS public.rules (
  id                  UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  nombre              TEXT NOT NULL,
  tipo                public.rule_tipo NOT NULL DEFAULT 'patron',
  condiciones         JSONB NOT NULL DEFAULT '{}'::jsonb,
  resultado_esperado  TEXT,
  descripcion         TEXT,
  efectividad         NUMERIC NOT NULL DEFAULT 0,
  aciertos            INTEGER NOT NULL DEFAULT 0,
  ocurrencias         INTEGER NOT NULL DEFAULT 0,
  activo              BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. RLS habilitado + policy admin (drop+create para garantizar consistencia)
ALTER TABLE public.rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins all rules" ON public.rules;
CREATE POLICY "Admins all rules"
  ON public.rules
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 4. Trigger updated_at (drop+create idempotente)
DROP TRIGGER IF EXISTS update_rules_updated_at ON public.rules;
CREATE TRIGGER update_rules_updated_at
  BEFORE UPDATE ON public.rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- NOTA para Claude Code / IDE externo:
-- Esta migración es la fuente de verdad para `rules`. Ignora cualquier
-- migración anterior con nombre `*create_rules*.sql` — quedaron obsoletas.
-- Ver CLAUDE.md sección 3 para el schema completo y reglas de naming.
-- =============================================================================