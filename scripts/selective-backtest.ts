/**
 * BACKTEST SELECTIVO — Solo apuesta cuando hay señal fuerte
 * ===========================================================
 * Simula la estrategia REAL de producción:
 *   1. Modo Dios: Solo dispara cuando hay 100% de confianza con 2+ muestras
 *   2. Rebote de Paridad: Solo apuesta cuando hay 5+ rachas consecutivas (77%)
 *   3. El resto del tiempo: NO APUESTA (protege capital)
 *
 * Uso: npx tsx scripts/selective-backtest.ts
 */
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const envPath = path.resolve(process.cwd(), ".env");
const envContent = fs.readFileSync(envPath, "utf-8");
const envVars = Object.fromEntries(
  envContent.split("\n").filter(l => l && !l.startsWith("#")).map(l => {
    const i = l.indexOf("=");
    return i === -1 ? [] : [l.substring(0, i), l.substring(i + 1).replace(/"/g, "")];
  })
);
const supabase = createClient(envVars.VITE_SUPABASE_URL, envVars.VITE_SUPABASE_PUBLISHABLE_KEY);

// ─── Motor ──────────────────────────────────────────────────────
const isPar = (n: number) => n % 2 === 0;
const isAlto = (n: number) => n >= 50;
const getQuadrant = (n: number) => `${isAlto(n) ? "ALTO" : "BAJO"}_${isPar(n) ? "PAR" : "IMPAR"}`;
const CUADRANTES = ["ALTO_PAR", "ALTO_IMPAR", "BAJO_PAR", "BAJO_IMPAR"];

function godModePredict(
  allDraws: { numero: number; fecha: string; hora: string }[],
  targetHora: string,
  targetFecha: string,
): { quadrant: string; ruleHits: number } | null {
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
  const matchedRule = ruleBook.get(JSON.stringify(currentKeyObj));
  if (!matchedRule || matchedRule.total < 2) return null;

  for (const cuad of CUADRANTES) {
    if ((matchedRule.hits[cuad] / matchedRule.total) * 100 >= 100) {
      return { quadrant: cuad, ruleHits: matchedRule.total };
    }
  }
  return null;
}

function detectRebote(
  pastDraws: { numero: number; fecha: string; hora: string }[],
  hora: string,
  minStreak: number,
): { targetParidad: string; streakLen: number } | null {
  const ordered = pastDraws
    .filter(d => d.hora === hora)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  if (ordered.length < minStreak) return null;

  let streakPar = 0;
  let lastPar: boolean | null = null;
  for (const d of ordered) {
    const p = isPar(d.numero);
    if (lastPar === null) lastPar = p;
    if (p === lastPar) streakPar++;
    else break;
  }

  if (streakPar >= minStreak && lastPar !== null) {
    return {
      targetParidad: lastPar ? "IMPAR" : "PAR",
      streakLen: streakPar,
    };
  }
  return null;
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

  const BET = 100;
  const NUMS = 25;
  const PAGO = 72;
  const COST = BET * NUMS;
  const PREMIO = BET * PAGO;
  const MIN_HISTORY = 50;

  // ═══════════════════════════════════════════════
  // Probar diferentes umbrales de rebote
  // ═══════════════════════════════════════════════
  for (const REBOTE_MIN of [3, 4, 5, 6, 7]) {
    let bets = 0, wins = 0, skipped = 0;
    let invested = 0, collected = 0;

    let godBets = 0, godWins = 0;
    let rebBets = 0, rebWins = 0;
    let bothBets = 0, bothWins = 0;

    let monthlyPL: Record<string, number> = {};

    for (let i = MIN_HISTORY; i < allDraws.length; i++) {
      const current = allDraws[i];
      const pastDraws = allDraws.slice(0, i);
      const actualQ = getQuadrant(current.numero);

      // ─── Evaluar señales ───
      const godResult = godModePredict(pastDraws, current.hora, current.fecha);
      const rebResult = detectRebote(pastDraws, current.hora, REBOTE_MIN);

      // ─── ¿Hay señal suficiente para apostar? ───
      let selectedQuadrant: string | null = null;
      let signalType = "";

      if (godResult && rebResult) {
        // Ambas señales coinciden → disparo doble
        selectedQuadrant = godResult.quadrant;
        signalType = "BOTH";
      } else if (godResult) {
        selectedQuadrant = godResult.quadrant;
        signalType = "GOD";
      } else if (rebResult) {
        // El rebote nos dice la paridad, elegimos los dos cuadrantes con esa paridad
        // Para el backtest, verificamos si el número cayó en la paridad predicha
        const hit = (rebResult.targetParidad === "PAR" && isPar(current.numero)) ||
                    (rebResult.targetParidad === "IMPAR" && !isPar(current.numero));
        rebBets++;
        if (hit) rebWins++;

        const mes = current.fecha.substring(0, 7);
        invested += COST;
        // En rebote apostamos a 50 números (2 cuadrantes), costo doble, mismo premio
        const costRebote = BET * 50; // 50 números
        const premioRebote = hit ? PREMIO : 0;
        collected += premioRebote;

        if (!monthlyPL[mes]) monthlyPL[mes] = 0;
        monthlyPL[mes] += (premioRebote - costRebote);
        bets++;
        if (hit) wins++;
        continue; // Ya contamos el rebote aparte
      } else {
        skipped++;
        continue; // NO APOSTAR
      }

      // Modo Dios o ambos
      bets++;
      invested += COST;
      const hit = selectedQuadrant === actualQ;
      if (hit) {
        wins++;
        collected += PREMIO;
      }

      if (signalType === "GOD") { godBets++; if (hit) godWins++; }
      if (signalType === "BOTH") { bothBets++; if (hit) bothWins++; }

      const mes = current.fecha.substring(0, 7);
      if (!monthlyPL[mes]) monthlyPL[mes] = 0;
      monthlyPL[mes] += (hit ? PREMIO - COST : -COST);
    }

    const pl = collected - invested;
    const wr = bets > 0 ? (wins / bets * 100) : 0;

    console.log("═══════════════════════════════════════════════════════════");
    console.log(`🎯 ESTRATEGIA SELECTIVA — Rebote mínimo: ${REBOTE_MIN}+ rachas`);
    console.log("═══════════════════════════════════════════════════════════");
    console.log(`Sorteos totales:   ${allDraws.length - MIN_HISTORY}`);
    console.log(`⏭️  NO apostó:       ${skipped.toLocaleString()} (${(skipped / (allDraws.length - MIN_HISTORY) * 100).toFixed(1)}%)`);
    console.log(`🎯 SÍ apostó:       ${bets.toLocaleString()} (${(bets / (allDraws.length - MIN_HISTORY) * 100).toFixed(1)}%)`);
    console.log(`✅ Aciertos:        ${wins.toLocaleString()} (${wr.toFixed(2)}%)`);
    console.log(`💰 P&L:             ${pl >= 0 ? "+" : ""}$${pl.toLocaleString()}`);
    console.log(`📊 ROI:             ${invested > 0 ? ((pl / invested) * 100).toFixed(2) : 0}%`);

    if (godBets > 0) {
      console.log(`\n  ⚡ Modo Dios:    ${godBets} apuestas · ${godWins} wins · ${(godWins / godBets * 100).toFixed(1)}% WR`);
    }
    if (rebBets > 0) {
      console.log(`  🔄 Rebote ${REBOTE_MIN}+:   ${rebBets} apuestas · ${rebWins} wins · ${(rebWins / rebBets * 100).toFixed(1)}% WR`);
    }
    if (bothBets > 0) {
      console.log(`  🔥 Ambas:        ${bothBets} apuestas · ${bothWins} wins · ${(bothWins / bothBets * 100).toFixed(1)}% WR`);
    }
    console.log("");
  }

  // ═══════════════════════════════════════════════
  // Backtest detallado de la mejor estrategia
  // ═══════════════════════════════════════════════
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("📆 DESGLOSE MENSUAL — Rebote 5+ (la validada al 77%)");
  console.log("═══════════════════════════════════════════════════════════");

  const REBOTE_BEST = 5;
  let mPL: Record<string, { bets: number; wins: number; pl: number }> = {};
  let totalPL = 0;

  for (let i = MIN_HISTORY; i < allDraws.length; i++) {
    const current = allDraws[i];
    const pastDraws = allDraws.slice(0, i);

    const godResult = godModePredict(pastDraws, current.hora, current.fecha);
    const rebResult = detectRebote(pastDraws, current.hora, REBOTE_BEST);

    if (!godResult && !rebResult) continue;

    const mes = current.fecha.substring(0, 7);
    if (!mPL[mes]) mPL[mes] = { bets: 0, wins: 0, pl: 0 };

    if (godResult) {
      const hit = godResult.quadrant === getQuadrant(current.numero);
      mPL[mes].bets++;
      if (hit) mPL[mes].wins++;
      mPL[mes].pl += hit ? PREMIO - COST : -COST;
    }

    if (rebResult) {
      const hit = (rebResult.targetParidad === "PAR" && isPar(current.numero)) ||
                  (rebResult.targetParidad === "IMPAR" && !isPar(current.numero));
      const costReb = BET * 50;
      mPL[mes].bets++;
      if (hit) mPL[mes].wins++;
      mPL[mes].pl += hit ? PREMIO - costReb : -costReb;
    }
  }

  for (const [mes, s] of Object.entries(mPL).sort(([a], [b]) => a.localeCompare(b))) {
    const icon = s.pl >= 0 ? "🟢" : "🔴";
    totalPL += s.pl;
    console.log(`${icon} ${mes}: ${s.bets} apuestas · ${(s.wins / s.bets * 100).toFixed(0)}% WR · ${s.pl >= 0 ? "+" : ""}$${s.pl.toLocaleString()} · Acum: ${totalPL >= 0 ? "+" : ""}$${totalPL.toLocaleString()}`);
  }

  console.log(`\n💰 TOTAL ACUMULADO: ${totalPL >= 0 ? "+" : ""}$${totalPL.toLocaleString()}`);
}

run().catch(console.error);
