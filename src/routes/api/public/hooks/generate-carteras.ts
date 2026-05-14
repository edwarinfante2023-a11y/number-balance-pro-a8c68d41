import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  ADAPTIVE_STRATEGY,
  buildCartera,
  classifyWeek,
  godModePredict,
  type CarteraPattern,
  type CarteraRule,
  type CarteraHistoricalStats,
} from "@/lib/carteraEngine";
import type { Draw } from "@/hooks/useDraws";
import { APP_TIME_ZONE, formatDateInTimeZone } from "@/lib/timezone";

/**
 * Cron hook — genera/upserta carteras para todas las horas activas del día.
 * Llamado por pg_cron cada hora a `:02` (antes del evaluador a `:05`).
 * Idempotente por (fecha, hora, estrategia).
 */
export const Route = createFileRoute("/api/public/hooks/generate-carteras")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const force = url.searchParams.get("force") === "true";
        const tz = url.searchParams.get("tz") ?? APP_TIME_ZONE;
        const fecha = formatDateInTimeZone(new Date(), tz);

        // Hora actual "HH:mm" en la zona de las loterías.
        const ahora = new Intl.DateTimeFormat("en-GB", {
          timeZone: tz,
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(new Date());

        // 1. Horas activas (distinct) de lottery_draws activos
        const { data: sorteos, error: eS } = await supabaseAdmin
          .from("lottery_draws")
          .select("hora, activa")
          .eq("activa", true);
        if (eS) {
          return Response.json({ ok: false, error: eS.message }, { status: 500 });
        }
        const horasTodas = Array.from(new Set((sorteos ?? []).map((s) => s.hora))).sort();
        // Si force=true (cron diario 00:02), generar todo. Si no, solo futuras.
        const horas = force ? horasTodas : horasTodas.filter((h) => h > ahora);
        const skipped = horasTodas.length - horas.length;

        // 2. Inputs comunes (una sola lectura)
        const [
          { data: rawDraws, error: e1 },
          { data: rawRules, error: e2 },
          { data: rawPatterns, error: e3 },
          { data: rawStats, error: e4 },
        ] =
          await Promise.all([
            supabaseAdmin
              .from("draws")
              .select("*, lottery_draws!inner(id, hora, nombre, loteria_id, lotteries!inner(id, nombre))")
              .order("fecha", { ascending: false })
              .limit(5000),
            supabaseAdmin.from("rules").select("id,nombre,resultado_esperado,efectividad,activo").eq("activo", true),
            supabaseAdmin
              .from("patterns")
              .select("id,nombre,resultado_esperado,efectividad,hora,activa,estado")
              .eq("activa", true),
            // Stats históricas: usamos periodo=0 (todo el historial) por defecto.
            supabaseAdmin
              .from("lottery_stats")
              .select("hora,numero,frecuencia,dias_vencido,total_sorteos")
              .eq("periodo", 0),
          ]);
        if (e1 || e2 || e3 || e4) {
          return Response.json(
            { ok: false, error: e1?.message ?? e2?.message ?? e3?.message ?? e4?.message },
            { status: 500 },
          );
        }

        const draws: Draw[] = (rawDraws ?? []).map((r: any) => ({
          ...r,
          hora: r.lottery_draws.hora,
          loteria: r.lottery_draws.lotteries.nombre,
          loteria_id: r.lottery_draws.loteria_id,
          sorteo_nombre: r.lottery_draws.nombre,
        }));

        // Indexar stats por hora para lookup O(1)
        const statsByHora = new Map<string, CarteraHistoricalStats>();
        for (const row of rawStats ?? []) {
          let entry = statsByHora.get(row.hora);
          if (!entry) {
            entry = { frecuencias: {}, vencidos: {}, totalSorteos: row.total_sorteos ?? 0 };
            statsByHora.set(row.hora, entry);
          }
          entry.frecuencias[row.numero] = row.frecuencia;
          if (row.dias_vencido != null) entry.vencidos[row.numero] = row.dias_vencido;
          if (row.total_sorteos && row.total_sorteos > entry.totalSorteos) {
            entry.totalSorteos = row.total_sorteos;
          }
        }

        // 3. Generar/upsert por hora
        const generated: Array<{ hora: string; internalScore: number }> = [];
        const errors: Array<{ hora: string; error: string }> = [];
        for (const hora of horas) {
          try {
            // ─── SISTEMA DUAL AI (Fase 14) ─────────────────────
            const drawsForDual = draws.map(d => ({
              numero: d.numero,
              fecha: d.fecha,
              hora: d.hora,
            }));
            const recentForRadar = draws
              .filter(d => d.hora === hora)
              .sort((a, b) => `${b.fecha}`.localeCompare(`${a.fecha}`))
              .slice(0, 5);
            const weekType = classifyWeek(recentForRadar);
            const godResult = godModePredict(drawsForDual, hora, fecha);

            const r = buildCartera(
              draws,
              (rawRules ?? []) as CarteraRule[],
              (rawPatterns ?? []) as CarteraPattern[],
              hora,
              statsByHora.get(hora),
              {
                strategy: ADAPTIVE_STRATEGY,
                godModeQuadrant: godResult?.quadrant ?? null,
                weekType,
              },
            );
            const { error } = await supabaseAdmin.from("carteras").upsert(
              [{
                fecha,
                hora,
                numeros: r.numeros,
                scores: r.scores as any,
                estrategia: ADAPTIVE_STRATEGY,
                contexto: JSON.parse(JSON.stringify({ ...r.contexto, reasons: r.reasons })) as any,
              }],
              { onConflict: "fecha,hora,estrategia" },
            );
            if (error) errors.push({ hora, error: error.message });
            else generated.push({ hora, internalScore: r.contexto.confidence.internalScore });
          } catch (err: any) {
            errors.push({ hora, error: err?.message ?? String(err) });
          }
        }

        return Response.json({
          ok: true,
          fecha,
          ahora,
          tz,
          force,
          horas: horas.length,
          skipped,
          generated,
          errors,
        });
      },
    },
  },
});
