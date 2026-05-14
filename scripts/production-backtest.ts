/**
 * BACKTEST COMPLETO DEL SISTEMA DE PRODUCCIÓN
 * ============================================
 * Simula el sistema EXACTO como está en producción (Radar + Modo Dios + Rebote)
 * sobre TODO el historial, sorteo por sorteo, como si hubieras apostado desde el día 1.
 *
 * Uso: npx tsx scripts/production-backtest.ts
 */
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// ─── Cargar env ─────────────────────────────────────────────────
const envPath = path.resolve(process.cwd(), ".env");
const envContent = fs.readFileSync(envPath, "utf-8");
const envVars = Object.fromEntries(
  envContent.split("\n").filter(l => l && !l.startsWith("#")).map(l => {
    const i = l.indexOf("=");
    return i === -1 ? [] : [l.substring(0, i), l.substring(i + 1).replace(/"/g, "")];
  })
);
const supabase = createClient(envVars.VITE_SUPABASE_URL, envVars.VITE_SUPABASE_PUBLISHABLE_KEY);

// ─── Motor (copiado exacto de producción) ───────────────────────
const isPar = (n: number) => n % 2 === 0;
const isAlto = (n: number) => n >= 50;
const getQuadrant = (n: number) => {
  const ab = isAlto(n) ? "ALTO" : "BAJO";
  const pi = isPar(n) ? "PAR" : "IMPAR";
  return `${ab}_${pi}`;
};

type WeekType = "MATH" | "CHAOS";
const CUADRANTES = ["ALTO_PAR", "ALTO_IMPAR", "BAJO_PAR", "BAJO_IMPAR"];

function classifyWeek(recent: { numero: number }[]): WeekType {
  if (recent.length < 5) return "CHAOS";
  const last5 = recent.slice(0, 5);
  let hits = 0, evals = 0;
  for (let i = 2; i < last5.length; i++) {
    const h0 = last5[i - 1].numero;
    const h1 = last5[i - 2].numero;
    const target = last5[i].numero;
    const sameAlto = isAlto(h0) === isAlto(h1);
    const samePar = isPar(h0) === isPar(h1);
    if (sameAlto || samePar) {
      evals++;
      if (sameAlto && isAlto(target) === isAlto(h0)) hits++;
      else if (samePar && isPar(target) === isPar(h0)) hits++;
    }
  }
  if (evals >= 2 && (hits / evals) * 100 >= 60) return "MATH";
  return "CHAOS";
}

function godModePredict(
  allDraws: { numero: number; fecha: string; hora: string }[],
  targetHora: string,
  targetFecha: string,
): { quadrant: string; confidence: number; ruleHits: number } | null {
  const DEPTH = 4;
  const drawsForHora = allDraws
    .filter(d => d.hora === targetHora)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  if (drawsForHora.length < DEPTH + 2) return null;

  const ruleBook = new Map<string, { total: number; hits: Record<string, number> }>();
  for (let i = DEPTH; i < drawsForHora.length; i++) {
    const current = drawsForHora[i];
    const d = new Date(current.fecha + "T12:00:00");
    if (isNaN(d.getTime())) continue;
    const keyObj: Record<string, unknown> = {
      hora: targetHora, day: d.getDay(), month: d.getMonth() + 1,
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

  const targetDate = new Date(targetFecha + "T12:00:00");
  if (isNaN(targetDate.getTime())) return null;
  const lastN = drawsForHora.slice(-DEPTH);
  if (lastN.length < DEPTH) return null;

  const currentKeyObj: Record<string, unknown> = {
    hora: targetHora, day: targetDate.getDay(), month: targetDate.getMonth() + 1,
  };
  for (let j = 1; j <= DEPTH; j++) {
    currentKeyObj[`p${j}`] = getQuadrant(lastN[lastN.length - j].numero);
  }
  const currentKey = JSON.stringify(currentKeyObj);
  const matchedRule = ruleBook.get(currentKey);
  if (!matchedRule || matchedRule.total < 2) return null;

  for (const cuad of CUADRANTES) {
    const winRate = (matchedRule.hits[cuad] / matchedRule.total) * 100;
    if (winRate >= 100) return { quadrant: cuad, confidence: winRate, ruleHits: matchedRule.total };
  }
  return null;
}

/**
 * Simula la selección de cuadrante del sistema de producción COMPLETO
 * para un sorteo dado, usando solo datos ANTERIORES a ese sorteo (sin trampa).
 */
function selectQuadrant(
  pastDraws: { numero: number; fecha: string; hora: string }[],
  hora: string,
  fecha: string,
): { quadrant: string; motor: string; reason: string } {
  const scores: Record<string, number> = { ALTO_PAR: 0, ALTO_IMPAR: 0, BAJO_PAR: 0, BAJO_IMPAR: 0 };

  // ─── 1. Frecuencia por hora ───
  const drawsHora = pastDraws.filter(d => d.hora === hora);
  const freqHora: Record<string, number> = {};
  for (const d of drawsHora) {
    const q = getQuadrant(d.numero);
    freqHora[q] = (freqHora[q] ?? 0) + 1;
  }
  const maxFreq = Math.max(1, ...Object.values(freqHora));
  for (const [q, f] of Object.entries(freqHora)) {
    scores[q] += Math.round((f / maxFreq) * 20);
  }

  // ─── 2. Bloqueo de rachas + Rebote ───
  const ordered = [...drawsHora].sort((a, b) => `${b.fecha}`.localeCompare(`${a.fecha}`));
  
  // Streak de paridad
  let streakPar = 0;
  let lastPar: boolean | null = null;
  for (const d of ordered) {
    const p = isPar(d.numero);
    if (lastPar === null) lastPar = p;
    if (p === lastPar) streakPar++;
    else break;
  }

  // Streak de rango
  let streakRango = 0;
  let lastAlto: boolean | null = null;
  for (const d of ordered) {
    const a = isAlto(d.numero);
    if (lastAlto === null) lastAlto = a;
    if (a === lastAlto) streakRango++;
    else break;
  }

  // Bloqueo de rango (>= 3)
  if (streakRango >= 3 && lastAlto !== null && lastPar !== null) {
    const targetRango = lastAlto ? "BAJO" : "ALTO";
    const targetParidad = lastPar ? "IMPAR" : "PAR";
    const boost = Math.min(40, streakRango * 10);
    scores[`${targetRango}_${targetParidad}`] += boost;
  }

  // Rebote de paridad (>= 3, fuerte a >= 5)
  if (streakPar >= 3 && lastPar !== null) {
    const targetParidad = lastPar ? "IMPAR" : "PAR";
    const reboteBoost = streakPar >= 5
      ? Math.min(60, streakPar * 12)
      : Math.min(40, streakPar * 10);
    for (const q of CUADRANTES) {
      if (q.includes(targetParidad)) scores[q] += reboteBoost;
    }
  }

  // ─── 3. Radar + Modo Dios ───
  const recentForRadar = ordered.slice(0, 5);
  const weekType = classifyWeek(recentForRadar);
  const godResult = godModePredict(pastDraws, hora, fecha);

  let motor = weekType === "MATH" ? "FRANCOTIRADOR" : "VIGILANDO";

  if (godResult) {
    scores[godResult.quadrant] += 80;
    motor = "MODO DIOS";
  }

  // ─── Selección ───
  const best = Object.entries(scores).sort(([, a], [, b]) => b - a)[0];
  return { quadrant: best[0], motor, reason: `score=${best[1]}` };
}

// ─── MAIN ───────────────────────────────────────────────────────
async function run() {
  console.log("🔄 Cargando historial completo...");
  const allDraws: { numero: number; fecha: string; hora: string }[] = [];
  let from = 0;
  while (true) {
    const { data } = await supabase
      .from("draws")
      .select("numero, fecha, lottery_draws!inner(hora)")
      .order("fecha", { ascending: true })
      .range(from, from + 999);
    if (!data || data.length === 0) break;
    for (const r of data) {
      allDraws.push({
        numero: r.numero as number,
        fecha: r.fecha as string,
        hora: (r as any).lottery_draws?.hora as string,
      });
    }
    from += 1000;
  }
  console.log(`✅ ${allDraws.length} sorteos cargados\n`);

  // Configuración de apuestas
  const BET_PER_NUMBER = 100;     // $100 por número
  const NUMBERS_PER_QUADRANT = 25;
  const PAGO_1RA = 72;            // Paga 72x
  const PAGO_2DA = 10;
  const PAGO_3DA = 4;
  const COST_PER_BET = BET_PER_NUMBER * NUMBERS_PER_QUADRANT; // $2,500

  const MIN_HISTORY = 50; // Necesitamos al menos 50 sorteos para empezar

  let totalBets = 0;
  let wins1 = 0, wins2 = 0, wins3 = 0;
  let invested = 0;
  let collected = 0;
  let balance = 200_000; // Fondo inicial
  let peak = balance;
  let maxDD = 0;

  let motorStats = { FRANCOTIRADOR: { bets: 0, wins: 0 }, "MODO DIOS": { bets: 0, wins: 0 }, VIGILANDO: { bets: 0, wins: 0 } };
  let weekStats = { MATH: { bets: 0, wins: 0 }, CHAOS: { bets: 0, wins: 0 } };

  let monthlyPL: Record<string, { bets: number; wins: number; pl: number }> = {};

  console.log("═══════════════════════════════════════════════════════════");
  console.log("🏦 BACKTEST DEL SISTEMA DE PRODUCCIÓN COMPLETO");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`Apuesta: $${BET_PER_NUMBER} × ${NUMBERS_PER_QUADRANT} números = $${COST_PER_BET}/sorteo`);
  console.log(`Pago: 1ra=${PAGO_1RA}x ($${BET_PER_NUMBER * PAGO_1RA}) · 2da=${PAGO_2DA}x · 3ra=${PAGO_3DA}x`);
  console.log(`Break-even: ${((NUMBERS_PER_QUADRANT / PAGO_1RA) * 100).toFixed(1)}%`);
  console.log(`Fondo inicial: $${balance.toLocaleString()}\n`);

  for (let i = MIN_HISTORY; i < allDraws.length; i++) {
    const current = allDraws[i];
    const pastDraws = allDraws.slice(0, i); // Solo datos ANTERIORES
    
    const { quadrant, motor } = selectQuadrant(pastDraws, current.hora, current.fecha);
    const actualQuadrant = getQuadrant(current.numero);
    const hit = quadrant === actualQuadrant;

    totalBets++;
    invested += COST_PER_BET;
    balance -= COST_PER_BET;

    let premio = 0;
    if (hit) {
      wins1++;
      premio = BET_PER_NUMBER * PAGO_1RA;
    }
    // Simular 2da y 3ra (si el número está en el cuadrante)
    // Nota: 2da y 3ra son números diferentes, así que solo contamos si caen en el cuadrante
    // Para simplificar, usamos probabilidad base de 25% para 2da y 3ra
    // En producción real, estos se evalúan contra los draws reales

    collected += premio;
    balance += premio;

    if (balance > peak) peak = balance;
    const dd = peak - balance;
    if (dd > maxDD) maxDD = dd;

    // Stats por motor
    const mKey = motor as keyof typeof motorStats;
    if (motorStats[mKey]) {
      motorStats[mKey].bets++;
      if (hit) motorStats[mKey].wins++;
    }

    // Stats por tipo de semana
    const recentForRadar = pastDraws
      .filter(d => d.hora === current.hora)
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .slice(0, 5);
    const wt = classifyWeek(recentForRadar);
    weekStats[wt].bets++;
    if (hit) weekStats[wt].wins++;

    // Stats por mes
    const mes = current.fecha.substring(0, 7);
    if (!monthlyPL[mes]) monthlyPL[mes] = { bets: 0, wins: 0, pl: 0 };
    monthlyPL[mes].bets++;
    if (hit) monthlyPL[mes].wins++;
    monthlyPL[mes].pl += (premio - COST_PER_BET);
  }

  const pl = collected - invested;
  const hitRate = (wins1 / totalBets * 100);
  const roi = (pl / invested * 100);

  console.log("═══════════════════════════════════════════════════════════");
  console.log("📊 RESULTADOS GENERALES");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`Sorteos evaluados: ${totalBets.toLocaleString()}`);
  console.log(`Aciertos 1ra:     ${wins1.toLocaleString()} (${hitRate.toFixed(2)}%)`);
  console.log(`Break-even:       ${((NUMBERS_PER_QUADRANT / PAGO_1RA) * 100).toFixed(1)}%`);
  console.log(`Diferencia:       ${hitRate > (NUMBERS_PER_QUADRANT / PAGO_1RA * 100) ? "+" : ""}${(hitRate - (NUMBERS_PER_QUADRANT / PAGO_1RA * 100)).toFixed(2)}%`);
  console.log(`\nInvertido:        $${invested.toLocaleString()}`);
  console.log(`Cobrado:          $${collected.toLocaleString()}`);
  console.log(`Ganancia/Pérdida: ${pl >= 0 ? "+" : ""}$${pl.toLocaleString()}`);
  console.log(`ROI:              ${roi >= 0 ? "+" : ""}${roi.toFixed(2)}%`);
  console.log(`Saldo final:      $${balance.toLocaleString()}`);
  console.log(`Máx. bajón:       $${maxDD.toLocaleString()}`);

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("🤖 RENDIMIENTO POR MOTOR");
  console.log("═══════════════════════════════════════════════════════════");
  for (const [motor, stats] of Object.entries(motorStats)) {
    if (stats.bets === 0) continue;
    const wr = (stats.wins / stats.bets * 100).toFixed(2);
    const plMotor = (stats.wins * BET_PER_NUMBER * PAGO_1RA) - (stats.bets * COST_PER_BET);
    console.log(`${motor}:`);
    console.log(`  Apuestas: ${stats.bets.toLocaleString()} · Aciertos: ${stats.wins.toLocaleString()} · Win Rate: ${wr}%`);
    console.log(`  P&L: ${plMotor >= 0 ? "+" : ""}$${plMotor.toLocaleString()}`);
  }

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("📅 RENDIMIENTO POR TIPO DE SEMANA");
  console.log("═══════════════════════════════════════════════════════════");
  for (const [wt, stats] of Object.entries(weekStats)) {
    if (stats.bets === 0) continue;
    const wr = (stats.wins / stats.bets * 100).toFixed(2);
    const label = wt === "MATH" ? "🟢 Favorable (Matemática)" : "🔴 Difícil (Caótica)";
    console.log(`${label}: ${stats.bets.toLocaleString()} apuestas · ${wr}% Win Rate`);
  }

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("📆 GANANCIA POR MES");
  console.log("═══════════════════════════════════════════════════════════");
  for (const [mes, stats] of Object.entries(monthlyPL).sort(([a], [b]) => a.localeCompare(b))) {
    const wr = (stats.wins / stats.bets * 100).toFixed(1);
    const bar = stats.pl >= 0 ? "🟢" : "🔴";
    console.log(`${bar} ${mes}: ${stats.bets} sorteos · ${wr}% WR · ${stats.pl >= 0 ? "+" : ""}$${stats.pl.toLocaleString()}`);
  }

  console.log("\n═══════════════════════════════════════════════════════════");
  if (pl > 0) {
    console.log(`✅ VEREDICTO: EL SISTEMA ES RENTABLE (+$${pl.toLocaleString()})`);
  } else {
    console.log(`🔴 VEREDICTO: EL SISTEMA PIERDE (-$${Math.abs(pl).toLocaleString()})`);
  }
  console.log("═══════════════════════════════════════════════════════════\n");
}

run().catch(console.error);
