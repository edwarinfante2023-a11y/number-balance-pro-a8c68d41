import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// ─── Headers CORS ────────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Tipos y Config ──────────────────────────────────────────────────────
interface SlotConfig {
  slug: string;
  hora: string;
  label: string;
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

// ─── Helpers de Parseo ───────────────────────────────────────────────────

const MESES: Record<string, string> = {
  "enero": "01", "febrero": "02", "marzo": "03", "abril": "04",
  "mayo": "05", "junio": "06", "julio": "07", "agosto": "08",
  "septiembre": "09", "octubre": "10", "noviembre": "11", "diciembre": "12"
};

function getOffsetDate(daysOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseRealDateFromTitle(title: string, fallbackPubDate: string): string | null {
  const lower = title.toLowerCase();
  
  if (lower.includes(" de hoy:")) {
    return getOffsetDate(0);
  }
  if (lower.includes(" de ayer:")) {
    return getOffsetDate(-1);
  }
  
  // Buscar patrón "del [diaSemana] [dia] de [mes]:"
  const dateMatch = lower.match(/del\s+[a-z]+\s+(\d{1,2})\s+de\s+([a-z]+):/);
  if (dateMatch) {
    const day = dateMatch[1].padStart(2, "0");
    const monthStr = dateMatch[2];
    const month = MESES[monthStr];
    if (month) {
      const year = new Date().getFullYear();
      return `${year}-${month}-${day}`;
    }
  }

  // Fallback a pubDate si el título no dice nada útil
  const d = new Date(fallbackPubDate);
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function extractFirstPrize(title: string): number | null {
  const match = title.match(/:\s*(\d{1,2})-\d{1,2}-\d{1,2}/);
  if (!match) return null;
  return parseInt(match[1], 10);
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

// ─── Logic ───────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  // Manejo de CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const summary = {
      ok: true,
      totalProcesadas: 0,
      nuevasInsertadas: 0,
      duplicadasIgnoradas: 0,
      errores: 0,
      detalle: [] as string[],
    };

    const { data: sorteoData, error: sorteoErr } = await supabase
      .from("lottery_draws")
      .select("id, hora")
      .eq("activa", true);

    if (sorteoErr) throw sorteoErr;

    const sorteoMap: Record<string, string> = {};
    for (const row of sorteoData ?? []) {
      sorteoMap[row.hora] = row.id;
    }

    const { data: drawsData, error: drawsErr } = await supabase
      .from("draws")
      .select("fecha, sorteo_id");

    if (drawsErr) throw drawsErr;

    const existingKeys = new Set<string>();
    for (const row of drawsData ?? []) {
      existingKeys.add(`${row.fecha}|${row.sorteo_id}`);
    }

    for (const slot of SLOTS) {
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

        for (const item of items) {
          const fecha = parseRealDateFromTitle(item.title, item.pubDate);
          const numero = extractFirstPrize(item.title);
          
          if (!fecha || numero === null) continue;
          
          summary.totalProcesadas++;

          const sorteoId = sorteoMap[slot.hora];
          if (!sorteoId) {
            summary.errores++;
            summary.detalle.push(`⚠ Sin mapeo en BD para hora ${slot.hora}`);
            continue;
          }

          const key = `${fecha}|${sorteoId}`;
          if (existingKeys.has(key)) {
            summary.duplicadasIgnoradas++;
            continue;
          }

          const { error: insertErr } = await supabase.from("draws").insert({
            sorteo_id: sorteoId,
            fecha: fecha,
            numero: numero,
            origen: "scraper",
          });

          if (insertErr) {
            summary.errores++;
            summary.detalle.push(`✗ Error insertando ${slot.label} ${fecha}: ${insertErr.message}`);
          } else {
            summary.nuevasInsertadas++;
            existingKeys.add(key);
            summary.detalle.push(`✓ ${slot.label} ${fecha} → #${numero.toString().padStart(2, "0")}`);
          }
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
