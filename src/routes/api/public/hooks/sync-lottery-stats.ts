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

function parseStatsFromHtml(html: string): ParsedStats {
  const frecuencias = new Map<number, number>();
  const vencidos = new Map<number, number>();

  // ── Total de sorteos analizados (card "Sorteos Analizados")
  let totalSorteos: number | null = null;
  const totalMatch = html.match(
    /stats-card-value">\s*(\d{1,5})\s*<\/div>\s*<div class="stats-card-label">\s*Sorteos\s+Analizados/i,
  );
  if (totalMatch) totalSorteos = parseInt(totalMatch[1], 10);

  // ── Frecuencias: el grid "Todos los Números" usa title="NN: ×F" en cada celda.
  // Esto da los 100 números de forma 100% confiable.
  const freqRegex = /title="(\d{2}):\s*[×x](\d{1,4})"/g;
  let m: RegExpExecArray | null;
  while ((m = freqRegex.exec(html)) !== null) {
    const n = parseInt(m[1], 10);
    const f = parseInt(m[2], 10);
    if (n >= 0 && n <= 99 && Number.isFinite(f)) {
      // El grid puede repetir un número entre secciones (calientes/fríos/todos);
      // nos quedamos con el mayor para representar la frecuencia total.
      const prev = frecuencias.get(n);
      if (prev === undefined || f > prev) frecuencias.set(n, f);
    }
  }

  // ── Vencidos: <span class="stats-ball overdue">NN</span> ... <span class="stats-count">Dd</span>
  const vencRegex = /stats-ball\s+overdue">\s*(\d{2})\s*<\/span>\s*<span\s+class="stats-count">\s*(\d{1,5})d\s*</gi;
  while ((m = vencRegex.exec(html)) !== null) {
    const n = parseInt(m[1], 10);
    const d = parseInt(m[2], 10);
    if (n >= 0 && n <= 99 && Number.isFinite(d)) {
      const prev = vencidos.get(n);
      if (prev === undefined || d > prev) vencidos.set(n, d);
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
