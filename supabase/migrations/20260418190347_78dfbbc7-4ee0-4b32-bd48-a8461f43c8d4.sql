
TRUNCATE TABLE public.draws, public.imports, public.lotteries, public.patterns, public.rules RESTART IDENTITY CASCADE;

CREATE TABLE public.lottery_draws (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loteria_id UUID NOT NULL REFERENCES public.lotteries(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  hora TEXT NOT NULL,
  activa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (loteria_id, hora)
);

ALTER TABLE public.lottery_draws ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins all lottery_draws"
ON public.lottery_draws FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_lottery_draws_updated_at
BEFORE UPDATE ON public.lottery_draws
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_lottery_draws_loteria ON public.lottery_draws(loteria_id);

ALTER TABLE public.draws DROP COLUMN IF EXISTS loteria;
ALTER TABLE public.draws DROP COLUMN IF EXISTS hora;
ALTER TABLE public.draws ADD COLUMN sorteo_id UUID NOT NULL REFERENCES public.lottery_draws(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_draws_sorteo ON public.draws(sorteo_id);
CREATE INDEX IF NOT EXISTS idx_draws_fecha ON public.draws(fecha);
CREATE UNIQUE INDEX IF NOT EXISTS idx_draws_unique ON public.draws(sorteo_id, fecha);

WITH new_loteria AS (
  INSERT INTO public.lotteries (nombre, descripcion, activa, horarios)
  VALUES ('Anguila', 'Lotería principal con sorteos por horario', true, '[]'::jsonb)
  RETURNING id
)
INSERT INTO public.lottery_draws (loteria_id, nombre, hora)
SELECT new_loteria.id, 'Anguila ' || LPAD(h::text, 2, '0') || ':00', LPAD(h::text, 2, '0') || ':00'
FROM new_loteria, generate_series(8, 21) AS h;
