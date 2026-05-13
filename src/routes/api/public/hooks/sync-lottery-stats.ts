import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Scrapea las páginas de estadísticas agregadas de enloteria.com para todas
 * las horas de Anguilla (8AM..10PM) y todos los periodos (30/60/90/180/365/0=todo).
 *
 * Llama a `GET https://enloteria.com/estadisticas-anguilla-{slug}?periodo=N`
 * y parsea la sección "Todos los Números" (frecuencias 00-99) y
 * "Números Vencidos" (días sin salir).
 *
 * Upsert por (hora, periodo, numero) en `lottery_stats`.
 */

const SLOTS: Array<{ slug: string; hora: string }> = [
  { slug: "8am",  hora: "08:00" },
  { slug: "9am",  hora: "09:00" },
  { slug: "10am", hora: "10:00" },
  { slug: "11am", hora: "11:00" },
  { slug: "12pm", hora: "12:00" },
  { slug: "1pm",  hora: "13:00" },
  { slug: "2pm",  hora: "14:00" },
  { slug: "3pm",  hora: "15:00" },
  { slug: "4pm",  hora: "16:00" },
  { slug: "5pm",  hora: "17:00" },
  { slug: "6pm",  hora: "18:00" },
  { slug: "7pm",  hora: "19:00" },
  { slug: "8pm",  hora: "20:00" },
  { slug: "9pm",  hora: "21:00" },
  { slug: "10pm", hora: "22:00" },
];

const PERIODOS = [30, 60, 90, 180, 365, 0]; // 0 = todo el historial

interface ParsedStats {
  totalSorteos: number | null;
  frecuencias: Map<number, number>;     // numero -> frecuencia
  vencidos: Map<number, number>;        // numero -> días sin salir
}

/** Quita tags HTML pero conserva los textos en orden, separados por `\n`. */
function htmlToText(html: string): string {
  // Saca <script> y <style> completos
  let s = html.replace(/<script[\s\S]*?<\/script>/gi, "")
              .replace(/<style[\s\S]*?<\/style>/gi, "");
  // Convierte cierres de bloque comunes en saltos
  s = s.replace(/<\/(div|p|li|h[1-6]|tr|td|span)>/gi, "$&\n");
  // Strip tags
  s = s.replace(/<[^>]+>/g, " ");
  // Decode entidades básicas
  s = s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  return s;
}

function parseStatsFromHtml(html: string): ParsedStats {
  const text = htmlToText(html);
  const lines = text.split(/\s+/).map((l) => l.trim()).filter(Boolean);

  // Total de sorteos analizados — buscar número grande seguido de "sorteos analizados"
  // El raw HTML lo tiene como "344" y luego "SORTEOS ANALIZADOS".
  let totalSorteos: number | null = null;
  const totalMatch = text.match(/(\d{2,5})\s*(?:<[^>]*>\s*)*\s*sorteos\s+analizados/i);
  if (totalMatch) totalSorteos = parseInt(totalMatch[1], 10);

  const frecuencias = new Map<number, number>();
  const vencidos = new Map<number, number>();

  // ── Vencidos: tokens tipo "48250d", "63188d" — número 2 dígitos + entero + 'd'
  for (const tok of lines) {
    const m = tok.match(/^(\d{2})(\d{1,4})d$/);
    if (m) {
      const n = parseInt(m[1], 10);
      const d = parseInt(m[2], 10);
      if (n >= 0 && n <= 99 && Number.isFinite(d)) {
        // mantener el mayor (algunas horas listan varias veces el mismo)
        const prev = vencidos.get(n);
        if (prev === undefined || d > prev) vencidos.set(n, d);
      }
    }
  }

  // ── Frecuencias: tokens tipo "0012", "8322", "4714" — 2 dígitos numero + freq.
  // Ojo: también aparecen patrones tipo "83×22" para hot/cold; los soportamos.
  for (const tok of lines) {
    // Patrón con × o x (calientes/fríos)
    let m = tok.match(/^(\d{1,2})[×x](\d{1,4})$/);
    if (m) {
      const n = parseInt(m[1], 10);
      const f = parseInt(m[2], 10);
      if (n >= 0 && n <= 99 && Number.isFinite(f)) {
        const prev = frecuencias.get(n);
        if (prev === undefined || f > prev) frecuencias.set(n, f);
      }
      continue;
    }
    // Patrón compacto "NNFF" (sección "Todos los Números"): 2 dígitos + freq sin separador.
    m = tok.match(/^(\d{2})(\d{1,3})$/);
    if (m && !tok.endsWith("d")) {
      const n = parseInt(m[1], 10);
      const f = parseInt(m[2], 10);
      if (n >= 0 && n <= 99 && Number.isFinite(f) && f >= 0 && f <= 9999) {
        const prev = frecuencias.get(n);
        if (prev === undefined || f > prev) frecuencias.set(n, f);
      }
    }
  }

  return { totalSorteos, frecuencias, vencidos };
}

