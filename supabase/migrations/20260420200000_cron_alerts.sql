-- Nivel 6A.5: Automatización de la generación de alertas vía pg_cron

-- Asegurarse de que la extensión pg_net esté habilitada en Supabase (suele venir por defecto en proyectos nuevos)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Nota: Reemplaza '<tu-project-ref>' con el ref real de tu proyecto Supabase.
-- Ejemplo: 'tkwhxzmlrjzhgcnbbebv'
-- Asegúrate de usar tu Service Role Key real en los headers para que Deno autorice.

/* 
-- DESCOMENTA Y REEMPLAZA LOS VALORES ANTES DE EJECUTAR DIRECTAMENTE EN EL SQL EDITOR --

 SELECT cron.schedule(
   'generate-alerts-auto',
   '*/5 * * * *',
   $$
   SELECT net.http_post(
       url := 'https://<tu-project-ref>.functions.supabase.co/generate-alerts',
       headers := '{"Content-Type": "application/json", "Authorization": "Bearer <TU_SERVICE_ROLE_KEY>"}'::jsonb,
       body := '{}'::jsonb
   ) as request_id;
   $$
 );
*/

-- Para revisar los logs del cron si hay fallos:
-- select * from cron.job_run_details order by start_time desc limit 10;
