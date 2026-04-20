/**
 * opportunityEngine.ts — Nivel 5: Ranking Inteligente de Oportunidades por Hora
 *
 * Evalúa cada slot horario usando la inteligencia ya construida (Niveles 2-4C)
 * y produce un ranking ejecutivo ordenado por score compuesto.
 *
 * ═══════════════════════════════════════════════════════════════════
 * PESOS DEL ALGORITMO (ajustables)
 * ═══════════════════════════════════════════════════════════════════
 *
 *  Componente                 │ Peso
 *  ──────────────────────────-┼──────
 *  Confianza base (0-92)      │ ×1.0  (normalizada)
 *  Regla activa               │ +10 c/u
 *  Patrón activo              │ +8  c/u
 *  Nivel ALTO                 │ +12
 *  Nivel MODERADO             │ +5
 *  Desequilibrio rango >60%   │ +6
 *  Desequilibrio paridad >60% │ +4
 *  Racha ≥3 (reversión)       │ +7
 *  Sin datos suficientes      │ −20
 *
 * Score final: min(100, max(0, sum))
 */

import {
  computeBalance,
  computeRachas,
  computeEscenarioProbablePorHora,
  subcuadranteLabel,
  type Sorteo,
  type Subcuadrante,
  type AltoBajo,
  type ParImpar,
  type BalanceStats,
  type Racha,
} from "./lottery";
import { getActiveRulesForSubset, type ActiveRuleDetection, type Rule } from "./rulesEngine";
import { getActivePatterns } from "./patternsEngine";
import type { Database } from "@/integrations/supabase/types";

type PatternRow = Database["public"]["Tables"]["patterns"]["Row"];

// ─── Tipos públicos ──────────────────────────────────────────────────────────

export type OpportunityLevel = "ALTO" | "MODERADO" | "ESTABLE";

export interface HourOpportunity {
  hora: string;
  escenario: string;
  confianza: number;
  nivel: OpportunityLevel;
  reglasActivas: number;
  patronesActivos: number;
  score: number;
  totalDraws: number;
  resumen: string[];
  /** Datos detallados para expansión futura */
  _meta: {
    balance: BalanceStats;
    rachas: Racha[];
    activeRules: ActiveRuleDetection[];
    activePatterns: Array<{ pattern: PatternRow; mensaje: string }>;
  };
}

export interface OpportunityRanking {
  ranking: HourOpportunity[];
  top3: HourOpportunity[];
  horaFavorita: HourOpportunity | null;
  totalHoras: number;
  promedioScore: number;
  timestamp: string;
}

// ─── Configuración de pesos ──────────────────────────────────────────────────

export interface ScoringWeights {
  confianzaMultiplier: number;
  reglaPeso: number;
  patronPeso: number;
  nivelAltoBonus: number;
  nivelModeradoBonus: number;
  desequilibrioRangoBonus: number;
  desequilibrioParidadBonus: number;
  rachaReversionBonus: number;
  sinDatosPenalty: number;
  minDrawsParaAnalisis: number;
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  confianzaMultiplier: 1.0,
  reglaPeso: 10,
  patronPeso: 8,
  nivelAltoBonus: 12,
  nivelModeradoBonus: 5,
  desequilibrioRangoBonus: 6,
  desequilibrioParidadBonus: 4,
  rachaReversionBonus: 7,
  sinDatosPenalty: -20,
  minDrawsParaAnalisis: 5,
};

// ─── Score por hora ──────────────────────────────────────────────────────────

