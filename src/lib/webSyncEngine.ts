/**
 * webSyncEngine.ts — Motor de ingesta automática desde enloteria.com
 *
 * Estrategia: Usamos los feeds RSS públicos de enloteria.com
 * URL pattern: https://enloteria.com/rss/anguilla-{slot}
 *
 * Cada feed devuelve XML con los últimos ~7 resultados. El título de cada
 * <item> tiene el formato: "Resultado de Anguilla 1PM de hoy: 11-40-57"
 * Extraemos SOLO el primer número (primer premio).
 */

import { supabase } from "@/integrations/supabase/client";

// ─── Configuración de slots horarios ─────────────────────────────────────────
interface SlotConfig {
  slug: string;   // e.g. "8am"
  hora: string;   // e.g. "08:00"
  label: string;  // e.g. "Anguilla 8AM"
}

const SLOTS: SlotConfig[] = [
  { slug: "8am",  hora: "08:00", label: "Anguilla 8AM" },
  { slug: "9am",  hora: "09:00", label: "Anguilla 9AM" },
  { slug: "10am", hora: "10:00", label: "Anguilla 10AM" },
  { slug: "11am", hora: "11:00", label: "Anguilla 11AM" },
  { slug: "12pm", hora: "12:00", label: "Anguilla 12PM" },
  { slug: "1pm",  hora: "13:00", label: "Anguilla 1PM" },
  { slug: "2pm",  hora: "14:00", label: "Anguilla 2PM" },
  { slug: "3pm",  hora: "15:00", label: "Anguilla 3PM" },
  { slug: "4pm",  hora: "16:00", label: "Anguilla 4PM" },
  { slug: "5pm",  hora: "17:00", label: "Anguilla 5PM" },
  { slug: "6pm",  hora: "18:00", label: "Anguilla 6PM" },
  { slug: "7pm",  hora: "19:00", label: "Anguilla 7PM" },
  { slug: "8pm",  hora: "20:00", label: "Anguilla 8PM" },
  { slug: "9pm",  hora: "21:00", label: "Anguilla 9PM" },
  { slug: "10pm", hora: "22:00", label: "Anguilla 10PM" },
];

// ─── Tipos ───────────────────────────────────────────────────────────────────
export interface ParsedResult {
  fecha: string;       // YYYY-MM-DD
  hora: string;        // HH:mm
  numero: number;      // primer premio (0-99)
  label: string;       // nombre del slot
}

export interface SyncSummary {
  totalProcesadas: number;
  nuevasInsertadas: number;
  duplicadasIgnoradas: number;
  errores: number;
  detalle: string[];
}

// ─── Parseo de RSS ───────────────────────────────────────────────────────────

/** Extraer fecha ISO de pubDate RFC 2822: "Sun, 19 Apr 2026 13:07:16 -0400" */
function parsePubDate(pubDate: string): string {
  const d = new Date(pubDate);
  if (isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Extraer primer premio del título: "Resultado de Anguilla 1PM de hoy: 11-40-57" → 11 */
function extractFirstPrize(title: string): number | null {
  // Match pattern: digits-digits-digits at end of title
  const match = title.match(/:\s*(\d{1,2})-\d{1,2}-\d{1,2}\s*$/);
  if (!match) return null;
  return parseInt(match[1], 10);
}

/** Extraer múltiples items de un feed RSS XML */
function parseRSSItems(xml: string): Array<{ title: string; pubDate: string }> {
  const items: Array<{ title: string; pubDate: string }> = [];
  
  // Simple XML parsing sin dependencias externas
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let itemMatch;
  while ((itemMatch = itemRegex.exec(xml)) !== null) {
    const itemXml = itemMatch[1];
    
    const titleMatch = itemXml.match(/<title>([\s\S]*?)<\/title>/);
    const pubDateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
    
    if (titleMatch && pubDateMatch) {
      items.push({
        title: titleMatch[1].trim(),
        pubDate: pubDateMatch[1].trim(),
      });
    }
  }
  
  return items;
}

// ─── Fetching de un slot ─────────────────────────────────────────────────────
async function fetchSlotResults(slot: SlotConfig): Promise<ParsedResult[]> {
  const url = `https://enloteria.com/rss/anguilla-${slot.slug}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} para ${url}`);
  }
  
  const xml = await response.text();
  const items = parseRSSItems(xml);
  const results: ParsedResult[] = [];
  
  for (const item of items) {
    const fecha = parsePubDate(item.pubDate);
    const numero = extractFirstPrize(item.title);
    
    if (fecha && numero !== null) {
      results.push({
        fecha,
        hora: slot.hora,
        numero,
        label: slot.label,
      });
    }
  }
  
  return results;
}

