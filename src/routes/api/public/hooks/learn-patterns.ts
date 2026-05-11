import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Cron — Auto-promoción / descarte de patrones (Nivel B aprendizaje).
 *
 * Lee config desde settings.clave='pattern_learning':
 *   {
 *     enabled: boolean,
 *     promote: { minOcurrencias, minEfectividad },
 *     descarte: { minOcurrencias, maxEfectividad }
 *   }
 *
 * Reglas:
 *   - estado='observacion' + ocurrencias >= promote.minOcurrencias
 *     + efectividad >= promote.minEfectividad → estado='activo'
 *   - estado='activo' + ocurrencias >= descarte.minOcurrencias
 *     + efectividad <= descarte.maxEfectividad → estado='descartado'
 *
 * Idempotente: si nada cumple las condiciones no toca la tabla.
 */

const DEFAULT_CFG = {
  enabled: true,
  promote: { minOcurrencias: 20, minEfectividad: 60 },
  descarte: { minOcurrencias: 50, maxEfectividad: 40 },
};

export const Route = createFileRoute("/api/public/hooks/learn-patterns")({
  server: {
    handlers: {
      POST: async () => {
        const { data: cfgRow } = await supabaseAdmin
          .from("settings")
          .select("valor")
          .eq("clave", "pattern_learning")
          .maybeSingle();

        const cfg = { ...DEFAULT_CFG, ...((cfgRow?.valor as any) ?? {}) };
        if (!cfg.enabled) {
          return Response.json({ ok: true, skipped: true, reason: "disabled" });
        }

        const { data: patterns, error } = await supabaseAdmin
          .from("patterns")
          .select("id, nombre, estado, ocurrencias, efectividad");
        if (error) {
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }

        const promoted: string[] = [];
        const descarted: string[] = [];
        const log: Array<{ id: string; nombre: string; from: string; to: string; ocurrencias: number; efectividad: number }> = [];

        for (const p of patterns ?? []) {
          const oc = Number(p.ocurrencias ?? 0);
          const ef = Number(p.efectividad ?? 0);

          if (
            p.estado === "observacion" &&
            oc >= cfg.promote.minOcurrencias &&
            ef >= cfg.promote.minEfectividad
          ) {
            const { error: ue } = await supabaseAdmin
              .from("patterns")
              .update({ estado: "activo" })
              .eq("id", p.id);
            if (!ue) {
              promoted.push(p.id);
              log.push({ id: p.id, nombre: p.nombre, from: "observacion", to: "activo", ocurrencias: oc, efectividad: ef });
            }
          } else if (
            p.estado === "activo" &&
            oc >= cfg.descarte.minOcurrencias &&
            ef <= cfg.descarte.maxEfectividad
          ) {
            const { error: ue } = await supabaseAdmin
              .from("patterns")
              .update({ estado: "descartado" })
              .eq("id", p.id);
            if (!ue) {
              descarted.push(p.id);
              log.push({ id: p.id, nombre: p.nombre, from: "activo", to: "descartado", ocurrencias: oc, efectividad: ef });
            }
          }
        }

        // Persistir resumen del último run en settings
        await supabaseAdmin.from("settings").upsert(
          [
            {
              clave: "pattern_learning_last_run",
              valor: {
                ranAt: new Date().toISOString(),
                promoted: promoted.length,
                descarted: descarted.length,
                evaluated: patterns?.length ?? 0,
                log: log.slice(0, 20),
              } as any,
            },
          ],
          { onConflict: "clave" },
        );

        return Response.json({
          ok: true,
          evaluated: patterns?.length ?? 0,
          promoted: promoted.length,
          descarted: descarted.length,
          log,
        });
      },
    },
  },
});