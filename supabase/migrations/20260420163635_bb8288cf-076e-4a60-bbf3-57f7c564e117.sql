-- Tabla de logs de sincronización web
CREATE TABLE IF NOT EXISTS public.sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ok BOOLEAN NOT NULL DEFAULT true,
  total_procesadas INTEGER NOT NULL DEFAULT 0,
  nuevas INTEGER NOT NULL DEFAULT 0,
  duplicadas INTEGER NOT NULL DEFAULT 0,
  errores INTEGER NOT NULL DEFAULT 0,
  detalle JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sync_logs_created_at_idx
  ON public.sync_logs (created_at DESC);

ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read sync_logs" ON public.sync_logs;
CREATE POLICY "Admins read sync_logs" ON public.sync_logs
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Inserts vienen de la Edge Function (service_role bypassa RLS),
-- pero permitimos también a admins insertar manualmente si lo necesitan.
DROP POLICY IF EXISTS "Admins insert sync_logs" ON public.sync_logs;
CREATE POLICY "Admins insert sync_logs" ON public.sync_logs
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));