// ─── Resolución de sorteo_id ─────────────────────────────────────────────────
/** Cache de sorteo_ids por hora para evitar queries repetitivos */
let sorteoCache: Record<string, string> | null = null;

async function getSorteoMap(): Promise<Record<string, string>> {
  if (sorteoCache) return sorteoCache;
  
  const { data, error } = await supabase
    .from("lottery_draws")
    .select("id, hora")
    .eq("activa", true);
  
  if (error) throw error;
  
  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    map[row.hora] = row.id;
  }
  
  sorteoCache = map;
  return map;
}

// ─── Detección de duplicados ─────────────────────────────────────────────────
async function getExistingDrawKeys(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("draws")
    .select("fecha, sorteo_id");
  
  if (error) throw error;
  
  const keys = new Set<string>();
  for (const row of data ?? []) {
    keys.add(`${row.fecha}|${row.sorteo_id}`);
  }
  return keys;
}

// ─── Motor principal ─────────────────────────────────────────────────────────
export async function syncFromWeb(): Promise<SyncSummary> {
  const summary: SyncSummary = {
    totalProcesadas: 0,
    nuevasInsertadas: 0,
    duplicadasIgnoradas: 0,
    errores: 0,
    detalle: [],
  };

  // 1. Pre-cargar mapa de sorteos y duplicados existentes
  const sorteoMap = await getSorteoMap();
  const existingKeys = await getExistingDrawKeys();

  // 2. Recorrer cada slot horario
  for (const slot of SLOTS) {
    try {
      const results = await fetchSlotResults(slot);
      summary.totalProcesadas += results.length;

      for (const r of results) {
        const sorteoId = sorteoMap[r.hora];
        if (!sorteoId) {
          summary.errores++;
          summary.detalle.push(`⚠ Sin sorteo_id para hora ${r.hora}`);
          continue;
        }

        const key = `${r.fecha}|${sorteoId}`;
        if (existingKeys.has(key)) {
          summary.duplicadasIgnoradas++;
          continue;
        }

        // Insertar — el trigger de Supabase calcula alto_bajo, par_impar, cuadrante
        const { error } = await supabase.from("draws").insert({
          sorteo_id: sorteoId,
          fecha: r.fecha,
          numero: r.numero,
          alto_bajo: "BAJO",      // placeholder — trigger overrides
          par_impar: "PAR",       // placeholder — trigger overrides
          cuadrante: "BAJO_PAR",  // placeholder — trigger overrides
          origen: "scraper" as const,
        });

        if (error) {
          summary.errores++;
          summary.detalle.push(`✗ Error insertando ${r.label} ${r.fecha}: ${error.message}`);
        } else {
          summary.nuevasInsertadas++;
          existingKeys.add(key); // evitar double-insert dentro del mismo batch
          summary.detalle.push(`✓ ${r.label} ${r.fecha} → #${r.numero.toString().padStart(2, "0")}`);
        }
      }
    } catch (err) {
      summary.errores++;
      summary.detalle.push(`✗ Error fetching ${slot.label}: ${err instanceof Error ? err.message : String(err)}`);
      // Continuar con el siguiente slot
    }
  }

  // Limpiar cache para la próxima ejecución
  sorteoCache = null;
  
  return summary;
}
