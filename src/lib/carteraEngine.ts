/**
 * carteraEngine.ts — MVP Fase 1
 *
 * Genera una cartera de 25 números (de 0 a 99) para una hora objetivo
 * combinando 4 señales:
 *   1. Frecuencia ajustada por hora (números más recurrentes en esa franja)
 *   2. Equilibrio (compensación pendiente: ALTO vs BAJO, PAR vs IMPAR)
 *   3. Reglas activas (rules.activo=true cuyo resultado_esperado matchea)
 *   4. Patrones activos (patterns.activa=true para esa hora)
 *
 * Determinista: misma input → misma output.
 */

import type { Draw } from "@/hooks/useDraws";

export interface CarteraRule {
  id: string;
  nombre: string;
  resultado_esperado: string | null;
  efectividad: number | string | null;
  activo: boolean;
}

export interface CarteraPattern {
  id: string;
  nombre: string;
  resultado_esperado: string | null;
  efectividad: number | string | null;
  hora: string | null;
  activa: boolean;
  estado: string;
}

/** Stats agregadas scrapeadas (lottery_stats) para una hora dada. */
export interface CarteraHistoricalStats {
  /** numero (0-99) -> frecuencia histórica en esa hora */
  frecuencias: Record<number, number>;
  /** numero -> días sin salir */
  vencidos: Record<number, number>;
  totalSorteos: number;
}

export interface CarteraResult {
  numeros: number[];                    // 25 elegidos
  scores: Record<string, number>;       // "23" -> 87
  reasons: Record<string, string[]>;    // "23" -> ["+freq hora","+balance BAJO"]
  contexto: {
    hora: string;
    totalDrawsHora: number;
    pctAltos: number;
    pctBajos: number;
    pctPares: number;
    pctImpares: number;
    reglasActivas: number;
    patronesHora: number;
    estrategia: string;
    historicalSorteos?: number;
    confidence: {
      topMean: number;       // promedio de score del top 25
      nextMean: number;      // promedio de score de los siguientes 25 (26-50)
      gap: number;           // topMean - nextMean → cuán "destacados" son los elegidos
      stdevTop: number;      // dispersión interna del top 25
      spread: number;        // max - min del top 25
      internalScore: number; // 0-100, combinación heurística (provisorio para Fase 2)
    };
  };
}

const RANGE_MIN = 0;
const RANGE_MAX = 99;
const ALTO_THRESHOLD = 50;
const SIZE = 25;

function isAlto(n: number) { return n >= ALTO_THRESHOLD; }
function isPar(n: number) { return n % 2 === 0; }

