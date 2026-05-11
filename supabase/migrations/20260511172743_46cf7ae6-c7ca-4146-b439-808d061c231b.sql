-- ─── push_subscriptions ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own subs" ON public.push_subscriptions;
CREATE POLICY "Users manage own subs" ON public.push_subscriptions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── opportunity_alerts ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.opportunity_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha DATE NOT NULL,
  hora TEXT NOT NULL,
  cartera_id UUID NOT NULL REFERENCES public.carteras(id) ON DELETE CASCADE,
  internal_score INTEGER NOT NULL,
  top_mean NUMERIC NOT NULL DEFAULT 0,
  gap NUMERIC NOT NULL DEFAULT 0,
  notified_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS opportunity_alerts_fecha_hora_unique
  ON public.opportunity_alerts (fecha, hora);

CREATE INDEX IF NOT EXISTS opportunity_alerts_fecha_idx
  ON public.opportunity_alerts (fecha DESC, created_at DESC);

ALTER TABLE public.opportunity_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins all opportunity_alerts" ON public.opportunity_alerts;
CREATE POLICY "Admins all opportunity_alerts" ON public.opportunity_alerts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ─── Realtime ───────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.opportunity_alerts;
ALTER TABLE public.opportunity_alerts REPLICA IDENTITY FULL;