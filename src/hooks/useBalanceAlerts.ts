import { useMemo } from "react";
import { useBalance, type HourPoint } from "@/hooks/useBalance";
import {
  useBalanceAlertsConfig,
  type BalanceAlertsConfig,
} from "@/hooks/useSettings";

export type BalanceAlertCategory = "ALTO/BAJO" | "PAR/IMPAR";

export interface BalanceAlert {
  /** Clave única estable: hora + categoría + lado dominante */
  id: string;
  hora: string;
  category: BalanceAlertCategory;
  dominantSide: "ALTO" | "BAJO" | "PAR" | "IMPAR";
  /** % del lado dominante (siempre ≥ 50) */
  pct: number;
  /** Δ respecto al 50% (siempre ≥ 0) */
  delta: number;
  total: number;
  severity: "warning" | "critical";
}

const CRITICAL_MULT = 1.5;

/**
 * Detecta horas que cruzan el umbral configurable de desbalance.
 * Acepta override por sesión (UI) que tiene prioridad sobre el global.
 */
export function useBalanceAlerts(
  windowDays: 7 | 30 | 90 = 30,
  override?: Partial<BalanceAlertsConfig>,
) {
  const { series, isLoading: isBalanceLoading } = useBalance(windowDays);
  const { data: globalCfg, isLoading: isCfgLoading } = useBalanceAlertsConfig();

  const cfg: BalanceAlertsConfig = useMemo(
    () => ({
      threshold: override?.threshold ?? globalCfg?.threshold ?? 15,
      minSamples: override?.minSamples ?? globalCfg?.minSamples ?? 5,
      enabled: override?.enabled ?? globalCfg?.enabled ?? true,
      watchAB: override?.watchAB ?? globalCfg?.watchAB ?? true,
      watchPI: override?.watchPI ?? globalCfg?.watchPI ?? true,
    }),
    [globalCfg, override],
  );

  const alerts = useMemo<BalanceAlert[]>(() => {
    if (!cfg.enabled) return [];
    const out: BalanceAlert[] = [];
    for (const s of series) {
      if (s.total < cfg.minSamples) continue;
      if (cfg.watchAB && s.abDeviation >= cfg.threshold) {
        out.push(buildAlert(s, "ALTO/BAJO", cfg.threshold));
      }
      if (cfg.watchPI && s.piDeviation >= cfg.threshold) {
        out.push(buildAlert(s, "PAR/IMPAR", cfg.threshold));
      }
    }
    // Ordenar por delta descendente
    return out.sort((a, b) => b.delta - a.delta);
  }, [series, cfg]);

  return {
    alerts,
    config: cfg,
    isLoading: isBalanceLoading || isCfgLoading,
  };
}

function buildAlert(
  s: HourPoint,
  category: BalanceAlertCategory,
  threshold: number,
): BalanceAlert {
  if (category === "ALTO/BAJO") {
    const dominantSide = s.altoPct >= 50 ? "ALTO" : "BAJO";
    const pct = Math.max(s.altoPct, 100 - s.altoPct);
    const delta = s.abDeviation;
    return {
      id: `${s.hora}-AB-${dominantSide}`,
      hora: s.hora,
      category,
      dominantSide,
      pct,
      delta,
      total: s.total,
      severity: delta >= threshold * CRITICAL_MULT ? "critical" : "warning",
    };
  }
  const dominantSide = s.parPct >= 50 ? "PAR" : "IMPAR";
  const pct = Math.max(s.parPct, 100 - s.parPct);
  const delta = s.piDeviation;
  return {
    id: `${s.hora}-PI-${dominantSide}`,
    hora: s.hora,
    category,
    dominantSide,
    pct,
    delta,
    total: s.total,
    severity: delta >= threshold * CRITICAL_MULT ? "critical" : "warning",
  };
}
