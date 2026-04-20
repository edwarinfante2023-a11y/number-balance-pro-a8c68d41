/**
 * webSyncEngine.ts — Motor de ingesta
 *
 * Estrategia: Invocamos la Edge Function "sync-web" de Supabase
 * que se encarga del scraping RSS sin bloqueos CORS, procesando 
 * nativamente desde el servidor.
 */

import { supabase } from "@/integrations/supabase/client";

export interface SyncSummary {
  ok?: boolean;
  totalProcesadas: number;
  nuevasInsertadas: number;
  duplicadasIgnoradas: number;
  errores: number;
  detalle: string[];
}

export async function syncFromWeb(): Promise<SyncSummary> {
  // Llamada limpia a la Edge Function
  const { data, error } = await supabase.functions.invoke<SyncSummary>("sync-web");

  if (error) {
    throw new Error(`Fallo invocando la Edge Function: ${error.message}`);
  }

  if (!data) {
    throw new Error("La Edge Function no devolvió resultados.");
  }

  // Si la función nos devuelve un error interno reportado
  if (data.ok === false) {
    throw new Error(`Error interno en servidor: ${(data as any).error}`);
  }

  return data;
}
