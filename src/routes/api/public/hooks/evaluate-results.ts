import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Cron hook — evalúa carteras vs draws ganadores de las últimas 48h.
 * Idempotente gracias al UNIQUE (cartera_id) en cartera_resultados.
 * Programado a `:05` cada hora, después del scraper.
 */
export const Route = createFileRoute("/api/public/hooks/evaluate-results")({
  server: {
    handlers: {
      POST: async () => {
        const since = new Date(Date.now() - 48 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10);

        // 1. Draws recientes con su hora
        const { data: rawDraws, error: e1 } = await supabaseAdmin
          .from("draws")
          .select("numero, fecha, extra, lottery_draws!inner(hora)")
          .gte("fecha", since);
        if (e1) {
          return Response.json({ ok: false, error: e1.message }, { status: 500 });
        }

        // Index por (fecha, hora) → numero ganador (último gana en empate)
        const ganadores = new Map<string, { primero: number; segundo: number | null; tercero: number | null }>();
        for (const d of (rawDraws ?? []) as any[]) {
          const hora = d.lottery_draws?.hora;
          if (!hora) continue;
          const extra = (d.extra ?? {}) as { segundo?: number | null; tercero?: number | null };
          ganadores.set(`${d.fecha}|${hora}`, {
            primero: d.numero,
            segundo: extra.segundo ?? null,
            tercero: extra.tercero ?? null,
          });
        }
        if (ganadores.size === 0) {
          return Response.json({ ok: true, evaluadas: 0, aciertos: 0, msg: "sin draws recientes" });
        }

        // 2. Carteras de esas (fecha, hora) sin resultado aún
        const { data: carteras, error: e2 } = await supabaseAdmin
          .from("carteras")
          .select("id, fecha, hora, numeros")
          .gte("fecha", since);
        if (e2) {
          return Response.json({ ok: false, error: e2.message }, { status: 500 });
        }

        const rows: Array<{
          cartera_id: string;
          numero_ganador: number;
          acierto: boolean;
          numero_segundo: number | null;
          numero_tercero: number | null;
          acierto_segundo: boolean | null;
          acierto_tercero: boolean | null;
        }> = [];
        for (const c of (carteras ?? []) as any[]) {
          const g = ganadores.get(`${c.fecha}|${c.hora}`);
          if (!g) continue;
          const numeros: number[] = Array.isArray(c.numeros) ? c.numeros : [];
          rows.push({
            cartera_id: c.id,
            numero_ganador: g.primero,
            acierto: numeros.includes(g.primero),
            numero_segundo: g.segundo,
            numero_tercero: g.tercero,
            acierto_segundo: g.segundo !== null ? numeros.includes(g.segundo) : null,
            acierto_tercero: g.tercero !== null ? numeros.includes(g.tercero) : null,
          });
        }

        if (rows.length === 0) {
          return Response.json({ ok: true, evaluadas: 0, aciertos: 0, msg: "sin carteras coincidentes" });
        }

        // 3. Upsert masivo
        const { error: e3 } = await supabaseAdmin
          .from("cartera_resultados")
          .upsert(rows, { onConflict: "cartera_id" });
        if (e3) {
          return Response.json({ ok: false, error: e3.message }, { status: 500 });
        }

        const aciertos = rows.filter((r) => r.acierto).length;
        return Response.json({
          ok: true,
          evaluadas: rows.length,
          aciertos,
          hitRate: rows.length > 0 ? aciertos / rows.length : null,
        });
      },
    },
  },
});