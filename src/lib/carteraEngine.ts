/**
 * carteraEngine.ts — Fase 3: Arquitectura de Cuadrantes
 *
 * Genera una cartera predictiva seleccionando el CUADRANTE con mayor
 * probabilidad de salir (25 números en bloque), eliminando el ruido de 
 * predecir números sueltos.
 *
 * Combina señales de:
 *   1. Frecuencia histórica por cuadrante.
 *   2. Bloqueos de Cadenas de Markov (ej: 4 Altos seguidos → Fuerza Bajo).
 *   3. Reglas y Patrones Humanos (vetados si son inefectivos).
 */

import type { Draw } from "@/hooks/useDraws";

export interface CarteraRule {
  id: string;
  nombre: string;
  resultado_esperado: string | null;
  efectividad: number | string | null;
  activo: boolean;
  tipo?: string | null;
  /** true si el Robot Jefe vetó esta regla por ser perdedora históricamente */
  vetada_por_robot?: boolean;
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
  frecuencias: Record<number, number>;
  vencidos: Record<number, number>;
  totalSorteos: number;
}

export type CarteraMode = "standard_25" | "compact_15" | "quadrant_25";
export const ADAPTIVE_STRATEGY = "quadrant_v3";

export interface CarteraBuildOptions {
  allowCompact?: boolean;
  strategy?: typeof ADAPTIVE_STRATEGY;
  momentumMode?: "follow" | "compensate";
  /** Cuadrante predicho por el Modo Dios (Fase 14). Si se provee, se aplica un boost masivo. */
  godModeQuadrant?: string | null;
  /** Clasificación de la semana actual */
  weekType?: WeekClassification;
}

export interface CarteraRankedNumber {
  numero: number;
  score: number;
  rank: number;
  selected: boolean;
  reasons: string[];
}

export interface CarteraResult {
  numeros: number[];                    // Bloque de 25 del cuadrante ganador
  scores: Record<string, number>;       // número -> score del cuadrante
  reasons: Record<string, string[]>;    // número -> razones del cuadrante
  contexto: {
    hora: string;
    mode: CarteraMode;
    selectedSize: number;
    winningQuadrant?: string;
    quadrantScores?: Array<{ q: string; s: number }>;
    baselineHitRate: number;
    totalDrawsHora: number;
    pctAltos: number;
    pctBajos: number;
    pctPares: number;
    pctImpares: number;
    reglasActivas: number;
    reglasVetadas: number;
    patronesHora: number;
    estrategia: string;
    historicalSorteos?: number;
    ranking: CarteraRankedNumber[];
    momentum?: {
      streakRango: number;
      streakParidad: number;
      currentRango: string | null;
      currentParidad: string | null;
      bloqueoAplicado: boolean;
    };
    dualSystem?: {
      applied: boolean;
      motor: "SNIPER" | "GOD_MODE" | "NONE";
      godModeQuadrant: string | null;
      weekType: WeekClassification | null;
    };
    confidence: {
      topMean: number;
      nextMean: number;
      gap: number;
      stdevTop: number;
      spread: number;
      internalScore: number;
    };
  };
}

const RANGE_MIN = 0;
const RANGE_MAX = 99;
const ALTO_THRESHOLD = 50;

export function isAlto(n: number) { return n >= ALTO_THRESHOLD; }
export function isPar(n: number) { return n % 2 === 0; }
export function getQuadrant(n: number) {
  const ab = isAlto(n) ? "ALTO" : "BAJO";
  const pi = isPar(n) ? "PAR" : "IMPAR";
  return `${ab}_${pi}`;
}

// ─── SISTEMA DUAL AI (Fase 14) ──────────────────────────────────────────

export type WeekClassification = "MATH" | "CHAOS";

export interface DualSystemState {
  weekType: WeekClassification;
  activeMotor: "SNIPER" | "GOD_MODE";
  godModePrediction: string | null;
  confidence: number;
  mathWinRate: number;
  sampleSize: number;
}

/**
 * RADAR: Clasifica la semana actual como Matemática o Caótica.
 * Usa los últimos 5 sorteos para evaluar si las reglas simples de repetición
 * están funcionando (>= 60% de Win Rate = Semana Matemática).
 */
