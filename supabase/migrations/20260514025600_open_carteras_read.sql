-- Allow public read access to carteras and cartera_resultados.
-- Write access remains admin-only (existing policy).
-- This fixes the Lovable preview showing empty cartera because the
-- preview session may not carry a fully-authenticated admin JWT.

DROP POLICY IF EXISTS "Public read carteras" ON public.carteras;
CREATE POLICY "Public read carteras" ON public.carteras
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Public read cartera_resultados" ON public.cartera_resultados;
CREATE POLICY "Public read cartera_resultados" ON public.cartera_resultados
  FOR SELECT TO anon, authenticated
  USING (true);
