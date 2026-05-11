
CREATE TABLE IF NOT EXISTS public.carteras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha DATE NOT NULL,
  hora TEXT NOT NULL,
  numeros INTEGER[] NOT NULL,
  scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  estrategia TEXT NOT NULL DEFAULT 'composite_v1',
  contexto JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS carteras_fecha_hora_estrategia_unique
  ON public.carteras (fecha, hora, estrategia);

CREATE INDEX IF NOT EXISTS carteras_fecha_idx ON public.carteras (fecha DESC);

ALTER TABLE public.carteras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins all carteras" ON public.carteras;
CREATE POLICY "Admins all carteras" ON public.carteras
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.cartera_resultados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cartera_id UUID NOT NULL REFERENCES public.carteras(id) ON DELETE CASCADE,
  numero_ganador INTEGER NOT NULL,
  acierto BOOLEAN NOT NULL,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS cartera_resultados_cartera_unique
  ON public.cartera_resultados (cartera_id);

CREATE INDEX IF NOT EXISTS cartera_resultados_evaluated_idx
  ON public.cartera_resultados (evaluated_at DESC);

ALTER TABLE public.cartera_resultados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins all cartera_resultados" ON public.cartera_resultados;
CREATE POLICY "Admins all cartera_resultados" ON public.cartera_resultados
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
