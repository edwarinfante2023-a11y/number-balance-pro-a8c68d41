-- ═══════════════════════════════════════════════════════════════════════════
-- Robot de Aprendizaje de Patrones: cron job que se ejecuta diario a las 2:00 AM
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Este Cron llama al endpoint del sistema que se encarga de:
-- 1. Promover patrones en "observación" que superen el 60% de efectividad a "activos".
-- 2. Descartar patrones "activos" que caigan por debajo del 40% de efectividad.
--
-- Se ejecuta una vez al día en la madrugada para no interferir con las operaciones.
-- ═══════════════════════════════════════════════════════════════════════════

-- Asegurarse de que pg_net esté habilitada
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ══════════════════════════════════════════════════════════════════════════
-- INSTRUCCIONES PARA ACTIVAR EN SUPABASE:
-- 
-- 1. Copia este código.
-- 2. Reemplaza <TU_DOMINIO_LOVABLE> con la URL real de tu panel (ej: number-balance-pro.lovable.app)
-- 3. Pégalo en el SQL Editor de tu proyecto de Supabase y dale a RUN.
-- ══════════════════════════════════════════════════════════════════════════

/*
-- DESCOMENTA Y REEMPLAZA EL DOMINIO ANTES DE EJECUTAR --

-- Eliminar cron anterior si existe
SELECT cron.unschedule('learn-patterns-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'learn-patterns-daily');

-- Crear nuevo cron: Todos los días a las 2:00 AM AST
SELECT cron.schedule(
  'learn-patterns-daily',
  '0 2 * * *',
  $$
  SELECT net.http_post(
      url := 'https://<TU_DOMINIO_LOVABLE>/api/public/hooks/learn-patterns',
      headers := '{"Content-Type": "application/json"}'::jsonb,
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
--   SELECT * FROM cron.job_run_details WHERE jobname = 'learn-patterns-daily' ORDER BY start_time DESC LIMIT 10;
--
-- Ver los resultados en la tabla Settings:
--   SELECT * FROM settings WHERE clave = 'pattern_learning_last_run';
-- ══════════════════════════════════════════════════════════════════════════
