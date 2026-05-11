DO $$ BEGIN
  ALTER TABLE public.cartera_resultados DROP CONSTRAINT IF EXISTS cartera_resultados_cartera_id_unique;
END $$;

-- Limpiar duplicados previos (si los hay) antes de crear el unique
DELETE FROM public.cartera_resultados a
USING public.cartera_resultados b
WHERE a.ctid < b.ctid
  AND a.cartera_id = b.cartera_id;

ALTER TABLE public.cartera_resultados
  ADD CONSTRAINT cartera_resultados_cartera_id_unique UNIQUE (cartera_id);