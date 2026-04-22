-- ═══════════════════════════════════════════════════════════════════════════
-- Scraper por hora: cron job que se ejecuta a los :05 de cada hora (8AM–10PM)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- El scraper (sync-web) ahora detecta automáticamente qué slot acaba de
-- cerrar según la hora actual AST. Solo scrapea ESE slot y solo toma
-- el resultado "de hoy" del RSS feed.
--
-- Se ejecuta cada hora a los 5 minutos (:05) para dar tiempo a que
-- enloteria.com actualice sus feeds.
--
-- Horario efectivo: 8:05 AM → 10:05 PM (15 ejecuciones diarias).
-- Fuera de ese rango, el scraper no encuentra slot y retorna sin hacer nada.
-- ═══════════════════════════════════════════════════════════════════════════

-- Asegurarse de que pg_net esté habilitada
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ══════════════════════════════════════════════════════════════════════════
-- INSTRUCCIONES PARA ACTIVAR:
-- 
-- 1. Reemplaza <tu-project-ref> con tu ref de Supabase (ej: tkwhxzmlrjzhgcnbbebv)
-- 2. Reemplaza <TU_SERVICE_ROLE_KEY> con tu Service Role Key real
-- 3. Ejecuta este bloque en el SQL Editor de Supabase Dashboard
-- ══════════════════════════════════════════════════════════════════════════

/*
-- DESCOMENTA Y REEMPLAZA ANTES DE EJECUTAR --

-- Eliminar cron anterior si existe (el viejo que corría cada 5 min o manual)
SELECT cron.unschedule('sync-web-auto')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-web-auto');

-- Crear nuevo cron: cada hora a los :05
SELECT cron.schedule(
  'sync-web-hourly',
  '5 8-22 * * *',
  $$
  SELECT net.http_post(
      url := 'https://<tu-project-ref>.functions.supabase.co/sync-web',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer <TU_SERVICE_ROLE_KEY>"}'::jsonb,
      body := '{}'::jsonb
  ) as request_id;
  $$
);
*/

-- ══════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN Y DIAGNÓSTICO
-- ══════════════════════════════════════════════════════════════════════════
-- 
-- Ver jobs programados:
--   SELECT * FROM cron.job ORDER BY jobname;
--
-- Ver las últimas ejecuciones:
--   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
--
-- Ver los logs del scraper:
--   SELECT * FROM sync_logs ORDER BY created_at DESC LIMIT 20;
--
-- Ejecución manual de backfill (todos los slots del día hasta la hora actual):
--   SELECT net.http_post(
--     url := 'https://<tu-project-ref>.functions.supabase.co/sync-web',
--     headers := '{"Content-Type": "application/json", "Authorization": "Bearer <TU_SERVICE_ROLE_KEY>"}'::jsonb,
--     body := '{"mode": "full"}'::jsonb
--   );
-- ══════════════════════════════════════════════════════════════════════════