export function scoreHourOpportunity(
  hora: string,
  allDraws: Sorteo[],
  rules: Rule[],
  patterns: PatternRow[],
  weights: ScoringWeights = DEFAULT_WEIGHTS,
): HourOpportunity {
  const subset = allDraws.filter((s) => s.hora === hora);
  const resumen: string[] = [];

  // Sin datos suficientes
  if (subset.length < weights.minDrawsParaAnalisis) {
    return {
      hora,
      escenario: "—",
      confianza: 0,
      nivel: "ESTABLE",
      reglasActivas: 0,
      patronesActivos: 0,
      score: 0,
      totalDraws: subset.length,
      resumen: [`Solo ${subset.length} registros — insuficiente para análisis`],
      _meta: {
        balance: { altos: 0, bajos: 0, pares: 0, impares: 0, total: 0, pctAltos: 0, pctBajos: 0, pctPares: 0, pctImpares: 0 },
        rachas: [],
        activeRules: [],
        activePatterns: [],
      },
    };
  }

  // ─── Nivel 2: Balance y Rachas ─────────────────────────────────────────
  const balance = computeBalance(subset);
  const rachas = computeRachas(subset);

  // ─── Nivel 2: Distribución de cuadrantes ───────────────────────────────
  const distribucion: Record<Subcuadrante, number> = {
    ALTO_PAR: 0,
    ALTO_IMPAR: 0,
    BAJO_PAR: 0,
    BAJO_IMPAR: 0,
  };
  for (const s of subset) distribucion[s.subcuadrante]++;

  // ─── Nivel 2: Tendencia dominante ──────────────────────────────────────
  const rangoDom: AltoBajo = balance.pctAltos >= balance.pctBajos ? "ALTO" : "BAJO";
  const paridadDom: ParImpar = balance.pctPares >= balance.pctImpares ? "PAR" : "IMPAR";
  const cuadEntries = Object.entries(distribucion) as [Subcuadrante, number][];
  const cuadDom = cuadEntries.reduce((a, b) => (b[1] > a[1] ? b : a), cuadEntries[0]);
  const tendencia = { rango: rangoDom, paridad: paridadDom, cuadrante: cuadDom[0] };

  // ─── Nivel 3: Escenario Probable ───────────────────────────────────────
  const escenario = computeEscenarioProbablePorHora(
    subset,
    balance,
    rachas,
    distribucion,
    tendencia,
  );

  // ─── Nivel 4A: Reglas activas ──────────────────────────────────────────
  const activeRules = getActiveRulesForSubset(rules, subset);

  // ─── Nivel 4B: Patrones activos ────────────────────────────────────────
  const relevantPatterns = patterns.filter((p) => !p.hora || p.hora === hora);
  const activePatterns = getActivePatterns(relevantPatterns, subset);

  // ─── Nivel 4C: Señal Compuesta → Nivel de oportunidad ─────────────────
  const totalTriggers = activeRules.length + activePatterns.length;
  let nivel: OpportunityLevel = "ESTABLE";
  if (totalTriggers > 0) {
    nivel = "ALTO";
  } else if (escenario.confianza > 65) {
    nivel = "MODERADO";
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CÁLCULO DEL SCORE COMPUESTO
  // ═══════════════════════════════════════════════════════════════════════

  let score = 0;

  // 1. Base: confianza del escenario (0-92 → normalizado a 0-92)
  score += escenario.confianza * weights.confianzaMultiplier;

  // 2. Reglas activas
  if (activeRules.length > 0) {
    score += activeRules.length * weights.reglaPeso;
    resumen.push(`${activeRules.length} regla${activeRules.length > 1 ? "s" : ""} activa${activeRules.length > 1 ? "s" : ""}`);
  }

  // 3. Patrones activos
  if (activePatterns.length > 0) {
    score += activePatterns.length * weights.patronPeso;
    resumen.push(`${activePatterns.length} patrón${activePatterns.length > 1 ? "es" : ""} fuerte${activePatterns.length > 1 ? "s" : ""}`);
  }

  // 4. Bonus por nivel de oportunidad
  if (nivel === "ALTO") {
    score += weights.nivelAltoBonus;
  } else if (nivel === "MODERADO") {
    score += weights.nivelModeradoBonus;
  }

  // 5. Desequilibrio rango (señal de compensación inminente)
  if (Math.max(balance.pctAltos, balance.pctBajos) > 60) {
    score += weights.desequilibrioRangoBonus;
    resumen.push(`Desequilibrio de rango (${Math.max(balance.pctAltos, balance.pctBajos).toFixed(0)}%)`);
  }

  // 6. Desequilibrio paridad
  if (Math.max(balance.pctPares, balance.pctImpares) > 60) {
    score += weights.desequilibrioParidadBonus;
    resumen.push(`Desequilibrio de paridad (${Math.max(balance.pctPares, balance.pctImpares).toFixed(0)}%)`);
  }

  // 7. Racha ≥3 (probabilidad de reversión)
  const rachaFuerte = rachas.find((r) => r.longitud >= 3);
  if (rachaFuerte) {
    score += weights.rachaReversionBonus;
    resumen.push(`Racha ${rachaFuerte.longitud}x ${rachaFuerte.valor} — reversión probable`);
  }

  // 8. Penalización si muy pocos datos
  if (subset.length < 10) {
    score += weights.sinDatosPenalty;
    resumen.push("Poca profundidad histórica");
  }

  // Agregar cuadrante dominante al resumen
  resumen.push(`Cuadrante dominante: ${subcuadranteLabel[tendencia.cuadrante]}`);

  // Clamp score
  score = Math.min(100, Math.max(0, Math.round(score)));

  return {
    hora,
    escenario: escenario.escenario,
    confianza: escenario.confianza,
    nivel,
    reglasActivas: activeRules.length,
    patronesActivos: activePatterns.length,
    score,
    totalDraws: subset.length,
    resumen,
    _meta: {
      balance,
      rachas,
      activeRules,
      activePatterns,
    },
  };
}

// ─── Ranking completo ────────────────────────────────────────────────────────

export function sortHoursByOpportunity(list: HourOpportunity[]): HourOpportunity[] {
  return [...list].sort((a, b) => b.score - a.score);
}

export function buildOpportunityRanking(
  allDraws: Sorteo[],
  rules: Rule[],
  patterns: PatternRow[],
  weights: ScoringWeights = DEFAULT_WEIGHTS,
): OpportunityRanking {
  // Descubrir todas las horas presentes en los datos
  const horasSet = new Set(allDraws.map((s) => s.hora));
  const horas = Array.from(horasSet).sort();

  // Evaluar cada hora
  const opportunities = horas.map((hora) =>
    scoreHourOpportunity(hora, allDraws, rules, patterns, weights),
  );

  // Ordenar por score descendente
  const ranking = sortHoursByOpportunity(opportunities);

  const top3 = ranking.slice(0, 3);
  const horaFavorita = ranking[0] ?? null;
  const totalScores = ranking.reduce((sum, h) => sum + h.score, 0);
  const promedioScore = ranking.length > 0 ? Math.round(totalScores / ranking.length) : 0;

  return {
    ranking,
    top3,
    horaFavorita,
    totalHoras: horas.length,
    promedioScore,
    timestamp: new Date().toISOString(),
  };
}
