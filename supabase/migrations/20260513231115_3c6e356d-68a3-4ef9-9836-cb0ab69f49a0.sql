CREATE TABLE IF NOT EXISTS public.lottery_stats_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  ok boolean NOT NULL DEFAULT true,
  duration_ms integer NOT NULL DEFAULT 0,
  slots_total integer NOT NULL DEFAULT 0,
  periodos_total integer NOT NULL DEFAULT 0,
  combinaciones integer NOT NULL DEFAULT 0,
  upserts integer NOT NULL DEFAULT 0,
  errores integer NOT NULL DEFAULT 0,
  detalle jsonb NOT NULL DEFAULT '[]'::jsonb,
  by_slot jsonb NOT NULL DEFAULT '{}'::jsonb,
  triggered_by text NOT NULL DEFAULT 'manual'
);

ALTER TABLE public.lottery_stats_sync_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins all lottery_stats_sync_runs" ON public.lottery_stats_sync_runs;
CREATE POLICY "Admins all lottery_stats_sync_runs" ON public.lottery_stats_sync_runs
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS lottery_stats_sync_runs_created_at_idx
  ON public.lottery_stats_sync_runs (created_at DESC);