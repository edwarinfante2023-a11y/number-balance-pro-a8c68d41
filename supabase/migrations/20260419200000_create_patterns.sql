-- 20260419200000_create_patterns.sql
CREATE TABLE IF NOT EXISTS public.patterns (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre varchar(100) NOT NULL,
  descripcion text,
  tipo public.rule_tipo NOT NULL DEFAULT 'patron'::public.rule_tipo,
  condiciones jsonb NOT NULL,
  resultado_esperado text,
  ocurrencias integer NOT NULL DEFAULT 0,
  aciertos integer NOT NULL DEFAULT 0,
  efectividad integer NOT NULL DEFAULT 0,
  ultima_deteccion timestamp with time zone,
  hora varchar(5),
  activa boolean NOT NULL DEFAULT true,
  source varchar(20) NOT NULL DEFAULT 'auto',
  estado varchar(20) NOT NULL DEFAULT 'observacion',
  score_confianza integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT patterns_pkey PRIMARY KEY (id)
);

ALTER TABLE public.patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable ALL for admin" ON public.patterns FOR ALL USING (
  ((( SELECT auth.jwt() AS jwt) ->> 'app_role'::text) = 'admin'::text)
);
