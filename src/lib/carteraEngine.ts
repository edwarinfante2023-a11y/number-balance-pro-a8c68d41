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
  /** rules.tipo del enum rule_tipo: 'racha' | 'compensacion' | 'patron' | 'bloqueo' | 'otro' */
  tipo?: string | null;
}

export interface CarteraPattern {
  id: string;
  nombre: string;
  resultado_esperado: string | null;
  efectividad: number | string | null;
  hora: string | null;
  activa: boolean;
  estado: string;
  tipo?: string | null;
}

/** Stats agregadas scrapeadas (lottery_stats) para una hora dada. */
export interface CarteraHistoricalStats {
  /** numero (0-99) -> frecuencia histórica en esa hora */
  frecuencias: Record<number, number>;
  /** numero -> días sin salir */
  vencidos: Record<number, number>;
  totalSorteos: number;
}

export type CarteraMode = "standard_25" | "compact_15";
export const ADAPTIVE_STRATEGY = "adaptive_v2";

export interface CarteraBuildOptions {
  allowCompact?: boolean;
  strategy?: typeof ADAPTIVE_STRATEGY;
}

export interface CarteraRankedNumber {
  numero: number;
  score: number;
  rank: number;
  selected: boolean;
  reasons: string[];
}

export interface CarteraResult {
  numeros: number[];                    // 25 elegidos, o 15 si hay alta confianza
  scores: Record<string, number>;       // "23" -> 87
  reasons: Record<string, string[]>;    // "23" -> ["+freq hora","+balance BAJO"]
  contexto: {
    hora: string;
    mode: CarteraMode;
    selectedSize: number;
    baselineHitRate: number;
    totalDrawsHora: number;
    pctAltos: number;
    pctBajos: number;
    pctPares: number;
    pctImpares: number;
    reglasActivas: number;
    patronesHora: number;
    estrategia: string;
    historicalSorteos?: number;
    ranking: CarteraRankedNumber[];
    compactDecision: {
      eligible: boolean;
      reasons: string[];
      top15Mean: number;
      next15Mean: number;
      gap15: number;
      sampleBase: number;
    };
    roiModel: {
      numerosJugados: number;
      baselineHitRate: number;
      costIndex: number;
      efficiencyIndex: number;
    };
    momentum?: {
      rango: "ALTO" | "BAJO" | null;
      paridad: "PAR" | "IMPAR" | null;
      fuerzaRango: number;       // 0-1
      fuerzaParidad: number;     // 0-1
      ventana: number;           // sorteos efectivamente usados
    };
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
  options: CarteraBuildOptions = {},
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

  // ─── 2. Momentum (sigue la racha actual, no la compensa) ────
  // El cliente pidió: si el sorteo viene corriendo BAJO_IMPAR, la cartera
  // debe seguir pesando BAJO_IMPAR mientras esa racha se mantenga.
  const VENTANA = 5;
  const ordered = [...drawsHora].sort((a, b) =>
    `${b.fecha} ${b.hora}`.localeCompare(`${a.fecha} ${a.hora}`),
  );
  const ventana = ordered.slice(0, VENTANA);
  const ventanaN = ventana.length;
  let mAlto = 0, mPar = 0;
  for (const d of ventana) {
    if (isAlto(d.numero)) mAlto++;
    if (isPar(d.numero)) mPar++;
  }
  const mBajo = ventanaN - mAlto;
  const mImpar = ventanaN - mPar;

  // Lado dominante de la racha (null si empate)
  const rangoDom: "ALTO" | "BAJO" | null =
    mAlto > mBajo ? "ALTO" : mBajo > mAlto ? "BAJO" : null;
  const paridadDom: "PAR" | "IMPAR" | null =
    mPar > mImpar ? "PAR" : mImpar > mPar ? "IMPAR" : null;

  // Fuerza 0-1: qué tan marcada viene la racha (3/5 = 0.6, 5/5 = 1.0)
  const fuerzaRango = ventanaN > 0 ? Math.max(mAlto, mBajo) / ventanaN : 0;
  const fuerzaParidad = ventanaN > 0 ? Math.max(mPar, mImpar) / ventanaN : 0;

  const boostMomAB = rangoDom ? Math.round(20 * fuerzaRango) : 0;
  const boostMomPI = paridadDom ? Math.round(20 * fuerzaParidad) : 0;

  for (let n = RANGE_MIN; n <= RANGE_MAX; n++) {
    const ab = isAlto(n) ? "ALTO" : "BAJO";
    const pi = isPar(n) ? "PAR" : "IMPAR";
    if (rangoDom && ab === rangoDom && boostMomAB > 0) {
      addScore(n, boostMomAB, `+momentum ${rangoDom} (${Math.max(mAlto, mBajo)}/${ventanaN})`);
    }
    if (paridadDom && pi === paridadDom && boostMomPI > 0) {
      addScore(n, boostMomPI, `+momentum ${paridadDom} (${Math.max(mPar, mImpar)}/${ventanaN})`);
    }
  }

  // ─── 3. Reglas activas ──────────────────────────────────────
  const reglasAct = rules.filter((r) => r.activo && r.resultado_esperado);
  for (const r of reglasAct) {
    const target = (r.resultado_esperado ?? "").toUpperCase();
    const eff = num(r.efectividad, 50) / 100;
    // Reglas de compensación pesan menos: el cliente prefiere seguir la racha,
    // no apostar al opuesto. Detectamos compensación por tipo o por target opuesto al momentum.
    const isCompensacionByTipo = (r.tipo ?? "").toLowerCase() === "compensacion";
    const isCompensacionByTarget =
      !!rangoDom && target.includes(rangoDom === "ALTO" ? "BAJO" : "ALTO");
    const baseBoost = isCompensacionByTipo || isCompensacionByTarget ? 7 : 15;
    const boost = Math.round(baseBoost * Math.max(0.3, eff));
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
    const isCompensacionByTipo = (p.tipo ?? "").toLowerCase() === "compensacion";
    const isCompensacionByTarget =
      !!rangoDom && target.includes(rangoDom === "ALTO" ? "BAJO" : "ALTO");
    const baseBoost = isCompensacionByTipo || isCompensacionByTarget ? 5 : 10;
    const boost = Math.round(baseBoost * Math.max(0.3, eff));
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

  const top15Scores = all.slice(0, 15).map((x) => x.s);
  const next15Scores = all.slice(15, 30).map((x) => x.s);
  const mean = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
  const top15Mean = mean(top15Scores);
  const next15Mean = mean(next15Scores);
  const gap15 = top15Mean - next15Mean;

  // ─── Confianza interna (datos crudos para calibrar Fase 2) ──
  const top25 = all.slice(0, SIZE);
  const topScores = top25.map((x) => x.s);
  const nextSlice = all.slice(SIZE, SIZE * 2).map((x) => x.s);
  const topMean = mean(topScores);
  const nextMean = mean(nextSlice);
  const gap = topMean - nextMean;
  const variance = topScores.length
    ? topScores.reduce((s, v) => s + (v - topMean) ** 2, 0) / topScores.length
    : 0;
  const stdevTop = Math.sqrt(variance);
  const spread = topScores.length ? Math.max(...topScores) - Math.min(...topScores) : 0;
  // Heurística provisoria: gap fuerte + topMean alto + sample suficiente.
  const sampleBase = Math.max(totalHora, historicalStats?.totalSorteos ?? 0);
  const sampleFactor = Math.min(1, totalHora / 50);
  const internalScore = Math.round(
    Math.max(0, Math.min(100, topMean * 0.5 + gap * 1.5 + sampleFactor * 20)),
  );

  const compactDecisionReasons: string[] = [];
  if (options.allowCompact === false) compactDecisionReasons.push("compact disabled");
  if (internalScore < 85) compactDecisionReasons.push("internalScore < 85");
  if (gap15 < 8) compactDecisionReasons.push("top15 gap < 8");
  if (top15Mean < 70) compactDecisionReasons.push("top15 mean < 70");
  if (sampleBase < 50) compactDecisionReasons.push("sample < 50");

  const compactEligible =
    options.allowCompact !== false &&
    internalScore >= 85 &&
    gap15 >= 8 &&
    top15Mean >= 70 &&
    sampleBase >= 50;
  if (compactEligible) compactDecisionReasons.push("high confidence compact portfolio");

  const selectedSize = compactEligible ? 15 : SIZE;
  const mode: CarteraMode = compactEligible ? "compact_15" : "standard_25";
  const top = all.slice(0, selectedSize);
  const numeros = top.map((x) => x.n).sort((a, b) => a - b);
  const scoresOut: Record<string, number> = {};
  const reasonsOut: Record<string, string[]> = {};
  for (const { n, s } of top) {
    scoresOut[String(n)] = s;
    reasonsOut[String(n)] = reasons.get(n) ?? [];
  }

  const selectedSet = new Set(top.map((x) => x.n));
  const ranking: CarteraRankedNumber[] = all.map((x, idx) => ({
    numero: x.n,
    score: x.s,
    rank: idx + 1,
    selected: selectedSet.has(x.n),
    reasons: reasons.get(x.n) ?? [],
  }));

  return {
    numeros,
    scores: scoresOut,
    reasons: reasonsOut,
    contexto: {
      hora,
      mode,
      selectedSize,
      baselineHitRate: selectedSize / (RANGE_MAX - RANGE_MIN + 1),
      totalDrawsHora: totalHora,
      pctAltos: Math.round(pctAltos * 10) / 10,
      pctBajos: Math.round(pctBajos * 10) / 10,
      pctPares: Math.round(pctPares * 10) / 10,
      pctImpares: Math.round(pctImpares * 10) / 10,
      reglasActivas: reglasAct.length,
      patronesHora: patronesHora.length,
      estrategia: options.strategy ?? ADAPTIVE_STRATEGY,
      historicalSorteos: historicalStats?.totalSorteos,
      ranking,
      compactDecision: {
        eligible: compactEligible,
        reasons: compactDecisionReasons,
        top15Mean: Math.round(top15Mean * 10) / 10,
        next15Mean: Math.round(next15Mean * 10) / 10,
        gap15: Math.round(gap15 * 10) / 10,
        sampleBase,
      },
      roiModel: {
        numerosJugados: selectedSize,
        baselineHitRate: selectedSize / (RANGE_MAX - RANGE_MIN + 1),
        costIndex: selectedSize / SIZE,
        efficiencyIndex: Math.round((internalScore / selectedSize) * 100) / 100,
      },
      momentum: {
        rango: rangoDom,
        paridad: paridadDom,
        fuerzaRango: Math.round(fuerzaRango * 100) / 100,
        fuerzaParidad: Math.round(fuerzaParidad * 100) / 100,
        ventana: ventanaN,
      },
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

export interface WinnerDiagnostic {
  numero: number;
  selected: boolean;
  rank: number | null;
  score: number;
  inTop15: boolean;
  inTop25: boolean;
  inTop35: boolean;
  inTop50: boolean;
  rango: "ALTO" | "BAJO";
  paridad: "PAR" | "IMPAR";
  missType: "hit" | "near_miss" | "deep_miss";
  reasons: string[];
}

export function diagnoseWinner(
  numero: number,
  cartera: { numeros?: number[] | null; scores?: Record<string, number> | null; contexto?: any },
): WinnerDiagnostic {
  const ranking = Array.isArray(cartera.contexto?.ranking)
    ? (cartera.contexto.ranking as CarteraRankedNumber[])
    : [];
  const found = ranking.find((r) => r.numero === numero);
  const selected = Array.isArray(cartera.numeros)
    ? cartera.numeros.includes(numero)
    : !!found?.selected;
  const rank = found?.rank ?? null;
  const score = found?.score ?? num(cartera.scores?.[String(numero)], 0);
  const missType =
    selected ? "hit" : rank !== null && rank <= 35 ? "near_miss" : "deep_miss";

  return {
    numero,
    selected,
    rank,
    score,
    inTop15: rank !== null && rank <= 15,
    inTop25: rank !== null && rank <= 25,
    inTop35: rank !== null && rank <= 35,
    inTop50: rank !== null && rank <= 50,
    rango: isAlto(numero) ? "ALTO" : "BAJO",
    paridad: isPar(numero) ? "PAR" : "IMPAR",
    missType,
    reasons: found?.reasons ?? [],
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