export function classifyWeek(recentDraws: Array<{ numero: number }>): WeekClassification {
  if (recentDraws.length < 5) return "CHAOS";

  const last5 = recentDraws.slice(0, 5);
  let hits = 0;
  let evals = 0;

  for (let i = 2; i < last5.length; i++) {
    const h0 = last5[i - 1].numero;
    const h1 = last5[i - 2].numero;
    const target = last5[i].numero;

    // Evaluar si hay continuación de racha (misma propiedad Alto/Bajo o Par/Impar)
    const sameAlto = isAlto(h0) === isAlto(h1);
    const samePar = isPar(h0) === isPar(h1);

    if (sameAlto || samePar) {
      evals++;
      // Verificar si la repetición continuó
      if (sameAlto && isAlto(target) === isAlto(h0)) hits++;
      else if (samePar && isPar(target) === isPar(h0)) hits++;
    }
  }

  if (evals >= 2 && (hits / evals) * 100 >= 60) return "MATH";
  return "CHAOS";
}

/**
 * MOTOR 2 (MODO DIOS): Predicción de Fuerza Bruta Nivel 4.
 * Construye un Rulebook cruzando: Hora + Día de la Semana + Mes + 4 Cuadrantes Previos.
 * Solo retorna una predicción si encuentra una regla con 100% de Win Rate histórico
 * y al menos 2 apariciones (para evitar ruido de muestra única).
 */
export function godModePredict(
  allDraws: Array<{ numero: number; fecha: string; hora?: string }>,
  targetHora: string,
  targetFecha: string,
): { quadrant: string; confidence: number; ruleHits: number } | null {
  const DEPTH = 4;
  const CUADRANTES = ["ALTO_PAR", "ALTO_IMPAR", "BAJO_PAR", "BAJO_IMPAR"];

  // Filtrar sorteos de la misma hora para construir la cadena temporal
  const drawsForHora = allDraws
    .filter(d => (d.hora ?? "") === targetHora)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  if (drawsForHora.length < DEPTH + 2) return null;

  // Construir Rulebook (excluimos los últimos sorteos para no hacer trampa)
  const ruleBook = new Map<string, { total: number; hits: Record<string, number> }>();

  for (let i = DEPTH; i < drawsForHora.length; i++) {
    const current = drawsForHora[i];
    const d = new Date(current.fecha + "T12:00:00");
    if (isNaN(d.getTime())) continue;

    const keyObj: Record<string, unknown> = {
      hora: targetHora,
      day: d.getDay(),
      month: d.getMonth() + 1,
    };
    for (let j = 1; j <= DEPTH; j++) {
      keyObj[`p${j}`] = getQuadrant(drawsForHora[i - j].numero);
    }
    const key = JSON.stringify(keyObj);

    let entry = ruleBook.get(key);
    if (!entry) {
      entry = { total: 0, hits: { ALTO_PAR: 0, ALTO_IMPAR: 0, BAJO_PAR: 0, BAJO_IMPAR: 0 } };
      ruleBook.set(key, entry);
    }
    entry.total++;
    entry.hits[getQuadrant(current.numero)]++;
  }

  // Evaluar si la configuración ACTUAL coincide con una regla de 100%
  const targetDate = new Date(targetFecha + "T12:00:00");
  if (isNaN(targetDate.getTime())) return null;

  const lastN = drawsForHora.slice(-DEPTH);
  if (lastN.length < DEPTH) return null;

  const currentKeyObj: Record<string, unknown> = {
    hora: targetHora,
    day: targetDate.getDay(),
    month: targetDate.getMonth() + 1,
  };
  for (let j = 1; j <= DEPTH; j++) {
    currentKeyObj[`p${j}`] = getQuadrant(lastN[lastN.length - j].numero);
  }
  const currentKey = JSON.stringify(currentKeyObj);

  const matchedRule = ruleBook.get(currentKey);
  if (!matchedRule || matchedRule.total < 2) return null;

  // Buscar si algún cuadrante tiene 100% de aciertos
  for (const cuad of CUADRANTES) {
    const winRate = (matchedRule.hits[cuad] / matchedRule.total) * 100;
    if (winRate >= 100) {
      return {
        quadrant: cuad,
        confidence: winRate,
        ruleHits: matchedRule.total,
      };
    }
  }

  return null;
}

/**
 * Evalúa el estado completo del Sistema Dual para una hora y fecha dada.
 */
