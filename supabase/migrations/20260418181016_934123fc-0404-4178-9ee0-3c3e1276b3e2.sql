-- ============================================
-- ROLES & SECURITY
-- ============================================
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Admins read all roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can read own role" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- ============================================
-- UTILITY: updated_at trigger
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================
-- LOTTERIES
-- ============================================
CREATE TABLE public.lotteries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  horarios JSONB DEFAULT '[]'::jsonb,
  activa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lotteries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins all lotteries" ON public.lotteries
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_lotteries_updated_at
  BEFORE UPDATE ON public.lotteries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- SETTINGS
-- ============================================
CREATE TABLE public.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clave TEXT NOT NULL UNIQUE,
  valor JSONB NOT NULL,
  descripcion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins all settings" ON public.settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default classification config
INSERT INTO public.settings (clave, valor, descripcion) VALUES
  ('classification', '{"rangeMin": 0, "rangeMax": 99, "altoThreshold": 50}'::jsonb, 'Reglas de clasificación Alto/Bajo y rango de números');

-- ============================================
-- CLASSIFICATION FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION public.classify_number(_numero INTEGER)
RETURNS TABLE (alto_bajo TEXT, par_impar TEXT, cuadrante TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg JSONB;
  threshold INTEGER;
  ab TEXT;
  pi TEXT;
BEGIN
  SELECT valor INTO cfg FROM public.settings WHERE clave = 'classification' LIMIT 1;
  threshold := COALESCE((cfg->>'altoThreshold')::INTEGER, 50);

  ab := CASE WHEN _numero >= threshold THEN 'ALTO' ELSE 'BAJO' END;
  pi := CASE WHEN _numero % 2 = 0 THEN 'PAR' ELSE 'IMPAR' END;

  RETURN QUERY SELECT ab, pi, ab || '_' || pi;
END;
$$;

-- ============================================
-- DRAWS
-- ============================================
CREATE TYPE public.draw_origen AS ENUM ('manual', 'scraper', 'excel');

CREATE TABLE public.draws (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha DATE NOT NULL,
  hora TEXT NOT NULL,
  loteria TEXT NOT NULL,
  numero INTEGER NOT NULL,
  alto_bajo TEXT NOT NULL,
  par_impar TEXT NOT NULL,
  cuadrante TEXT NOT NULL,
  subcuadrante TEXT,
  origen draw_origen NOT NULL DEFAULT 'manual',
  observacion TEXT,
  movimiento TEXT,
  patron_detectado TEXT,
  extra JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (fecha, hora, loteria)
);

CREATE INDEX idx_draws_fecha ON public.draws (fecha DESC);
CREATE INDEX idx_draws_hora ON public.draws (hora);
CREATE INDEX idx_draws_loteria ON public.draws (loteria);
CREATE INDEX idx_draws_numero ON public.draws (numero);
CREATE INDEX idx_draws_fecha_hora ON public.draws (fecha DESC, hora DESC);

ALTER TABLE public.draws ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins all draws" ON public.draws
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Auto-classify on insert/update
CREATE OR REPLACE FUNCTION public.auto_classify_draw()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  c RECORD;
BEGIN
  SELECT * INTO c FROM public.classify_number(NEW.numero);
  NEW.alto_bajo := c.alto_bajo;
  NEW.par_impar := c.par_impar;
  NEW.cuadrante := c.cuadrante;
  NEW.subcuadrante := c.cuadrante;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_classify_draw
  BEFORE INSERT OR UPDATE OF numero ON public.draws
  FOR EACH ROW EXECUTE FUNCTION public.auto_classify_draw();

CREATE TRIGGER update_draws_updated_at
  BEFORE UPDATE ON public.draws
  FOR EACH ROW WHEN (OLD.numero IS NOT DISTINCT FROM NEW.numero)
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- RULES
-- ============================================
CREATE TYPE public.rule_tipo AS ENUM ('racha', 'compensacion', 'patron', 'bloqueo', 'otro');

CREATE TABLE public.rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  tipo rule_tipo NOT NULL DEFAULT 'patron',
  condiciones JSONB NOT NULL DEFAULT '{}'::jsonb,
  resultado_esperado TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  ocurrencias INTEGER NOT NULL DEFAULT 0,
  aciertos INTEGER NOT NULL DEFAULT 0,
  efectividad NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins all rules" ON public.rules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_rules_updated_at
  BEFORE UPDATE ON public.rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- PATTERNS
-- ============================================
CREATE TABLE public.patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descripcion TEXT NOT NULL,
  condiciones JSONB NOT NULL DEFAULT '{}'::jsonb,
  ocurrencias INTEGER NOT NULL DEFAULT 0,
  aciertos INTEGER NOT NULL DEFAULT 0,
  efectividad NUMERIC(5,2) NOT NULL DEFAULT 0,
  ultima_deteccion TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins all patterns" ON public.patterns
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_patterns_updated_at
  BEFORE UPDATE ON public.patterns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- ALERTS
-- ============================================
CREATE TYPE public.alert_nivel AS ENUM ('info', 'warning', 'critical');

CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  nivel alert_nivel NOT NULL DEFAULT 'info',
  activa BOOLEAN NOT NULL DEFAULT true,
  contexto JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_alerts_activa ON public.alerts (activa, created_at DESC);

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins all alerts" ON public.alerts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- IMPORTS
-- ============================================
CREATE TABLE public.imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  archivo TEXT NOT NULL,
  registros_importados INTEGER NOT NULL DEFAULT 0,
  registros_duplicados INTEGER NOT NULL DEFAULT 0,
  errores INTEGER NOT NULL DEFAULT 0,
  detalle_errores JSONB DEFAULT '[]'::jsonb,
  estado TEXT NOT NULL DEFAULT 'completado',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins all imports" ON public.imports
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- SEED LOTTERIES
-- ============================================
INSERT INTO public.lotteries (nombre, descripcion, horarios) VALUES
  ('Quiniela Diaria', 'Sorteo principal diario', '["09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00","21:00"]'::jsonb),
  ('Sorteo Horario', 'Sorteo por hora', '["09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00","21:00"]'::jsonb),
  ('Tarde Express', 'Sorteo express vespertino', '["14:00","15:00","16:00","17:00","18:00","19:00","20:00","21:00"]'::jsonb);
