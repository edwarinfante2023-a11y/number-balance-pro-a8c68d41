CREATE TABLE IF NOT EXISTS public.lottery_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hora text NOT NULL,
  periodo integer NOT NULL,
  numero integer NOT NULL CHECK (numero BETWEEN 0 AND 99),
  frecuencia integer NOT NULL DEFAULT 0,
  dias_vencido integer,
  total_sorteos integer,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lottery_stats_unique UNIQUE (hora, periodo, numero)
);

CREATE INDEX IF NOT EXISTS lottery_stats_hora_periodo_idx
  ON public.lottery_stats (hora, periodo);

ALTER TABLE public.lottery_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins all lottery_stats" ON public.lottery_stats;
CREATE POLICY "Admins all lottery_stats" ON public.lottery_stats
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS update_lottery_stats_updated_at ON public.lottery_stats;
CREATE TRIGGER update_lottery_stats_updated_at
  BEFORE UPDATE ON public.lottery_stats
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();