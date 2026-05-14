import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { APP_TIME_ZONE, formatDateInTimeZone, getTimePartsInTimeZone } from "../_shared/timezone.ts";

// ─── Headers CORS ────────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Tipos y Config ──────────────────────────────────────────────────────
interface SlotConfig {
  slug: string;
  hora: string;
  /** Hora en formato 24h (8, 9, ... 22) para comparar con la hora actual */
  hour24: number;
  label: string;
}

const SLOTS: SlotConfig[] = [
  { slug: "8am",  hora: "08:00", hour24: 8,  label: "Anguilla 8AM" },
  { slug: "9am",  hora: "09:00", hour24: 9,  label: "Anguilla 9AM" },
  { slug: "10am", hora: "10:00", hour24: 10, label: "Anguilla 10AM" },
  { slug: "11am", hora: "11:00", hour24: 11, label: "Anguilla 11AM" },
  { slug: "12pm", hora: "12:00", hour24: 12, label: "Anguilla 12PM" },
  { slug: "1pm",  hora: "13:00", hour24: 13, label: "Anguilla 1PM" },
  { slug: "2pm",  hora: "14:00", hour24: 14, label: "Anguilla 2PM" },
  { slug: "3pm",  hora: "15:00", hour24: 15, label: "Anguilla 3PM" },
  { slug: "4pm",  hora: "16:00", hour24: 16, label: "Anguilla 4PM" },
  { slug: "5pm",  hora: "17:00", hour24: 17, label: "Anguilla 5PM" },
  { slug: "6pm",  hora: "18:00", hour24: 18, label: "Anguilla 6PM" },
  { slug: "7pm",  hora: "19:00", hour24: 19, label: "Anguilla 7PM" },
  { slug: "8pm",  hora: "20:00", hour24: 20, label: "Anguilla 8PM" },
  { slug: "9pm",  hora: "21:00", hour24: 21, label: "Anguilla 9PM" },
  { slug: "10pm", hora: "22:00", hour24: 22, label: "Anguilla 10PM" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────

/**
 * Determina qué slot(s) scrape-ar según la hora actual de República Dominicana.
 * 
 * Modo "hora" (default / cron): Solo el slot que acaba de cerrar.
 *   - Si son las 11:05, scrapea el slot de 11am.
 *   - Si son las 15:05, scrapea el slot de 3pm.
 *
 * Modo "full": Todos los slots cuya hora ya pasó hoy (para backfill manual).
 */
function getSlotsToScrape(mode: "hora" | "full", currentHour: number): SlotConfig[] {
  if (mode === "full") {
    // Solo slots cuya hora ya pasó (no futuras)
    return SLOTS.filter(s => s.hour24 <= currentHour);
  }

  // Modo hora: buscar exactamente el slot que acaba de cerrar
  const targetSlot = SLOTS.find(s => s.hour24 === currentHour);
  if (targetSlot) {
    return [targetSlot];
  }

  // Si no hay slot exacto (e.g. se ejecutó a las 7:05 antes del primer sorteo),
  // no scrapeamos nada
  return [];
}

function extractFirstPrize(title: string): number | null {
  // Buscar patrón ": XX-YY-ZZ" — primer número es el first prize
  const match = title.match(/:\s*(\d{1,2})-\d{1,2}-\d{1,2}/);
  if (!match) return null;
  return parseInt(match[1], 10);
}

/** Extrae los 3 premios de un título "...: XX-YY-ZZ". */
function extractAllPrizes(title: string): { primero: number | null; segundo: number | null; tercero: number | null } {
  const match = title.match(/:\s*(\d{1,2})-(\d{1,2})-(\d{1,2})/);
  if (!match) return { primero: null, segundo: null, tercero: null };
  return {
    primero: parseInt(match[1], 10),
    segundo: parseInt(match[2], 10),
    tercero: parseInt(match[3], 10),
  };
}

function parseRSSItems(xml: string): Array<{ title: string; pubDate: string }> {
  const items: Array<{ title: string; pubDate: string }> = [];
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

/**
 * Del feed RSS, toma SOLO el item que dice "de hoy" y que NO sea "pendiente".
 * Retorna el primer premio (número) o null si no está disponible aún.
 */
function extractTodayResult(items: Array<{ title: string; pubDate: string }>): number | null {
  for (const item of items) {
    const lower = item.title.toLowerCase();

    // Solo nos interesa el item "de hoy"
    if (!lower.includes(" de hoy:")) continue;

    // Si dice "pendiente", el resultado aún no ha salido
    if (lower.includes("pendiente")) return null;

    // Extraer el primer premio
    return extractFirstPrize(item.title);
  }
  return null;
}

/** Igual que extractTodayResult pero retorna los 3 premios del item "de hoy". */
function extractTodayAllPrizes(
  items: Array<{ title: string; pubDate: string }>,
): { primero: number | null; segundo: number | null; tercero: number | null } {
  for (const item of items) {
    const lower = item.title.toLowerCase();
    if (!lower.includes(" de hoy:")) continue;
    if (lower.includes("pendiente")) return { primero: null, segundo: null, tercero: null };
    return extractAllPrizes(item.title);
  }
  return { primero: null, segundo: null, tercero: null };
}

// ─── Servidor Edge Function ──────────────────────────────────────────────
serve(async (req: Request) => {
  // Manejo de CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ─── Detectar modo ────────────────────────────────────────────────────
    // POST body puede incluir { mode: "full" } para backfill manual
    let mode: "hora" | "full" = "hora";
    try {
      if (req.method === "POST") {
        const body = await req.json();
        if (body?.mode === "full") mode = "full";
      }
    } catch {
      // Si no hay body o no es JSON, usamos modo "hora" por defecto
    }

    const now = new Date();
    const todayISO = formatDateInTimeZone(now, APP_TIME_ZONE);
    const { hour: currentHourAST, minute: currentMinuteAST } = getTimePartsInTimeZone(now, APP_TIME_ZONE);
    const slotsToScrape = getSlotsToScrape(mode, currentHourAST);

    const summary = {
      ok: true,
      mode,
      timeZone: APP_TIME_ZONE,
      horaActualAST: `${String(currentHourAST).padStart(2, "0")}:${String(currentMinuteAST).padStart(2, "0")}`,
      fechaHoy: todayISO,
      slotsEvaluados: slotsToScrape.map(s => s.slug),
      totalProcesadas: 0,
      nuevasInsertadas: 0,
      duplicadasIgnoradas: 0,
      sinResultado: 0,
      errores: 0,
      detalle: [] as string[],
    };

    if (slotsToScrape.length === 0) {
      summary.detalle.push(`ℹ Hora actual ${currentHourAST}:XX — ningún slot para scrapear.`);
      return new Response(JSON.stringify(summary), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // ─── Cargar mappings de BD ────────────────────────────────────────────
    const { data: sorteoData, error: sorteoErr } = await supabase
      .from("lottery_draws")
      .select("id, hora")
      .eq("activa", true);

    if (sorteoErr) throw sorteoErr;

    const sorteoMap: Record<string, string> = {};
    for (const row of sorteoData ?? []) {
      sorteoMap[row.hora] = row.id;
    }

    // ─── Precargar claves existentes SOLO de hoy para deduplicación ──────
    const { data: drawsData, error: drawsErr } = await supabase
      .from("draws")
      .select("fecha, sorteo_id")
      .eq("fecha", todayISO);

    if (drawsErr) throw drawsErr;

    const existingKeys = new Set<string>();
    for (const row of drawsData ?? []) {
      existingKeys.add(`${row.fecha}|${row.sorteo_id}`);
    }

    // ─── Procesar cada slot ──────────────────────────────────────────────
    for (const slot of slotsToScrape) {
      try {
        const url = `https://enloteria.com/rss/anguilla-${slot.slug}`;
        const response = await fetch(url);
        if (!response.ok) {
          summary.errores++;
          summary.detalle.push(`⚠ HTTP ${response.status} en ${slot.slug}`);
          continue;
        }

        const xml = await response.text();
        const items = parseRSSItems(xml);
        summary.totalProcesadas++;

        // ─── Extraer SOLO el resultado de hoy ──────────────────────────
        const prizes = extractTodayAllPrizes(items);
        const numero = prizes.primero;

        if (numero === null) {
          summary.sinResultado++;
          summary.detalle.push(`⏳ ${slot.label} — resultado de hoy aún pendiente`);
          continue;
        }

        // ─── Validar mapping BD ────────────────────────────────────────
        const sorteoId = sorteoMap[slot.hora];
        if (!sorteoId) {
          summary.errores++;
          summary.detalle.push(`⚠ Sin mapeo en BD para hora ${slot.hora}`);
          continue;
        }

        // ─── Deduplicación ─────────────────────────────────────────────
        const key = `${todayISO}|${sorteoId}`;
        if (existingKeys.has(key)) {
          summary.duplicadasIgnoradas++;
          summary.detalle.push(`≡ ${slot.label} ${todayISO} ya existe — ignorada`);
          continue;
        }

        // ─── Insertar ─────────────────────────────────────────────────
        const { error: insertErr } = await supabase.from("draws").insert({
          sorteo_id: sorteoId,
          fecha: todayISO,
          numero: numero,
          origen: "scraper",
          extra: {
            segundo: prizes.segundo,
            tercero: prizes.tercero,
          },
        });

        if (insertErr) {
          summary.errores++;
          summary.detalle.push(`✗ Error insertando ${slot.label} ${todayISO}: ${insertErr.message}`);
        } else {
          summary.nuevasInsertadas++;
          existingKeys.add(key);
          summary.detalle.push(`✓ ${slot.label} ${todayISO} → #${numero.toString().padStart(2, "0")}`);
        }
      } catch (err) {
        summary.errores++;
        summary.detalle.push(`✗ Error de red en ${slot.slug}: ${(err as Error).message}`);
      }
    }

    // ─── Persistir log de la ejecución ───────────────────────────────────
    try {
      await supabase.from("sync_logs").insert({
        ok: summary.errores === 0,
        total_procesadas: summary.totalProcesadas,
        nuevas: summary.nuevasInsertadas,
        duplicadas: summary.duplicadasIgnoradas,
        errores: summary.errores,
        detalle: summary.detalle,
      });
    } catch (logErr) {
      console.error("Failed to persist sync_logs:", (logErr as Error).message);
    }

    // ─── Re-evaluar carteras si hubo nuevos sorteos ───────────────────────
    if (summary.nuevasInsertadas > 0) {
      try {
        const evalUrl = "https://project--eaae42aa-34c4-457c-a07c-36f8131c182e.lovable.app/api/public/hooks/evaluate-results";
        const evalRes = await fetch(evalUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        const evalJson = await evalRes.json().catch(() => ({}));
        summary.detalle.push(`↻ evaluate-results: ${JSON.stringify(evalJson)}`);
      } catch (evalErr) {
        summary.detalle.push(`⚠ evaluate-results fallo: ${(evalErr as Error).message}`);
      }

      // Regenerar carteras de horas futuras con la data fresca recién insertada.
      try {
        const genUrl = "https://project--eaae42aa-34c4-457c-a07c-36f8131c182e.lovable.app/api/public/hooks/generate-carteras";
        const genRes = await fetch(genUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        const genJson = await genRes.json().catch(() => ({}));
        summary.detalle.push(`↻ generate-carteras: ${JSON.stringify(genJson)}`);
      } catch (genErr) {
        summary.detalle.push(`⚠ generate-carteras fallo: ${(genErr as Error).message}`);
      }
    }

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const msg = (error as Error).message;
    // Intentar registrar el log de error fatal también
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      await supabase.from("sync_logs").insert({
        ok: false,
        total_procesadas: 0,
        nuevas: 0,
        duplicadas: 0,
        errores: 1,
        detalle: [`✗ FATAL: ${msg}`],
      });
    } catch { /* swallow */ }

    return new Response(JSON.stringify({
      ok: false,
      error: msg
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
