import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Cron — busca carteras de hoy cuyo sorteo ocurra en los próximos 25-35 min,
 * con internalScore >= 70 y sin resultado aún. Crea opportunity_alerts y
 * dispara send-opportunity-push.
 */
const THRESHOLD = 70;
const LEAD_MIN = 25;
const LEAD_MAX = 35;

export const Route = createFileRoute("/api/public/hooks/scan-opportunities")({
  server: {
    handlers: {
      POST: async () => {
        const now = new Date();
        const fecha = now.toISOString().slice(0, 10);
        const minutesNow = now.getHours() * 60 + now.getMinutes();
        const lo = minutesNow + LEAD_MIN;
        const hi = minutesNow + LEAD_MAX;

        // 1. Carteras del día
        const { data: carteras, error: e1 } = await supabaseAdmin
          .from("carteras")
          .select("id, fecha, hora, contexto")
          .eq("fecha", fecha);
        if (e1) return Response.json({ ok: false, error: e1.message }, { status: 500 });

        const candidates: Array<{
          id: string; hora: string; internal_score: number; top_mean: number; gap: number;
        }> = [];

        for (const c of carteras ?? []) {
          const [hh, mm] = String(c.hora).split(":").map((v) => parseInt(v, 10));
          if (Number.isNaN(hh) || Number.isNaN(mm)) continue;
          const slotMin = hh * 60 + mm;
          if (slotMin < lo || slotMin > hi) continue;

          const conf = (c.contexto as any)?.confidence ?? {};
          const score = Number(conf.internalScore ?? 0);
          if (score < THRESHOLD) continue;

          candidates.push({
            id: c.id,
            hora: c.hora,
            internal_score: score,
            top_mean: Number(conf.topMean ?? 0),
            gap: Number(conf.gap ?? 0),
          });
        }

        if (candidates.length === 0) {
          return Response.json({ ok: true, fecha, window: [lo, hi], candidates: 0 });
        }

        // 2. Excluir carteras ya con resultado
        const ids = candidates.map((c) => c.id);
        const { data: yaEvaluadas } = await supabaseAdmin
          .from("cartera_resultados")
          .select("cartera_id")
          .in("cartera_id", ids);
        const evalSet = new Set((yaEvaluadas ?? []).map((r: any) => r.cartera_id));
        const fresh = candidates.filter((c) => !evalSet.has(c.id));

        if (fresh.length === 0) {
          return Response.json({ ok: true, fecha, candidates: candidates.length, fresh: 0 });
        }

        // 3. Insertar alerts (UNIQUE fecha+hora descarta duplicados)
        const inserted: Array<{ id: string; hora: string; internal_score: number }> = [];
        for (const c of fresh) {
          const { data, error } = await supabaseAdmin
            .from("opportunity_alerts")
            .insert({
              fecha,
              hora: c.hora,
              cartera_id: c.id,
              internal_score: c.internal_score,
              top_mean: c.top_mean,
              gap: c.gap,
            })
            .select("id, hora, internal_score")
            .single();
          if (!error && data) inserted.push(data as any);
        }

        // 4. Disparar push si hay nuevas
        let pushResult: any = null;
        if (inserted.length > 0) {
          try {
            const url = `${process.env.SUPABASE_URL}/functions/v1/send-opportunity-push`;
            const resp = await fetch(url, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
              },
              body: JSON.stringify({ alerts: inserted }),
            });
            pushResult = await resp.json().catch(() => null);
          } catch (err: any) {
            pushResult = { error: err?.message ?? String(err) };
          }
        }

        return Response.json({
          ok: true,
          fecha,
          window: [lo, hi],
          candidates: candidates.length,
          fresh: fresh.length,
          inserted: inserted.length,
          pushResult,
        });
      },
    },
  },
});