function num(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Construye la cartera. `draws` debe estar pre-filtrado por lotería si aplica.
 */
export function buildCartera(
  draws: Draw[],
  rules: CarteraRule[],
  patterns: CarteraPattern[],
  hora: string,
  historicalStats?: CarteraHistoricalStats,
): CarteraResult {
  // Pool de números 0-99
  const scores = new Map<number, number>();
  const reasons = new Map<number, string[]>();
  for (let n = RANGE_MIN; n <= RANGE_MAX; n++) {
    scores.set(n, 0);
    reasons.set(n, []);
  }

  const addScore = (n: number, delta: number, reason: string) => {
    if (n < RANGE_MIN || n > RANGE_MAX) return;
    scores.set(n, (scores.get(n) ?? 0) + delta);
    if (delta !== 0) reasons.get(n)!.push(reason);
  };

  // ─── 1. Frecuencia por hora ─────────────────────────────────
  const drawsHora = draws.filter((d) => d.hora === hora);
  const totalHora = drawsHora.length;
  const freqHora = new Map<number, number>();
  for (const d of drawsHora) {
    freqHora.set(d.numero, (freqHora.get(d.numero) ?? 0) + 1);
  }
  // Score base por frecuencia: normalizado 0-40
  const maxFreq = Math.max(1, ...Array.from(freqHora.values()));
  for (const [n, f] of freqHora.entries()) {
    const delta = Math.round((f / maxFreq) * 40);
    addScore(n, delta, `+freq hora ×${f}`);
  }

  // ─── 2. Equilibrio / compensación pendiente ─────────────────
  let altos = 0, bajos = 0, pares = 0, impares = 0;
  for (const d of drawsHora) {
    if (isAlto(d.numero)) altos++; else bajos++;
    if (isPar(d.numero)) pares++; else impares++;
  }
  const tot = Math.max(1, totalHora);
  const pctAltos = (altos / tot) * 100;
  const pctBajos = (bajos / tot) * 100;
  const pctPares = (pares / tot) * 100;
  const pctImpares = (impares / tot) * 100;

  // Δ desde 50% indica compensación pendiente. Boost lado sub-representado.
  const deltaAB = pctAltos - pctBajos; // >0 = altos sobre-representados → boost BAJO
  const deltaPI = pctPares - pctImpares;
  const boostAB = Math.min(20, Math.abs(deltaAB) * 0.6);
  const boostPI = Math.min(20, Math.abs(deltaPI) * 0.6);
  const sideAB = deltaAB > 0 ? "BAJO" : "ALTO";
  const sidePI = deltaPI > 0 ? "IMPAR" : "PAR";

  for (let n = RANGE_MIN; n <= RANGE_MAX; n++) {
    const ab = isAlto(n) ? "ALTO" : "BAJO";
    const pi = isPar(n) ? "PAR" : "IMPAR";
    if (ab === sideAB && boostAB > 0) addScore(n, Math.round(boostAB), `+balance ${sideAB}`);
    if (pi === sidePI && boostPI > 0) addScore(n, Math.round(boostPI), `+balance ${sidePI}`);
  }

  // ─── 3. Reglas activas ──────────────────────────────────────
  const reglasAct = rules.filter((r) => r.activo && r.resultado_esperado);
  for (const r of reglasAct) {
    const target = (r.resultado_esperado ?? "").toUpperCase();
    const eff = num(r.efectividad, 50) / 100;
    const boost = Math.round(15 * Math.max(0.3, eff));
    for (let n = RANGE_MIN; n <= RANGE_MAX; n++) {
      if (matchesTarget(n, target)) addScore(n, boost, `+regla ${r.nombre}`);
    }
  }

  // ─── 4. Patrones activos para la hora ───────────────────────
  const patronesHora = patterns.filter(
    (p) => p.activa && p.estado === "activo" && (!p.hora || p.hora === hora),
  );
  for (const p of patronesHora) {
    const target = (p.resultado_esperado ?? "").toUpperCase();
    if (!target) continue;
    const eff = num(p.efectividad, 50) / 100;
    const boost = Math.round(10 * Math.max(0.3, eff));
    for (let n = RANGE_MIN; n <= RANGE_MAX; n++) {
      if (matchesTarget(n, target)) addScore(n, boost, `+patrón ${p.nombre}`);
    }
  }

  // ─── 5. Histórico agregado (lottery_stats) ────────────────────
  // Aporta señal robusta basada en cientos de sorteos previos:
  //   • Boost por frecuencia histórica normalizada (0-30)
  //   • Boost por número "vencido" (regresión a la media): si lleva muchos
  //     días sin salir relativo al promedio, sube su score (0-15).
  if (historicalStats && historicalStats.totalSorteos > 0) {
    const freqValues = Object.values(historicalStats.frecuencias);
    const maxHistFreq = Math.max(1, ...freqValues);
    for (const [nStr, f] of Object.entries(historicalStats.frecuencias)) {
      const n = parseInt(nStr, 10);
      const delta = Math.round((f / maxHistFreq) * 30);
      if (delta > 0) addScore(n, delta, `+hist ×${f}`);
    }
    const vencValues = Object.values(historicalStats.vencidos);
    if (vencValues.length > 0) {
      const maxVenc = Math.max(1, ...vencValues);
      for (const [nStr, d] of Object.entries(historicalStats.vencidos)) {
        const n = parseInt(nStr, 10);
        const delta = Math.round((d / maxVenc) * 15);
        if (delta > 0) addScore(n, delta, `+vencido ${d}d`);
      }
    }
  }

  // ─── Selección Top 25 ───────────────────────────────────────
  const all = Array.from(scores.entries())
    .map(([n, s]) => ({ n, s: Math.max(0, Math.min(100, s)) }))
    .sort((a, b) => (b.s - a.s) || (a.n - b.n)); // tiebreaker estable

  const top = all.slice(0, SIZE);
  const numeros = top.map((x) => x.n).sort((a, b) => a - b);
  const scoresOut: Record<string, number> = {};
  const reasonsOut: Record<string, string[]> = {};
  for (const { n, s } of top) {
    scoresOut[String(n)] = s;
    reasonsOut[String(n)] = reasons.get(n) ?? [];
  }

  // ─── Confianza interna (datos crudos para calibrar Fase 2) ──
  const topScores = top.map((x) => x.s);
  const nextSlice = all.slice(SIZE, SIZE * 2).map((x) => x.s);
  const mean = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
  const topMean = mean(topScores);
  const nextMean = mean(nextSlice);
  const gap = topMean - nextMean;
  const variance = topScores.length
    ? topScores.reduce((s, v) => s + (v - topMean) ** 2, 0) / topScores.length
    : 0;
  const stdevTop = Math.sqrt(variance);
  const spread = topScores.length ? Math.max(...topScores) - Math.min(...topScores) : 0;
  // Heurística provisoria: gap fuerte + topMean alto + sample suficiente.
  const sampleFactor = Math.min(1, totalHora / 50);
  const internalScore = Math.round(
    Math.max(0, Math.min(100, topMean * 0.5 + gap * 1.5 + sampleFactor * 20)),
  );

  return {
    numeros,
    scores: scoresOut,
    reasons: reasonsOut,
    contexto: {
      hora,
      totalDrawsHora: totalHora,
      pctAltos: Math.round(pctAltos * 10) / 10,
      pctBajos: Math.round(pctBajos * 10) / 10,
      pctPares: Math.round(pctPares * 10) / 10,
      pctImpares: Math.round(pctImpares * 10) / 10,
      reglasActivas: reglasAct.length,
      patronesHora: patronesHora.length,
      estrategia: "composite_v1",
      historicalSorteos: historicalStats?.totalSorteos,
      confidence: {
        topMean: Math.round(topMean * 10) / 10,
        nextMean: Math.round(nextMean * 10) / 10,
        gap: Math.round(gap * 10) / 10,
        stdevTop: Math.round(stdevTop * 10) / 10,
        spread,
        internalScore,
      },
    },
  };
}

/** Evalúa si un número matchea un target tipo "ALTO"|"BAJO"|"PAR"|"IMPAR"|"ALTO_PAR"|... */
function matchesTarget(n: number, target: string): boolean {
  if (!target) return false;
  const ab = isAlto(n) ? "ALTO" : "BAJO";
  const pi = isPar(n) ? "PAR" : "IMPAR";
  const cuad = `${ab}_${pi}`;
  if (target === ab || target === pi || target === cuad) return true;
  // soportar combos sueltos tipo "ALTO PAR"
  if (target.includes(ab) && target.includes(pi)) return true;
  return false;
}

// ─── Stats helpers ──────────────────────────────────────────────

export interface CarteraStatRow {
  cartera_id: string;
  fecha: string;
  hora: string;
  acierto: boolean;
  numero_ganador: number;
}

export interface RollingStats {
  total: number;
  hits: number;
  hitRate: number;     // 0-1
  baseline: number;    // 0.25
  lift: number;        // hitRate - baseline
  wilsonLow: number;   // 95% LB
  wilsonHigh: number;  // 95% UB
  porDia: Array<{ fecha: string; total: number; hits: number; hitRate: number }>;
  porHora: Array<{ hora: string; total: number; hits: number; hitRate: number }>;
}

export const BASELINE = SIZE / (RANGE_MAX - RANGE_MIN + 1); // 0.25

/** Wilson score interval 95% */
export function wilson(hits: number, total: number, z = 1.96): [number, number] {
  if (total === 0) return [0, 0];
  const p = hits / total;
  const denom = 1 + (z * z) / total;
  const center = p + (z * z) / (2 * total);
  const margin = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * total)) / total);
  return [
    Math.max(0, (center - margin) / denom),
    Math.min(1, (center + margin) / denom),
  ];
}

