/**
 * opportunityEngine.ts — Nivel 5: Ranking Inteligente de Oportunidades por Hora
 *
 * Evalúa cada slot horario usando la inteligencia ya construida (Niveles 2-4B)
 * y produce un ranking ejecutivo ordenado por score compuesto.
 *
 * ═══════════════════════════════════════════════════════════════════
 * NUEVOS PESOS DEL ALGORITMO (Ajustados anti-inflación)
 * ═══════════════════════════════════════════════════════════════════
 *
 *  Componente                 │ Peso
 *  ──────────────────────────-┼──────
 *  Confianza base             │ ×0.70 (es decir, máximo ~65 pts)
 *  Regla activa               │ +15 base * (efectividad / 100) c/u
 *  Patrón activo              │ +10 base * (efectividad / 100) c/u
 *  Sin datos suficientes      │ −20
 *
 * NOTA: Los desequilibrios de rango/paridad y rachas ya están 
 * matemáticamente embebidos en la 'Confianza base' de Nivel 3.
 *
 * Score final: min(100, max(0, sum))
 * Nivel final: Determinado puramente por el Score (>= 80 ALTO, >= 60 MODERADO)
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
  reglaBasePeso: number;
  patronBasePeso: number;
  sinDatosPenalty: number;
  minDrawsParaAnalisis: number;
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  confianzaMultiplier: 0.70,
  reglaBasePeso: 15,
  patronBasePeso: 10,
  sinDatosPenalty: -20,
  minDrawsParaAnalisis: 10,
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

  const distribucion: Record<Subcuadrante, number> = {
    ALTO_PAR: 0, ALTO_IMPAR: 0, BAJO_PAR: 0, BAJO_IMPAR: 0,
  };
  for (const s of subset) distribucion[s.subcuadrante]++;

  const rangoDom: AltoBajo = balance.pctAltos >= balance.pctBajos ? "ALTO" : "BAJO";
  const paridadDom: ParImpar = balance.pctPares >= balance.pctImpares ? "PAR" : "IMPAR";
  const cuadEntries = Object.entries(distribucion) as [Subcuadrante, number][];
  const cuadDom = cuadEntries.reduce((a, b) => (b[1] > a[1] ? b : a), cuadEntries[0]);
  const tendencia = { rango: rangoDom, paridad: paridadDom, cuadrante: cuadDom[0] };

  // ─── Nivel 3: Escenario Probable ───────────────────────────────────────
  const escenario = computeEscenarioProbablePorHora(
    subset, balance, rachas, distribucion, tendencia,
  );

  // ─── Nivel 4A & 4B: Reglas y Patrones ──────────────────────────────────
  const activeRules = getActiveRulesForSubset(rules, subset);
  const relevantPatterns = patterns.filter((p) => !p.hora || p.hora === hora);
  const activePatterns = getActivePatterns(relevantPatterns, subset);

  // ═══════════════════════════════════════════════════════════════════════
  // CÁLCULO DEL SCORE COMPUESTO (Libre de doble contabilidad)
  // ═══════════════════════════════════════════════════════════════════════

  let score = 0;

  // 1. Base ponderada (Desequilibrios y Rachas ya están factorizados aquí)
  score += escenario.confianza * weights.confianzaMultiplier;

  // 2. Reglas activas: Peso dinámico según su efectividad histórica
  if (activeRules.length > 0) {
    for (const ar of activeRules) {
      const effect = ar.rule.efectividad || 50; // default 50% si no hay stats
      const dynamicWeight = weights.reglaBasePeso * (effect / 100);
      score += dynamicWeight;
    }
    resumen.push(`${activeRules.length} alerta${activeRules.length > 1 ? "s" : ""} lógica${activeRules.length > 1 ? "s" : ""} activa${activeRules.length > 1 ? "s" : ""}`);
  }

  // 3. Patrones activos: Peso dinámico según su precisión minada
  if (activePatterns.length > 0) {
    for (const ap of activePatterns) {
      const effect = ap.pattern.efectividad || 50; // default 50%
      const dynamicWeight = weights.patronBasePeso * (effect / 100);
      score += dynamicWeight;
    }
    resumen.push(`${activePatterns.length} patrón${activePatterns.length > 1 ? "es" : ""} predictivo${activePatterns.length > 1 ? "s" : ""} detectado${activePatterns.length > 1 ? "s" : ""}`);
  }

  resumen.push(`Cuadrante dominante: ${subcuadranteLabel[tendencia.cuadrante]}`);

  // Clamp score
  score = Math.min(100, Math.max(0, Math.round(score)));

  // ─── Consecuencia: Calcular el Nivel a partir del Score final ──────────
  let nivel: OpportunityLevel = "ESTABLE";
  if (score >= 80) {
    nivel = "ALTO";
  } else if (score >= 60) {
    nivel = "MODERADO";
  }

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

export function sortHoursByOpportunity(list: HourOpportunity[]): HourOpportunity[] {
  return [...list].sort((a, b) => b.score - a.score);
}

export function buildOpportunityRanking(
  allDraws: Sorteo[],
  rules: Rule[],
  patterns: PatternRow[],
  weights: ScoringWeights = DEFAULT_WEIGHTS,
): OpportunityRanking {
  const horasSet = new Set(allDraws.map((s) => s.hora));
  const horas = Array.from(horasSet).sort();

  const opportunities = horas.map((hora) =>
    scoreHourOpportunity(hora, allDraws, rules, patterns, weights),
  );

  const ranking = sortHoursByOpportunity(opportunities);
  const top3 = ranking.slice(0, 3);
  const horaFavorita = ranking[0] ?? null;
  const totalScores = ranking.reduce((sum, h) => sum + h.score, 0);
  const promedioScore = ranking.length > 0 ? Math.round(totalScores / ranking.length) : 0;

  return { ranking, top3, horaFavorita, totalHoras: horas.length, promedioScore, timestamp: new Date().toISOString() };
}
