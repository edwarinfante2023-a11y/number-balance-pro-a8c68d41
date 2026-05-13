import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  buildCartera,
  type CarteraPattern,
  type CarteraRule,
} from "@/lib/carteraEngine";
import type { Draw } from "@/hooks/useDraws";

/**
 * Cron hook — genera/upserta carteras para todas las horas activas del día.
 * Llamado por pg_cron cada hora a `:02` (antes del evaluador a `:05`).
 * Idempotente por (fecha, hora, estrategia).
 */
export const Route = createFileRoute("/api/public/hooks/generate-carteras")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const fecha = new Date().toISOString().slice(0, 10);
        const url = new URL(request.url);
        const force = url.searchParams.get("force") === "true";
        const tz = url.searchParams.get("tz") ?? "America/Bogota";

        // Hora actual "HH:mm" en la zona de las loterías (default Colombia).
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
        const [{ data: rawDraws, error: e1 }, { data: rawRules, error: e2 }, { data: rawPatterns, error: e3 }] =
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
          ]);
        if (e1 || e2 || e3) {
          return Response.json(
            { ok: false, error: e1?.message ?? e2?.message ?? e3?.message },
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

        // 3. Generar/upsert por hora
        const generated: Array<{ hora: string; internalScore: number }> = [];
        const errors: Array<{ hora: string; error: string }> = [];
        for (const hora of horas) {
          try {
            const r = buildCartera(
              draws,
              (rawRules ?? []) as CarteraRule[],
              (rawPatterns ?? []) as CarteraPattern[],
              hora,
            );
            const { error } = await supabaseAdmin.from("carteras").upsert(
              [{
                fecha,
                hora,
                numeros: r.numeros,
                scores: r.scores,
                estrategia: r.contexto.estrategia,
                contexto: { ...r.contexto, reasons: r.reasons },
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