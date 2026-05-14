import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * 🧠 Robot Autónomo v2 — Auto-promoción / hibernación / caducidad de patrones.
 *
 * Capacidades:
 *   1. ESTACIONALIDAD: decisiones basadas en efectividad del MES ACTUAL
 *   2. TIME-DECAY: detecta cambio de algoritmo comparando trimestres
 *   3. VENTANA TEMPORAL: patrones con active_months se auto-activan/desactivan
 *
 * Reglas de transición:
 *   - observacion → activo: suficientes ocurrencias + buena efectividad estacional
 *   - activo → hibernando: muchas ocurrencias + mala efectividad estacional
 *   - hibernando → activo: efectividad estacional mejora (el algoritmo regresó)
 *   - activo/observacion → caducado: Time-Decay detecta declive sostenido
 *   - caducado → observacion: trimestre actual muestra recuperación ≥60%
 *   - cualquier estado: si tiene active_months y el mes actual no está → off_season
 *
 * Idempotente: si nada cumple las condiciones no toca la tabla.
 */

const DEFAULT_CFG = {
  enabled: true,
  promote: { minOcurrencias: 20, minEfectividad: 60 },
  descarte: { minOcurrencias: 50, maxEfectividad: 40 },
  seasonal: { minOcurrenciasMes: 5 },
  decay: {
    /** Mínimo de trimestres con datos para evaluar tendencia */
    minQuarters: 2,
    /** Caída mínima en puntos por trimestre para considerar "declive" */
    declineThreshold: 15,
    /** Efectividad mínima del último trimestre para NO caducar */
    minLastQuarter: 30,
    /** Efectividad mínima del trimestre actual para revivir un caducado */
    reviveThreshold: 60,
  },
};

// ─── Helpers ──────────────────────────────────────────────────────

/** Obtener la clave del mes actual en formato "01"-"12" */
function currentMonthKey(): string {
  return String(new Date().getMonth() + 1).padStart(2, "0");
}

/** Obtener el número de mes actual (1-12) */
function currentMonthNumber(): number {
  return new Date().getMonth() + 1;
}