export function evaluateDualSystem(
  allDraws: Array<{ numero: number; fecha: string; hora?: string }>,
  targetHora: string,
  targetFecha: string,
): DualSystemState {
  // Filtrar los sorteos recientes de esta hora para el Radar
  const drawsForHora = allDraws
    .filter(d => (d.hora ?? "") === targetHora)
    .sort((a, b) => `${b.fecha}`.localeCompare(`${a.fecha}`));

  const recentForRadar = drawsForHora.slice(0, 5);
  const weekType = classifyWeek(recentForRadar);

  // Calcular Math Win Rate para el indicador visual
  let mathHits = 0;
  let mathEvals = 0;
  for (let i = 2; i < Math.min(recentForRadar.length, 5); i++) {
    const h0 = recentForRadar[i - 1].numero;
    const h1 = recentForRadar[i - 2].numero;
    if (isAlto(h0) === isAlto(h1) || isPar(h0) === isPar(h1)) {
      mathEvals++;
      if (isAlto(recentForRadar[i].numero) === isAlto(h0) || isPar(recentForRadar[i].numero) === isPar(h0)) {
        mathHits++;
      }
    }
  }
  const mathWinRate = mathEvals > 0 ? (mathHits / mathEvals) * 100 : 0;

  // Evaluar Modo Dios
  const godResult = godModePredict(allDraws, targetHora, targetFecha);

  return {
    weekType,
    activeMotor: weekType === "MATH" ? "SNIPER" : "GOD_MODE",
    godModePrediction: godResult?.quadrant ?? null,
    confidence: godResult?.confidence ?? mathWinRate,
    mathWinRate,
    sampleSize: drawsForHora.length,
  };
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : fallback;
}