async function fetchStats(slug: string, periodo: number): Promise<ParsedStats> {
  const url = `https://enloteria.com/estadisticas-anguilla-${slug}?periodo=${periodo}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; AnaLizaBot/1.0; +https://ana-liza.xyz)",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${slug}/${periodo}`);
  const html = await res.text();
  return parseStatsFromHtml(html);
}

export const Route = createFileRoute("/api/public/hooks/sync-lottery-stats")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        // Filtros opcionales: ?slug=8am&periodo=30 para debugging.
        const onlySlug = url.searchParams.get("slug");
        const onlyPeriodo = url.searchParams.get("periodo");
        const triggeredBy = url.searchParams.get("triggered_by") ?? "manual";
        const startedAt = Date.now();

        const slots = onlySlug ? SLOTS.filter((s) => s.slug === onlySlug) : SLOTS;
        const periodos = onlyPeriodo
          ? [parseInt(onlyPeriodo, 10)].filter((n) => Number.isFinite(n))
          : PERIODOS;

        const summary = {
          ok: true,
          slots: slots.length,
          periodos: periodos.length,
          combinaciones: slots.length * periodos.length,
          upserts: 0,
          errores: 0,
          detalle: [] as string[],
        };
        const bySlot: Record<string, {
          slug: string;
          hora: string;
          upserts: number;
          errores: number;
          periodos_ok: number;
          periodos_total: number;
        }> = {};

        // Concurrencia simple: procesar slots en serie, periodos en paralelo (6 a la vez)
        for (const slot of slots) {
          const slotStat = {
            slug: slot.slug,
            hora: slot.hora,
            upserts: 0,
            errores: 0,
            periodos_ok: 0,
            periodos_total: periodos.length,
          };
          bySlot[slot.hora] = slotStat;
          const results = await Promise.allSettled(
            periodos.map((periodo) => fetchStats(slot.slug, periodo).then((p) => ({ periodo, p }))),
          );

          const rows: Array<{
            hora: string;
            periodo: number;
            numero: number;
            frecuencia: number;
            dias_vencido: number | null;
            total_sorteos: number | null;
          }> = [];

          for (const r of results) {
            if (r.status === "rejected") {
              summary.errores++;
              slotStat.errores++;
              summary.detalle.push(`✗ ${slot.slug}: ${(r.reason as Error).message}`);
              continue;
            }
            slotStat.periodos_ok++;
            const { periodo, p } = r.value;
            // Para cada número 0-99 que aparezca en frecuencias, guardamos
            // (los que no aparecen en frecuencias se omiten — frecuencia 0 puede
            // significar "sin datos" o "no salió"; preferimos no inventar).
            for (const [numero, frecuencia] of p.frecuencias.entries()) {
              rows.push({
                hora: slot.hora,
                periodo,
                numero,
                frecuencia,
                dias_vencido: p.vencidos.get(numero) ?? null,
                total_sorteos: p.totalSorteos,
              });
            }
          }

          if (rows.length > 0) {
            const { error } = await supabaseAdmin
              .from("lottery_stats")
              .upsert(rows, { onConflict: "hora,periodo,numero" });
            if (error) {
              summary.errores++;
              slotStat.errores++;
              summary.detalle.push(`✗ upsert ${slot.slug}: ${error.message}`);
            } else {
              summary.upserts += rows.length;
              slotStat.upserts += rows.length;
              summary.detalle.push(`✓ ${slot.slug} → ${rows.length} filas`);
            }
          }
        }

        // Persistir bitácora
        const durationMs = Date.now() - startedAt;
        const ok = summary.errores === 0;
        await supabaseAdmin.from("lottery_stats_sync_runs").insert({
          ok,
          duration_ms: durationMs,
          slots_total: slots.length,
          periodos_total: periodos.length,
          combinaciones: slots.length * periodos.length,
          upserts: summary.upserts,
          errores: summary.errores,
          detalle: summary.detalle,
          by_slot: bySlot,
          triggered_by: triggeredBy,
        });

        return Response.json(summary);
      },
    },
  },
});
