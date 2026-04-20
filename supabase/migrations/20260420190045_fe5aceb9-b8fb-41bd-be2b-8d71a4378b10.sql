-- Ampliar tabla alerts con columnas necesarias para el motor de alertas (Nivel 6A)
ALTER TABLE public.alerts
  ADD COLUMN IF NOT EXISTS score INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hora TEXT,
  ADD COLUMN IF NOT EXISTS fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'new';

-- Índice para queries del inbox (filtrado por fecha + estado)
CREATE INDEX IF NOT EXISTS idx_alerts_fecha_estado
  ON public.alerts (fecha DESC, estado, created_at DESC);

-- Índice parcial para detectar duplicados rápido (mismo slot del día)
CREATE INDEX IF NOT EXISTS idx_alerts_slot_lookup
  ON public.alerts (fecha, hora) WHERE hora IS NOT NULL;