export function computeRollingStats(rows: CarteraStatRow[]): RollingStats {
  const total = rows.length;
  const hits = rows.filter((r) => r.acierto).length;
  const hitRate = total > 0 ? hits / total : 0;
  const [wL, wH] = wilson(hits, total);

  const byDay = new Map<string, { total: number; hits: number }>();
  const byHora = new Map<string, { total: number; hits: number }>();
  for (const r of rows) {
    const d = byDay.get(r.fecha) ?? { total: 0, hits: 0 };
    d.total++; if (r.acierto) d.hits++;
    byDay.set(r.fecha, d);
    const h = byHora.get(r.hora) ?? { total: 0, hits: 0 };
    h.total++; if (r.acierto) h.hits++;
    byHora.set(r.hora, h);
  }

  return {
    total,
    hits,
    hitRate,
    baseline: BASELINE,
    lift: hitRate - BASELINE,
    wilsonLow: wL,
    wilsonHigh: wH,
    porDia: Array.from(byDay.entries())
      .map(([fecha, v]) => ({ fecha, total: v.total, hits: v.hits, hitRate: v.hits / v.total }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha)),
    porHora: Array.from(byHora.entries())
      .map(([hora, v]) => ({ hora, total: v.total, hits: v.hits, hitRate: v.hits / v.total }))
      .sort((a, b) => a.hora.localeCompare(b.hora)),
  };
}