/** Evalúa si un cuadrante matchea un target ("ALTO", "ALTO_PAR", etc) */
function matchesQuadrant(q: string, target: string): boolean {
  if (!target) return false;
  const [qRango, qParidad] = q.split("_");
  if (target === q) return true;
  if (target === qRango || target === qParidad) return true;
  if (target.includes(qRango) && target.includes(qParidad)) return true;
  return false;
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
  const CUADRANTES = ["ALTO_PAR", "ALTO_IMPAR", "BAJO_PAR", "BAJO_IMPAR"];
  const scores = new Map<string, number>();
  const reasons = new Map<string, string[]>();
  
  for (const q of CUADRANTES) {
    scores.set(q, 0);
    reasons.set(q, []);
  }

  const addScore = (q: string, delta: number, reason: string) => {
    if (!CUADRANTES.includes(q)) return;
    scores.set(q, (scores.get(q) ?? 0) + delta);
    if (delta !== 0) reasons.get(q)!.push(reason);
  };

  const drawsHora = draws.filter((d) => d.hora === hora);
  const totalHora = drawsHora.length;

  // ─── 1. Frecuencia por hora (por cuadrante) ──────────────────
  const freqHora = new Map<string, number>();
  for (const d of drawsHora) {
    const q = getQuadrant(d.numero);
    freqHora.set(q, (freqHora.get(q) ?? 0) + 1);
  }
  const maxFreq = Math.max(1, ...Array.from(freqHora.values()));
  for (const [q, f] of freqHora.entries()) {
    const delta = Math.round((f / maxFreq) * 20);
    addScore(q, delta, `+freq hora (${f} aciertos)`);
  }

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

  // ─── 2. Bloqueos y Momentum de Cadenas de Markov ────────────
  const ordered = [...drawsHora].sort((a, b) =>
    `${b.fecha} ${b.hora}`.localeCompare(`${a.fecha} ${a.hora}`)
  );

  let streakRango = 0;
  let currentRango: "ALTO" | "BAJO" | null = null;
  for (const d of ordered) {
    const r = isAlto(d.numero) ? "ALTO" : "BAJO";
    if (!currentRango) currentRango = r;
    if (r === currentRango) streakRango++;
    else break;
  }

  let streakParidad = 0;
  let currentParidad: "PAR" | "IMPAR" | null = null;
  for (const d of ordered) {
    const p = isPar(d.numero) ? "PAR" : "IMPAR";
    if (!currentParidad) currentParidad = p;
    if (p === currentParidad) streakParidad++;
    else break;
  }

  const lastDraw = ordered[0];
  const lastRango = lastDraw ? (isAlto(lastDraw.numero) ? "ALTO" : "BAJO") : null;
  const lastParidad = lastDraw ? (isPar(lastDraw.numero) ? "PAR" : "IMPAR") : null;

  // Lógica de Bloqueo: Si hay una racha de 3 o más en una dimensión,
  // el sistema asume que vendrá una corrección en esa dimensión, 
  // y por inercia invertirá la otra dimensión también.
  let bloqueoAplicado = false;
  if (streakRango >= 3 && lastRango && lastParidad) {
    const targetRango = lastRango === "ALTO" ? "BAJO" : "ALTO";
    const targetParidad = lastParidad === "PAR" ? "IMPAR" : "PAR";
    const targetCuadrante = `${targetRango}_${targetParidad}`;
    const boost = Math.min(40, streakRango * 10);
    addScore(targetCuadrante, boost, `+bloqueo rango (${streakRango}x ${lastRango} seguidos)`);
    bloqueoAplicado = true;
  }

  if (streakParidad >= 3 && lastRango && lastParidad) {
    const targetParidad = lastParidad === "PAR" ? "IMPAR" : "PAR";
    // Rebote validado científicamente: 5xPAR→IMPAR tiene ~77% de probabilidad.
    // Aplicamos boost a AMBOS cuadrantes que tengan la paridad opuesta.
    const reboteBoost = streakParidad >= 5
      ? Math.min(60, streakParidad * 12)  // Rebote fuerte (validado al 77%)
      : Math.min(40, streakParidad * 10); // Bloqueo normal
    const label = streakParidad >= 5
      ? `+🔄 Rebote ${streakParidad}x${lastParidad}→${targetParidad} (77%)`
      : `+bloqueo paridad (${streakParidad}x ${lastParidad} seguidos)`;
    for (const q of CUADRANTES) {
      if (q.includes(targetParidad)) {
        addScore(q, reboteBoost, label);
      }
    }
    bloqueoAplicado = true;
  }

  // ─── 3. Reglas activas (excluyendo vetadas) ──────────────────
  const reglasVetadas = rules.filter((r) => r.vetada_por_robot === true);
  const reglasAct = rules.filter((r) => r.activo && r.resultado_esperado && !r.vetada_por_robot);
  for (const r of reglasAct) {
    const target = (r.resultado_esperado ?? "").toUpperCase();
    const eff = num(r.efectividad, 50) / 100;
    const boost = Math.round(15 * Math.max(0.3, eff));
    for (const q of CUADRANTES) {
      if (matchesQuadrant(q, target)) addScore(q, boost, `+regla ${r.nombre}`);
    }
  }

  // ─── 4. Patrones activos para la hora ───────────────────────
  const patronesHora = patterns.filter((p) => p.activa && p.estado === "activo" && (!p.hora || p.hora === hora));
  
  for (const p of patronesHora) {
    const target = (p.resultado_esperado ?? "").toUpperCase();
    if (!target) continue;

    // Evaluador Multidimensional (Deep Miner)
    if (p.condiciones && (p.condiciones as any).algorithm === "deep_miner") {
      const c = p.condiciones as any;
      const d = new Date(ordered[0]?.fecha + "T12:00:00");
      if (!d || isNaN(d.getTime())) continue;

      if (c.dayOfWeek !== "ANY" && d.getDay() !== c.dayOfWeek) continue;
      if (c.month !== "ANY" && (d.getMonth() + 1) !== c.month) continue;
      if (c.lastCuadrante !== "ANY" && lastDraw && getQuadrant(lastDraw.numero) !== c.lastCuadrante) continue;
      
      // La racha de rango previa evalúa la racha HASTA el último sorteo
      if (c.prevRachaRango !== "ANY" && streakRango !== c.prevRachaRango) continue;
      
      // Si pasa todos los filtros, es un tiro de Francotirador (D-Miner)
      const ef = num(p.efectividad, 50) / 100;
      const boost = 50; // Boost MASIVO para forzar la selección de este cuadrante
      for (const q of CUADRANTES) {
        if (matchesQuadrant(q, target)) addScore(q, boost, `+D-Miner ${p.nombre}`);
      }
      continue; // Ya se evaluó este patrón
    }

    // Patrones normales (Estacionales, Rebotes, etc)
    const ef = num(p.efectividad, 50) / 100;
    const boost = Math.round(15 * Math.max(0.3, eff));
    for (const q of CUADRANTES) {
      if (matchesQuadrant(q, target)) addScore(q, boost, `+patrón ${p.nombre}`);
    }
  }

  // ─── 5. Histórico global agrupado por cuadrante ─────────────
  if (historicalStats && historicalStats.totalSorteos > 0) {
    const freqQ: Record<string, number> = { ALTO_PAR: 0, ALTO_IMPAR: 0, BAJO_PAR: 0, BAJO_IMPAR: 0 };
    for (const [nStr, f] of Object.entries(historicalStats.frecuencias)) {
      const n = parseInt(nStr, 10);
      const q = getQuadrant(n);
      if (CUADRANTES.includes(q)) {
        freqQ[q] += f;
      }
    }
    const maxHistFreq = Math.max(1, ...Object.values(freqQ));
    for (const q of CUADRANTES) {
      const delta = Math.round((freqQ[q] / maxHistFreq) * 15);
      if (delta > 0) addScore(q, delta, `+hist global`);
    }
  }

  // ─── 6. SISTEMA DUAL AI (Modo Dios / Francotirador) ─────────
  let dualSystemApplied = false;
  let dualMotor: "SNIPER" | "GOD_MODE" | "NONE" = "NONE";
  if (options.godModeQuadrant && CUADRANTES.includes(options.godModeQuadrant)) {
    // Modo Dios detectó un patrón de 100% de confianza → Boost masivo
    addScore(options.godModeQuadrant, 80, `+🌌 MODO DIOS (Disparo Quirúrgico)`);
    dualSystemApplied = true;
    dualMotor = "GOD_MODE";
  } else if (options.weekType === "MATH") {
    // Semana Matemática → el Francotirador confía en los scores normales
    dualSystemApplied = true;
    dualMotor = "SNIPER";
  }

  // ─── Selección del Cuadrante Ganador ────────────────────────
  const allQuadrants = Array.from(scores.entries())
    .map(([q, s]) => ({ q, s: Math.max(0, Math.min(100, s)) }))
    .sort((a, b) => b.s - a.s);

  const bestQ = allQuadrants[0];
  
  // Rellenar la cartera con los 25 números del cuadrante ganador
  const numeros = [];
  for (let n = RANGE_MIN; n <= RANGE_MAX; n++) {
    if (getQuadrant(n) === bestQ.q) {
      numeros.push(n);
    }
  }

  const scoresOut: Record<string, number> = {};
  const reasonsOut: Record<string, string[]> = {};
  for (const n of numeros) {
    scoresOut[String(n)] = bestQ.s;
    reasonsOut[String(n)] = reasons.get(bestQ.q) ?? [];
  }

  // Generar ranking global para la UI
  const ranking: CarteraRankedNumber[] = [];
  const selectedSet = new Set(numeros);
  let rankOffset = 0;
  for (const { q, s } of allQuadrants) {
    let qCount = 0;
    for (let n = RANGE_MIN; n <= RANGE_MAX; n++) {
      if (getQuadrant(n) === q) {
        ranking.push({
          numero: n,
          score: s,
          rank: rankOffset + qCount + 1,
          selected: selectedSet.has(n),
          reasons: reasons.get(q) ?? [],
        });
        qCount++;
      }
    }
    rankOffset += qCount; // Mover el rank para el siguiente cuadrante
  }

  return {
    numeros,
    scores: scoresOut,
    reasons: reasonsOut,
    contexto: {
      hora,
      mode: "quadrant_25",
      selectedSize: 25,
      winningQuadrant: bestQ.q,
      quadrantScores: allQuadrants,
      baselineHitRate: 25 / 100,
      totalDrawsHora: totalHora,
      pctAltos: Math.round(pctAltos * 10) / 10,
      pctBajos: Math.round(pctBajos * 10) / 10,
      pctPares: Math.round(pctPares * 10) / 10,
      pctImpares: Math.round(pctImpares * 10) / 10,
      reglasActivas: reglasAct.length,
      reglasVetadas: reglasVetadas.length,
      patronesHora: patronesHora.length,
      estrategia: "quadrant_v3",
      historicalSorteos: historicalStats?.totalSorteos,
      ranking,
      momentum: {
        streakRango,
        streakParidad,
        currentRango,
        currentParidad,
        bloqueoAplicado,
      },
      dualSystem: {
        applied: dualSystemApplied,
        motor: dualMotor,
        godModeQuadrant: options.godModeQuadrant ?? null,
        weekType: options.weekType ?? null,
      },
      confidence: {
        topMean: bestQ.s,
        nextMean: allQuadrants[1]?.s ?? 0,
        gap: bestQ.s - (allQuadrants[1]?.s ?? 0),
        stdevTop: 0,
        spread: 0,
        internalScore: bestQ.s,
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
    selected ? "hit" : rank !== null && rank <= 50 ? "near_miss" : "deep_miss";

  return {
    numero,
    selected,
    rank,
    score,
    inTop15: rank !== null && rank <= 25, // Adaptado para bloques de 25
    inTop25: rank !== null && rank <= 25,
    inTop35: rank !== null && rank <= 50,
    inTop50: rank !== null && rank <= 50,
    rango: isAlto(numero) ? "ALTO" : "BAJO",
    paridad: isPar(numero) ? "PAR" : "IMPAR",
    missType,
    reasons: found?.reasons ?? [],
  };
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
  hitRate: number;
  baseline: number;
  lift: number;
  wilsonLow: number;
  wilsonHigh: number;
  porDia: Array<{ fecha: string; total: number; hits: number; hitRate: number }>;
  porHora: Array<{ hora: string; total: number; hits: number; hitRate: number }>;
}

export const BASELINE = 25 / 100; // 0.25

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
