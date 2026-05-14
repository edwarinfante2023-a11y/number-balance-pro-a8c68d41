/**
 * 🔄 BUCLE ROMPE-MUROS — Estrategia Definitiva
 * ===============================================
 * Prueba TODAS las combinaciones posibles hasta encontrar
 * la que rompe el break-even en walk-forward REAL.
 *
 * FIX CRÍTICO: Solo apuesta UNA VEZ por racha (no acumula).
 *
 * Uso: npx tsx scripts/wall-breaker.ts
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

const isPar = (n: number) => n % 2 === 0;
const isAlto = (n: number) => n >= 50;
const getQuadrant = (n: number) => `${isAlto(n) ? "ALTO" : "BAJO"}_${isPar(n) ? "PAR" : "IMPAR"}`;

interface Draw { numero: number; fecha: string; hora: string; }

async function loadDraws(): Promise<Draw[]> {
  console.log("🔄 Cargando historial...");
  const all: Draw[] = [];
  let from = 0;
  while (true) {
    const { data } = await supabase
      .from("draws")
      .select("numero, fecha, lottery_draws!inner(hora)")
      .order("fecha", { ascending: true })
      .range(from, from + 999);
    if (!data || data.length === 0) break;
    for (const r of data) {
      all.push({ numero: r.numero as number, fecha: r.fecha as string, hora: (r as any).lottery_draws?.hora as string });
    }
    from += 1000;
  }
  console.log(`✅ ${all.length} sorteos\n`);
  return all;
}

interface StrategyResult {
  name: string;
  bets: number;
  wins: number;
  winRate: number;
  pl: number;
  roi: number;
  coverage: number; // % de sorteos donde apuesta
}

function runStrategy(
  allDraws: Draw[],
  name: string,
  shouldBet: (pastDrawsByHora: Draw[], current: Draw, allPast: Draw[]) => { bet: boolean; nums: number } | null,
): StrategyResult {
  const BET = 100;
  const PAGO = 72;
  const MIN_HIST = 100;

  let bets = 0, wins = 0, invested = 0, collected = 0;

  // Agrupar draws por hora para eficiencia
  const byHora = new Map<string, Draw[]>();

  for (let i = MIN_HIST; i < allDraws.length; i++) {
    const current = allDraws[i];
    
    // Actualizar el índice por hora (solo pasados)
    const prev = allDraws[i - 1];
    if (prev) {
      if (!byHora.has(prev.hora)) byHora.set(prev.hora, []);
      byHora.get(prev.hora)!.push(prev);
    }

    const pastHora = byHora.get(current.hora);
    if (!pastHora || pastHora.length < 10) continue;

    const decision = shouldBet(pastHora, current, allDraws.slice(0, i));
    if (!decision || !decision.bet) continue;

    const cost = decision.nums * BET;
    const premio = BET * PAGO;
    const actualQ = getQuadrant(current.numero);

    // Verificar si el número ganador está en nuestros números apostados
    let hit = false;
    if (decision.nums === 25) {
      // Apostamos a 1 cuadrante → verificar cuadrante
      // El shouldBet debe haber almacenado el cuadrante elegido
      hit = false; // Se determina dentro del shouldBet vía side-channel
    } else if (decision.nums === 50) {
      // Apostamos a 2 cuadrantes (una paridad completa)
      hit = false;
    }
    // Usamos un hack: el shouldBet retorna nums=1 si es hit, nums=0 si es miss
    // No, mejor diseño:

    bets++;
    invested += cost;
    // El shouldBet ya verificó contra el current — le pasamos current
    // Recalcular: verificamos el hit aquí

    // Para simplificar, el shouldBet retorna nums como indicador:
    // 50 = apuesta a paridad, 25 = apuesta a cuadrante
    if (decision.nums === 50) {
      // Apuesta a paridad: verificar si la paridad predicha es correcta
      // El shouldBet codifica la paridad en el campo 'nums'
      // Necesitamos un mejor diseño...
    }

    collected += 0; // placeholder
    if (hit) collected += premio;
  }

  const pl = collected - invested;
  const total = allDraws.length - MIN_HIST;
  return {
    name,
    bets,
    wins,
    winRate: bets > 0 ? (wins / bets) * 100 : 0,
    pl,
    roi: invested > 0 ? (pl / invested) * 100 : 0,
    coverage: (bets / total) * 100,
  };
}

// ═══════════════════════════════════════════════════════════════
// ESTRATEGIAS — El bucle las prueba TODAS
// ═══════════════════════════════════════════════════════════════

async function run() {
  const allDraws = await loadDraws();
  const BET = 100;
  const PAGO = 72;
  const MIN_HIST = 100;

  const results: StrategyResult[] = [];

  // ═══════════════════════════════════════════════
  // ESTRATEGIA 1: Rebote de Paridad (UNA VEZ por racha)
  // Solo apuesta cuando la racha ACABA DE llegar al umbral
  // ═══════════════════════════════════════════════
  for (const threshold of [3, 4, 5, 6, 7, 8]) {
    for (const numsBet of [25, 50]) {
      let bets = 0, wins = 0, invested = 0, collected = 0;
      
      // Trackear rachas por hora para apostar UNA SOLA VEZ
      const activeStreaks = new Map<string, { len: number; val: boolean; betPlaced: boolean }>();

      for (let i = MIN_HIST; i < allDraws.length; i++) {
        const current = allDraws[i];
        const pastByHora = allDraws.slice(0, i).filter(d => d.hora === current.hora);
        if (pastByHora.length < 10) continue;

        // Calcular la racha actual de paridad para esta hora
        const ordered = [...pastByHora].sort((a, b) => b.fecha.localeCompare(a.fecha));
        let streak = 0;
        let lastVal: boolean | null = null;
        for (const d of ordered) {
          const p = isPar(d.numero);
          if (lastVal === null) lastVal = p;
          if (p === lastVal) streak++;
          else break;
        }

        const key = `${current.hora}`;
        const prev = activeStreaks.get(key);

        if (streak >= threshold && lastVal !== null) {
          // ¿Ya apostamos en esta racha?
          if (prev && prev.len < threshold && streak >= threshold) {
            // La racha ACABA DE cruzar el umbral → APOSTAR
            const targetPar = lastVal ? "IMPAR" : "PAR";
            const cost = numsBet * BET;
            invested += cost;
            bets++;

            let hit = false;
            if (numsBet === 50) {
              // Apuesta a paridad: ¿el resultado tiene la paridad predicha?
              hit = (targetPar === "PAR" && isPar(current.numero)) ||
                    (targetPar === "IMPAR" && !isPar(current.numero));
            } else {
              // Apuesta a cuadrante: elegir el cuadrante más frecuente de esa paridad
              const freqs: Record<string, number> = {};
              for (const d of ordered.slice(0, 30)) {
                const q = getQuadrant(d.numero);
                if (q.includes(targetPar)) freqs[q] = (freqs[q] ?? 0) + 1;
              }
              const bestQ = Object.entries(freqs).sort(([, a], [, b]) => b - a)[0]?.[0];
              hit = bestQ ? getQuadrant(current.numero) === bestQ : false;
            }

            if (hit) { wins++; collected += BET * PAGO; }
            activeStreaks.set(key, { len: streak, val: lastVal, betPlaced: true });
          } else if (!prev || prev.betPlaced === false) {
            // Primera vez que vemos esta racha cruzar
            if (streak >= threshold && (!prev || prev.len < threshold)) {
              const targetPar = lastVal ? "IMPAR" : "PAR";
              const cost = numsBet * BET;
              invested += cost;
              bets++;

              let hit = false;
              if (numsBet === 50) {
                hit = (targetPar === "PAR" && isPar(current.numero)) ||
                      (targetPar === "IMPAR" && !isPar(current.numero));
              } else {
                const freqs: Record<string, number> = {};
                for (const d of ordered.slice(0, 30)) {
                  const q = getQuadrant(d.numero);
                  if (q.includes(targetPar)) freqs[q] = (freqs[q] ?? 0) + 1;
                }
                const bestQ = Object.entries(freqs).sort(([, a], [, b]) => b - a)[0]?.[0];
                hit = bestQ ? getQuadrant(current.numero) === bestQ : false;
              }

              if (hit) { wins++; collected += BET * PAGO; }
              activeStreaks.set(key, { len: streak, val: lastVal, betPlaced: true });
            } else {
              activeStreaks.set(key, { len: streak, val: lastVal, betPlaced: false });
            }
          } else {
            // Ya apostamos, actualizar longitud
            activeStreaks.set(key, { ...prev, len: streak });
          }
        } else {
          // Racha rota o menor al umbral → resetear
          activeStreaks.set(key, { len: streak, val: lastVal ?? false, betPlaced: false });
        }
      }

      const pl = collected - invested;
      const total = allDraws.length - MIN_HIST;
      const wr = bets > 0 ? (wins / bets) * 100 : 0;
      const breakEven = numsBet === 50 ? (50 / PAGO * 100) : (25 / PAGO * 100);

      results.push({
        name: `Rebote ${threshold}+ → ${numsBet}nums (1x/racha) [BE:${breakEven.toFixed(1)}%]`,
        bets, wins, winRate: wr, pl, roi: invested > 0 ? (pl / invested) * 100 : 0,
        coverage: (bets / total) * 100,
      });
    }
  }

  // ═══════════════════════════════════════════════
  // ESTRATEGIA 2: Rebote de RANGO (Alto/Bajo)
  // ═══════════════════════════════════════════════
  for (const threshold of [3, 4, 5, 6, 7]) {
    let bets = 0, wins = 0, invested = 0, collected = 0;
    const activeStreaks = new Map<string, { len: number; val: boolean; betPlaced: boolean }>();

    for (let i = MIN_HIST; i < allDraws.length; i++) {
      const current = allDraws[i];
      const pastByHora = allDraws.slice(0, i).filter(d => d.hora === current.hora);
      if (pastByHora.length < 10) continue;

      const ordered = [...pastByHora].sort((a, b) => b.fecha.localeCompare(a.fecha));
      let streak = 0;
      let lastVal: boolean | null = null;
      for (const d of ordered) {
        const a = isAlto(d.numero);
        if (lastVal === null) lastVal = a;
        if (a === lastVal) streak++;
        else break;
      }

      const key = current.hora;
      const prev = activeStreaks.get(key);

      if (streak >= threshold && lastVal !== null && (!prev || prev.len < threshold || !prev.betPlaced)) {
        if (!prev || prev.len < threshold) {
          const targetRango = lastVal ? "BAJO" : "ALTO";
          const cost = 50 * BET;
          invested += cost;
          bets++;
          const hit = (targetRango === "ALTO" && isAlto(current.numero)) ||
                      (targetRango === "BAJO" && !isAlto(current.numero));
          if (hit) { wins++; collected += BET * PAGO; }
          activeStreaks.set(key, { len: streak, val: lastVal, betPlaced: true });
        }
      } else if (!streak || streak < threshold) {
        activeStreaks.set(key, { len: streak, val: lastVal ?? false, betPlaced: false });
      }
    }

    const pl = collected - invested;
    const total = allDraws.length - MIN_HIST;
    results.push({
      name: `Rebote RANGO ${threshold}+ → 50nums (1x/racha)`,
      bets, wins, winRate: bets > 0 ? (wins / bets) * 100 : 0, pl,
      roi: invested > 0 ? (pl / invested) * 100 : 0,
      coverage: (bets / total) * 100,
    });
  }

  // ═══════════════════════════════════════════════
  // ESTRATEGIA 3: Doble Rebote (Paridad + Rango al mismo tiempo)
  // ═══════════════════════════════════════════════
  for (const thP of [3, 4, 5]) {
    for (const thR of [3, 4, 5]) {
      let bets = 0, wins = 0, invested = 0, collected = 0;

      for (let i = MIN_HIST; i < allDraws.length; i++) {
        const current = allDraws[i];
        const pastByHora = allDraws.slice(0, i).filter(d => d.hora === current.hora);
        if (pastByHora.length < 10) continue;

        const ordered = [...pastByHora].sort((a, b) => b.fecha.localeCompare(a.fecha));
        
        let sPar = 0, sAlto = 0;
        let lPar: boolean | null = null, lAlto: boolean | null = null;
        for (const d of ordered) {
          if (lPar === null) lPar = isPar(d.numero);
          if (isPar(d.numero) === lPar && sPar < 20) sPar++;
          else if (sPar === 0) sPar = 0;
        }
        // Recalcular limpio
        sPar = 0; lPar = null;
        for (const d of ordered) {
          const p = isPar(d.numero);
          if (lPar === null) lPar = p;
          if (p === lPar) sPar++;
          else break;
        }
        sAlto = 0; lAlto = null;
        for (const d of ordered) {
          const a = isAlto(d.numero);
          if (lAlto === null) lAlto = a;
          if (a === lAlto) sAlto++;
          else break;
        }

        if (sPar >= thP && sAlto >= thR && lPar !== null && lAlto !== null) {
          const targetPar = lPar ? "IMPAR" : "PAR";
          const targetRango = lAlto ? "BAJO" : "ALTO";
          const targetQ = `${targetRango}_${targetPar}`;
          
          const cost = 25 * BET;
          invested += cost;
          bets++;
          const hit = getQuadrant(current.numero) === targetQ;
          if (hit) { wins++; collected += BET * PAGO; }
        }
      }

      const pl = collected - invested;
      const total = allDraws.length - MIN_HIST;
      results.push({
        name: `Doble Rebote P${thP}+R${thR} → 25nums`,
        bets, wins, winRate: bets > 0 ? (wins / bets) * 100 : 0, pl,
        roi: invested > 0 ? (pl / invested) * 100 : 0,
        coverage: (bets / total) * 100,
      });
    }
  }

  // ═══════════════════════════════════════════════
  // RESULTADOS
  // ═══════════════════════════════════════════════
  console.log("═══════════════════════════════════════════════════════════════════════════════");
  console.log("🏆 TODAS LAS ESTRATEGIAS — Ordenadas por P&L");
  console.log("═══════════════════════════════════════════════════════════════════════════════");
  console.log(`${"Estrategia".padEnd(50)} ${"Apuestas".padStart(8)} ${"WR%".padStart(7)} ${"P&L".padStart(14)} ${"ROI%".padStart(8)}`);
  console.log("─".repeat(90));

  const sorted = results.sort((a, b) => b.pl - a.pl);
  for (const r of sorted) {
    const icon = r.pl > 0 ? "🟢" : "🔴";
    const plStr = `${r.pl >= 0 ? "+" : ""}$${r.pl.toLocaleString()}`;
    console.log(
      `${icon} ${r.name.padEnd(48)} ${String(r.bets).padStart(8)} ${r.winRate.toFixed(1).padStart(6)}% ${plStr.padStart(14)} ${(r.roi >= 0 ? "+" : "") + r.roi.toFixed(1).padStart(6)}%`
    );
  }

  const winners = sorted.filter(r => r.pl > 0);
  console.log(`\n${"═".repeat(90)}`);
  if (winners.length > 0) {
    console.log(`✅ ${winners.length} ESTRATEGIAS RENTABLES ENCONTRADAS`);
    console.log(`🏆 MEJOR: ${winners[0].name}`);
    console.log(`   → ${winners[0].bets} apuestas · ${winners[0].winRate.toFixed(1)}% WR · +$${winners[0].pl.toLocaleString()} · ROI +${winners[0].roi.toFixed(1)}%`);
  } else {
    console.log(`🔴 NINGUNA ESTRATEGIA ROMPIÓ EL MURO`);
  }
  console.log("═".repeat(90));
}

run().catch(console.error);
