import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Cron — Auto-promoción / hibernación estacional de patrones.
 *
 * Ahora con MEMORIA ESTACIONAL: las decisiones se toman basándose en
 * la efectividad del MES ACTUAL, no en el promedio global.
 *
 * Reglas:
 *   - estado='observacion' + ocurrencias_mes >= promote.minOcurrencias
 *     + efectividad_mes >= promote.minEfectividad → estado='activo'
 *   - estado='activo' + ocurrencias_mes >= descarte.minOcurrencias
 *     + efectividad_mes <= descarte.maxEfectividad → estado='hibernando'
 *   - estado='hibernando'
 *     + efectividad_mes >= promote.minEfectividad → estado='activo' (despierta)
 *
 * Si no hay datos suficientes del mes actual, usa la efectividad global como fallback.
 * Idempotente: si nada cumple las condiciones no toca la tabla.
 */

const DEFAULT_CFG = {
  enabled: true,
  promote: { minOcurrencias: 20, minEfectividad: 60 },
  descarte: { minOcurrencias: 50, maxEfectividad: 40 },
  seasonal: { minOcurrenciasMes: 5 }, // mínimo de datos del mes para confiar en la estacional
};

/** Obtener la clave del mes actual en formato "01"-"12" */
function currentMonthKey(): string {
  return String(new Date().getMonth() + 1).padStart(2, "0");
}

/** Extraer la efectividad del mes actual del JSONB, con fallback al global */
function getSeasonalEffectiveness(
  efectividadMensual: Record<string, { ocurrencias: number; aciertos: number; efectividad: number }> | null,
  globalEfectividad: number,
  minOcurrenciasMes: number,
): { ef: number; source: "seasonal" | "global"; monthData: { oc: number; ac: number; ef: number } | null } {
  const mes = currentMonthKey();
  const monthData = efectividadMensual?.[mes];

  if (monthData && monthData.ocurrencias >= minOcurrenciasMes) {
    return {
      ef: monthData.efectividad,
      source: "seasonal",
      monthData: { oc: monthData.ocurrencias, ac: monthData.aciertos, ef: monthData.efectividad },
    };
  }

  // No hay suficientes datos del mes → usar global como fallback
  return { ef: globalEfectividad, source: "global", monthData: null };
}

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

        const mes = currentMonthKey();

        const { data: patterns, error } = await supabaseAdmin
          .from("patterns")
          .select("id, nombre, estado, ocurrencias, efectividad, efectividad_mensual");
        if (error) {
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }

        const promoted: string[] = [];
        const hibernated: string[] = [];
        const awoken: string[] = [];
        const log: Array<{
          id: string;
          nombre: string;
          from: string;
          to: string;
          ocurrencias: number;
          efectividad_global: number;
          efectividad_mes: number;
          mes: string;
          source: "seasonal" | "global";
        }> = [];

        for (const p of patterns ?? []) {
          const oc = Number(p.ocurrencias ?? 0);
          const globalEf = Number(p.efectividad ?? 0);
          const { ef: seasonalEf, source } = getSeasonalEffectiveness(
            (p as any).efectividad_mensual as any,
            globalEf,
            cfg.seasonal?.minOcurrenciasMes ?? 5,
          );

          if (
            p.estado === "observacion" &&
            oc >= cfg.promote.minOcurrencias &&
            seasonalEf >= cfg.promote.minEfectividad
          ) {
            const { error: ue } = await supabaseAdmin
              .from("patterns")
              .update({ estado: "activo" })
              .eq("id", p.id);
            if (!ue) {
              promoted.push(p.id);
              log.push({ id: p.id, nombre: p.nombre, from: "observacion", to: "activo", ocurrencias: oc, efectividad_global: globalEf, efectividad_mes: seasonalEf, mes, source });
            }
          } else if (
            p.estado === "activo" &&
            oc >= cfg.descarte.minOcurrencias &&
            seasonalEf <= cfg.descarte.maxEfectividad
          ) {
            const { error: ue } = await supabaseAdmin
              .from("patterns")
              .update({ estado: "hibernando" })
              .eq("id", p.id);
            if (!ue) {
              hibernated.push(p.id);
              log.push({ id: p.id, nombre: p.nombre, from: "activo", to: "hibernando", ocurrencias: oc, efectividad_global: globalEf, efectividad_mes: seasonalEf, mes, source });
            }
          } else if (
            p.estado === "hibernando" &&
            seasonalEf >= cfg.promote.minEfectividad
          ) {
            const { error: ue } = await supabaseAdmin
              .from("patterns")
              .update({ estado: "activo" })
              .eq("id", p.id);
            if (!ue) {
              awoken.push(p.id);
              log.push({ id: p.id, nombre: p.nombre, from: "hibernando", to: "activo", ocurrencias: oc, efectividad_global: globalEf, efectividad_mes: seasonalEf, mes, source });
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
                mes,
                promoted: promoted.length,
                hibernated: hibernated.length,
                awoken: awoken.length,
                evaluated: patterns?.length ?? 0,
                log: log.slice(0, 20),
              } as any,
            },
          ],
          { onConflict: "clave" },
        );

        return Response.json({
          ok: true,
          mes,
          evaluated: patterns?.length ?? 0,
          promoted: promoted.length,
          hibernated: hibernated.length,
          awoken: awoken.length,
          log,
        });
      },
    },
  },
});