/** Obtener la clave del trimestre actual: "2026-Q1" */
function currentQuarterKey(): string {
  const now = new Date();
  const q = Math.ceil((now.getMonth() + 1) / 3);
  return `${now.getFullYear()}-Q${q}`;
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

/**
 * Analiza la tendencia de efectividad por trimestres.
 * Retorna el trend y los datos por trimestre para auditoría.
 */
type DecayTrend = "stable" | "declining" | "recovering" | "dead";

interface QuarterData {
  quarter: string;
  efectividad: number;
  ocurrencias: number;
}

function analyzeDecayTrend(
  efectividadTrimestral: Record<string, { ocurrencias: number; aciertos: number; efectividad: number }> | null,
  cfg: typeof DEFAULT_CFG.decay,
): { trend: DecayTrend; quarters: QuarterData[]; lastQuarterEf: number } {
  if (!efectividadTrimestral) {
    return { trend: "stable", quarters: [], lastQuarterEf: 0 };
  }

  // Ordenar trimestres cronológicamente
  const quarters = Object.entries(efectividadTrimestral)
    .map(([key, val]) => ({
      quarter: key,
      efectividad: val.efectividad,
      ocurrencias: val.ocurrencias,
    }))
    .filter((q) => q.ocurrencias >= 5) // mínimo de datos para confiar
    .sort((a, b) => a.quarter.localeCompare(b.quarter));

  if (quarters.length < cfg.minQuarters) {
    return { trend: "stable", quarters, lastQuarterEf: quarters[quarters.length - 1]?.efectividad ?? 0 };
  }

  const lastQ = quarters[quarters.length - 1];
  const prevQ = quarters[quarters.length - 2];

  // Contar trimestres consecutivos en declive (desde el más reciente hacia atrás)
  let consecutiveDeclines = 0;
  for (let i = quarters.length - 1; i >= 1; i--) {
    const diff = quarters[i - 1].efectividad - quarters[i].efectividad;
    if (diff >= cfg.declineThreshold) {
      consecutiveDeclines++;
    } else {
      break;
    }
  }

  // Determinar trend
  let trend: DecayTrend;
  if (lastQ.efectividad < cfg.minLastQuarter && consecutiveDeclines >= 2) {
    trend = "dead"; // Declive terminal: 2+ trimestres cayendo y ahora bajo 30%
  } else if (consecutiveDeclines >= 2) {
    trend = "declining"; // En caída sostenida pero aún no terminal
  } else if (prevQ && lastQ.efectividad > prevQ.efectividad + 10) {
    trend = "recovering"; // Subiendo respecto al trimestre anterior
  } else {
    trend = "stable";
  }

  return { trend, quarters, lastQuarterEf: lastQ.efectividad };
}

/**
 * Verifica si un patrón con active_months debería estar activo en el mes actual.
 */
function isInActiveWindow(condiciones: any): boolean | null {
  const activeMonths = condiciones?.active_months;
  if (!Array.isArray(activeMonths) || activeMonths.length === 0) {
    return null; // No tiene ventana → no aplica
  }
  return activeMonths.includes(currentMonthNumber());
}

// ─── Endpoint ─────────────────────────────────────────────────────

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
        const quarter = currentQuarterKey();

        const { data: patterns, error } = await supabaseAdmin
          .from("patterns")
          .select("id, nombre, estado, ocurrencias, efectividad, condiciones, efectividad_mensual");
        if (error) {
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }

        const promoted: string[] = [];
        const hibernated: string[] = [];
        const awoken: string[] = [];
        const expired: string[] = [];   // caducados por time-decay
        const revived: string[] = [];   // revividos desde caducado
        const offSeason: string[] = []; // fuera de temporada
        const inSeason: string[] = [];  // vuelto a temporada

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
          reason: string;
          decay_trend?: DecayTrend;
          quarters?: QuarterData[];
        }> = [];

        for (const p of patterns ?? []) {
          const oc = Number(p.ocurrencias ?? 0);
          const globalEf = Number(p.efectividad ?? 0);
          const condiciones = (p as any).condiciones ?? {};
          const { ef: seasonalEf, source } = getSeasonalEffectiveness(
            (p as any).efectividad_mensual as any,
            globalEf,
            cfg.seasonal?.minOcurrenciasMes ?? 5,
          );

          // ── Ventana Temporal (active_months) ─────────────────
          const inWindow = isInActiveWindow(condiciones);
          if (inWindow === false && p.estado === "activo") {
            // Fuera de temporada → hibernar
            const { error: ue } = await supabaseAdmin
              .from("patterns")
              .update({ estado: "hibernando", activa: false })
              .eq("id", p.id);
            if (!ue) {
              offSeason.push(p.id);
              log.push({
                id: p.id, nombre: p.nombre, from: "activo", to: "hibernando",
                ocurrencias: oc, efectividad_global: globalEf, efectividad_mes: seasonalEf,
                mes, source, reason: "off_season",
              });
            }
            continue; // no evaluar más reglas para este patrón
          }
          if (inWindow === true && p.estado === "hibernando") {
            // Entró en temporada → reactivar si la efectividad es buena
            if (seasonalEf >= cfg.promote.minEfectividad) {
              const { error: ue } = await supabaseAdmin
                .from("patterns")
                .update({ estado: "activo", activa: true })
                .eq("id", p.id);
              if (!ue) {
                inSeason.push(p.id);
                log.push({
                  id: p.id, nombre: p.nombre, from: "hibernando", to: "activo",
                  ocurrencias: oc, efectividad_global: globalEf, efectividad_mes: seasonalEf,
                  mes, source, reason: "in_season",
                });
              }
              continue;
            }
          }

          // ── Time-Decay (análisis trimestral) ─────────────────
          const decayCfg = cfg.decay ?? DEFAULT_CFG.decay;
          const { trend, quarters, lastQuarterEf } = analyzeDecayTrend(
            (p as any).efectividad_trimestral ?? (p as any).efectividad_mensual,
            decayCfg,
          );

          if (trend === "dead" && p.estado !== "caducado") {
            // Declive terminal → caducar
            const { error: ue } = await supabaseAdmin
              .from("patterns")
              .update({ estado: "caducado", activa: false })
              .eq("id", p.id);
            if (!ue) {
              expired.push(p.id);
              log.push({
                id: p.id, nombre: p.nombre, from: p.estado, to: "caducado",
                ocurrencias: oc, efectividad_global: globalEf, efectividad_mes: seasonalEf,
                mes, source, reason: "algorithm_shift",
                decay_trend: trend, quarters,
              });
            }
            continue;
          }

          if (p.estado === "caducado" && lastQuarterEf >= decayCfg.reviveThreshold) {
            // El algoritmo volvió a su ciclo → revivir
            const { error: ue } = await supabaseAdmin
              .from("patterns")
              .update({ estado: "observacion", activa: false })
              .eq("id", p.id);
            if (!ue) {
              revived.push(p.id);
              log.push({
                id: p.id, nombre: p.nombre, from: "caducado", to: "observacion",
                ocurrencias: oc, efectividad_global: globalEf, efectividad_mes: seasonalEf,
                mes, source, reason: "algorithm_returned",
                decay_trend: "recovering", quarters,
              });
            }
            continue;
          }

          // ── Reglas clásicas de promoción / hibernación ───────
          if (
            p.estado === "observacion" &&
            oc >= cfg.promote.minOcurrencias &&
            seasonalEf >= cfg.promote.minEfectividad
          ) {
            const { error: ue } = await supabaseAdmin
              .from("patterns")
              .update({ estado: "activo", activa: true })
              .eq("id", p.id);
            if (!ue) {
              promoted.push(p.id);
              log.push({
                id: p.id, nombre: p.nombre, from: "observacion", to: "activo",
                ocurrencias: oc, efectividad_global: globalEf, efectividad_mes: seasonalEf,
                mes, source, reason: "promoted",
                decay_trend: trend, quarters,
              });
            }
          } else if (
            p.estado === "activo" &&
            oc >= cfg.descarte.minOcurrencias &&
            seasonalEf <= cfg.descarte.maxEfectividad
          ) {
            const { error: ue } = await supabaseAdmin
              .from("patterns")
              .update({ estado: "hibernando", activa: false })
              .eq("id", p.id);
            if (!ue) {
              hibernated.push(p.id);
              log.push({
                id: p.id, nombre: p.nombre, from: "activo", to: "hibernando",
                ocurrencias: oc, efectividad_global: globalEf, efectividad_mes: seasonalEf,
                mes, source, reason: "low_effectiveness",
                decay_trend: trend, quarters,
              });
            }
          } else if (
            p.estado === "hibernando" &&
            seasonalEf >= cfg.promote.minEfectividad
          ) {
            const { error: ue } = await supabaseAdmin
              .from("patterns")
              .update({ estado: "activo", activa: true })
              .eq("id", p.id);
            if (!ue) {
              awoken.push(p.id);
              log.push({
                id: p.id, nombre: p.nombre, from: "hibernando", to: "activo",
                ocurrencias: oc, efectividad_global: globalEf, efectividad_mes: seasonalEf,
                mes, source, reason: "recovered",
                decay_trend: trend, quarters,
              });
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
                quarter,
                promoted: promoted.length,
                hibernated: hibernated.length,
                awoken: awoken.length,
                expired: expired.length,
                revived: revived.length,
                offSeason: offSeason.length,
                inSeason: inSeason.length,
                evaluated: patterns?.length ?? 0,
                log: log.slice(0, 30),
              } as any,
            },
          ],
          { onConflict: "clave" },
        );

        return Response.json({
          ok: true,
          mes,
          quarter,
          evaluated: patterns?.length ?? 0,
          promoted: promoted.length,
          hibernated: hibernated.length,
          awoken: awoken.length,
          expired: expired.length,
          revived: revived.length,
          offSeason: offSeason.length,
          inSeason: inSeason.length,
          log,
        });
      },
    },
  },
});