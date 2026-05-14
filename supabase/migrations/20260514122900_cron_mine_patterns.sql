-- ═══════════════════════════════════════════════════════════════════════════
-- Robot de Minería de Datos: cron job que se ejecuta los Domingos a las 3:00 AM
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Este Cron llama al endpoint de minería que analiza toda la historia
-- de sorteos buscando patrones ocultos con 5 algoritmos diferentes.
--
-- Se ejecuta semanalmente (Domingos) porque es computacionalmente pesado.
-- ═══════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════
-- INSTRUCCIONES: Copia, reemplaza el dominio y ejecuta en SQL Editor
-- ══════════════════════════════════════════════════════════════════════════

/*
-- DESCOMENTA Y EJECUTA EN SUPABASE SQL EDITOR --

SELECT cron.unschedule('mine-patterns-weekly')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mine-patterns-weekly');

-- Cada Domingo a las 3:00 AM
SELECT cron.schedule(
  'mine-patterns-weekly',
  '0 3 * * 0',
  $$
  SELECT net.http_post(
      url := 'https://ana-liza.xyz/api/public/hooks/mine-patterns',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
  ) as request_id;
  $$
);
*/
