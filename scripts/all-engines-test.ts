/**
 * 🔫 TEST COMPLETO DE TODOS LOS MOTORES DE PRODUCCIÓN
 * =====================================================
 * Walk-forward real: solo usa datos anteriores para predecir.
 * Prueba cada motor por separado Y combinados.
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
const getQ = (n: number) => `${isAlto(n) ? "ALTO" : "BAJO"}_${isPar(n) ? "PAR" : "IMPAR"}`;
const CUADRANTES = ["ALTO_PAR", "ALTO_IMPAR", "BAJO_PAR", "BAJO_IMPAR"];

interface Draw { numero: number; fecha: string; hora: string; }

// ─── MOTOR 1: FRANCOTIRADOR (frecuencia + bloqueo) ────────────
function francotirador(pastHora: Draw[]): string | null {
  if (pastHora.length < 10) return null;
  const ordered = [...pastHora].sort((a, b) => b.fecha.localeCompare(a.fecha));
  
  // Scores por frecuencia
  const scores: Record<string, number> = { ALTO_PAR: 0, ALTO_IMPAR: 0, BAJO_PAR: 0, BAJO_IMPAR: 0 };
  const freqs: Record<string, number> = {};
  for (const d of ordered.slice(0, 100)) {
    const q = getQ(d.numero);
    freqs[q] = (freqs[q] ?? 0) + 1;
  }
  const maxF = Math.max(1, ...Object.values(freqs));
  for (const [q, f] of Object.entries(freqs)) scores[q] += Math.round((f / maxF) * 20);

  // Bloqueo paridad
  let sPar = 0; let lPar: boolean | null = null;
  for (const d of ordered) { const p = isPar(d.numero); if (lPar === null) lPar = p; if (p === lPar) sPar++; else break; }
  if (sPar >= 3 && lPar !== null) {
    const tp = lPar ? "IMPAR" : "PAR";
    const boost = sPar >= 5 ? Math.min(60, sPar * 12) : Math.min(40, sPar * 10);
    for (const q of CUADRANTES) { if (q.includes(tp)) scores[q] += boost; }
  }

  // Bloqueo rango
  let sAlto = 0; let lAlto: boolean | null = null;
  for (const d of ordered) { const a = isAlto(d.numero); if (lAlto === null) lAlto = a; if (a === lAlto) sAlto++; else break; }
  if (sAlto >= 3 && lAlto !== null && lPar !== null) {
    const tr = lAlto ? "BAJO" : "ALTO";
    const tp = lPar ? "IMPAR" : "PAR";
    scores[`${tr}_${tp}`] += Math.min(40, sAlto * 10);
  }

  return Object.entries(scores).sort(([, a], [, b]) => b - a)[0][0];
}

// ─── MOTOR 2: MODO DIOS (profundidad 4) ──────────────────────
function modoDios(allPast: Draw[], hora: string, fecha: string): string | null {
  const DEPTH = 4;
  const hDraws = allPast.filter(d => d.hora === hora).sort((a, b) => a.fecha.localeCompare(b.fecha));
  if (hDraws.length < DEPTH + 2) return null;

  const ruleBook = new Map<string, { total: number; hits: Record<string, number> }>();
  for (let i = DEPTH; i < hDraws.length; i++) {
    const c = hDraws[i];
    const d = new Date(c.fecha + "T12:00:00");
    if (isNaN(d.getTime())) continue;
    const key = JSON.stringify({ hora, day: d.getDay(), month: d.getMonth() + 1,
      p1: getQ(hDraws[i-1].numero), p2: getQ(hDraws[i-2].numero),
      p3: getQ(hDraws[i-3].numero), p4: getQ(hDraws[i-4].numero) });
    let e = ruleBook.get(key);
    if (!e) { e = { total: 0, hits: { ALTO_PAR: 0, ALTO_IMPAR: 0, BAJO_PAR: 0, BAJO_IMPAR: 0 } }; ruleBook.set(key, e); }
    e.total++; e.hits[getQ(c.numero)]++;
  }

  const td = new Date(fecha + "T12:00:00");
  if (isNaN(td.getTime())) return null;
  const lastN = hDraws.slice(-DEPTH);
  if (lastN.length < DEPTH) return null;
  const ck = JSON.stringify({ hora, day: td.getDay(), month: td.getMonth() + 1,
    p1: getQ(lastN[DEPTH-1].numero), p2: getQ(lastN[DEPTH-2].numero),
    p3: getQ(lastN[DEPTH-3].numero), p4: getQ(lastN[DEPTH-4].numero) });
  const match = ruleBook.get(ck);
  if (!match || match.total < 2) return null;
  for (const q of CUADRANTES) {
    if ((match.hits[q] / match.total) * 100 >= 100) return q;
  }
  return null;
}

// ─── MOTOR 3: DOBLE REBOTE (P5+R5) ──────────────────────────
function dobleRebote(pastHora: Draw[], thP: number, thR: number): string | null {
  if (pastHora.length < Math.max(thP, thR) + 2) return null;
  const ordered = [...pastHora].sort((a, b) => b.fecha.localeCompare(a.fecha));
  
  let sPar = 0, lPar: boolean | null = null;
  for (const d of ordered) { const p = isPar(d.numero); if (lPar === null) lPar = p; if (p === lPar) sPar++; else break; }
  
  let sAlto = 0, lAlto: boolean | null = null;
  for (const d of ordered) { const a = isAlto(d.numero); if (lAlto === null) lAlto = a; if (a === lAlto) sAlto++; else break; }

  if (sPar >= thP && sAlto >= thR && lPar !== null && lAlto !== null) {
    return `${lAlto ? "BAJO" : "ALTO"}_${lPar ? "IMPAR" : "PAR"}`;
  }
  return null;
}

// ─── MOTOR 4: SOLO REBOTE PARIDAD ────────────────────────────
function reboteParidad(pastHora: Draw[], threshold: number): string | null {
  if (pastHora.length < threshold + 2) return null;
  const ordered = [...pastHora].sort((a, b) => b.fecha.localeCompare(a.fecha));
  let sPar = 0, lPar: boolean | null = null;
  for (const d of ordered) { const p = isPar(d.numero); if (lPar === null) lPar = p; if (p === lPar) sPar++; else break; }
  if (sPar >= threshold && lPar !== null) {
    // Elegir cuadrante: la paridad opuesta + el rango más frecuente últimamente
    const tp = lPar ? "IMPAR" : "PAR";
    const recent30 = ordered.slice(0, 30);
    let altos = 0, bajos = 0;
    for (const d of recent30) { if (isAlto(d.numero)) altos++; else bajos++; }
    const tr = bajos > altos ? "BAJO" : "ALTO"; // Apuesta al menos frecuente (contrarian)
    return `${tr}_${tp}`;
  }
  return null;
}

// ─── MAIN ───────────────────────────────────────────────────
async function run() {
  console.log("🔄 Cargando...");
  const allDraws: Draw[] = [];
  let from = 0;
  while (true) {
    const { data } = await supabase.from("draws").select("numero, fecha, lottery_draws!inner(hora)")
      .order("fecha", { ascending: true }).range(from, from + 999);
    if (!data || data.length === 0) break;
    for (const r of data) allDraws.push({ numero: r.numero as number, fecha: r.fecha as string, hora: (r as any).lottery_draws?.hora });
    from += 1000;
  }
  console.log(`✅ ${allDraws.length} sorteos\n`);

  const BET = 100, NUMS = 25, PAGO = 72, COST = BET * NUMS, PREMIO = BET * PAGO;
  const BE = (NUMS / PAGO * 100);
  const MIN = 100;

  type Stats = { bets: number; wins: number; invested: number; collected: number };
  const make = (): Stats => ({ bets: 0, wins: 0, invested: 0, collected: 0 });

  const strategies: Record<string, Stats> = {
    "🔫 Francotirador (siempre)": make(),
    "⚡ Modo Dios (solo 100%)": make(),
    "🔄 Rebote P5 → Cuadrante": make(),
    "🔄 Rebote P6 → Cuadrante": make(),
    "🔄 Rebote P7 → Cuadrante": make(),
    "💎 Doble Rebote P5+R5": make(),
    "💎 Doble Rebote P4+R4": make(),
    "💎 Doble Rebote P3+R3": make(),
    "🔫+⚡ Franco + Dios (Dios override)": make(),
    "🔫+🔄 Franco + Rebote P5 (Rebote override)": make(),
    "🔫+💎 Franco + Doble P5R5 (Doble override)": make(),
    "⚡+💎 Dios OR Doble P5R5 (cualquiera)": make(),
    "🧠 MEGA: Dios > Doble > Rebote > Franco": make(),
    "🎯 SELECTIVO: Solo Dios OR Doble P5R5": make(),
  };

  const add = (s: Stats, hit: boolean) => {
    s.bets++; s.invested += COST;
    if (hit) { s.wins++; s.collected += PREMIO; }
  };

  // Índice por hora (se construye progresivamente)
  const byHora = new Map<string, Draw[]>();

  for (let i = MIN; i < allDraws.length; i++) {
    const current = allDraws[i];
    // Añadir draw anterior al índice
    const prev = allDraws[i - 1];
    if (prev) {
      if (!byHora.has(prev.hora)) byHora.set(prev.hora, []);
      byHora.get(prev.hora)!.push(prev);
    }
    const pastHora = byHora.get(current.hora);
    if (!pastHora || pastHora.length < 10) continue;

    const actualQ = getQ(current.numero);
    const allPast = allDraws.slice(0, i); // Solo para Modo Dios (necesita todas las horas)

    // ─── Evaluar cada motor ───
    const qFranco = francotirador(pastHora);
    const qDios = modoDios(allPast, current.hora, current.fecha);
    const qRebP5 = reboteParidad(pastHora, 5);
    const qRebP6 = reboteParidad(pastHora, 6);
    const qRebP7 = reboteParidad(pastHora, 7);
    const qDobP5R5 = dobleRebote(pastHora, 5, 5);
    const qDobP4R4 = dobleRebote(pastHora, 4, 4);
    const qDobP3R3 = dobleRebote(pastHora, 3, 3);

    // ─── Registrar resultados individuales ───
    if (qFranco) add(strategies["🔫 Francotirador (siempre)"], actualQ === qFranco);
    if (qDios) add(strategies["⚡ Modo Dios (solo 100%)"], actualQ === qDios);
    if (qRebP5) add(strategies["🔄 Rebote P5 → Cuadrante"], actualQ === qRebP5);
    if (qRebP6) add(strategies["🔄 Rebote P6 → Cuadrante"], actualQ === qRebP6);
    if (qRebP7) add(strategies["🔄 Rebote P7 → Cuadrante"], actualQ === qRebP7);
    if (qDobP5R5) add(strategies["💎 Doble Rebote P5+R5"], actualQ === qDobP5R5);
    if (qDobP4R4) add(strategies["💎 Doble Rebote P4+R4"], actualQ === qDobP4R4);
    if (qDobP3R3) add(strategies["💎 Doble Rebote P3+R3"], actualQ === qDobP3R3);

    // ─── Combinaciones ───
    // Franco + Dios override
    if (qFranco) {
      const q = qDios ?? qFranco;
      add(strategies["🔫+⚡ Franco + Dios (Dios override)"], actualQ === q);
    }
    // Franco + Rebote override
    if (qFranco) {
      const q = qRebP5 ?? qFranco;
      add(strategies["🔫+🔄 Franco + Rebote P5 (Rebote override)"], actualQ === q);
    }
    // Franco + Doble override
    if (qFranco) {
      const q = qDobP5R5 ?? qFranco;
      add(strategies["🔫+💎 Franco + Doble P5R5 (Doble override)"], actualQ === q);
    }
    // Dios OR Doble (solo apuesta si alguno dispara)
    {
      const q = qDios ?? qDobP5R5;
      if (q) add(strategies["⚡+💎 Dios OR Doble P5R5 (cualquiera)"], actualQ === q);
    }
    // MEGA: prioridad Dios > Doble > Rebote > Franco
    if (qFranco) {
      const q = qDios ?? qDobP5R5 ?? qRebP5 ?? qFranco;
      add(strategies["🧠 MEGA: Dios > Doble > Rebote > Franco"], actualQ === q);
    }
    // SELECTIVO: solo cuando Dios o Doble disparan
    {
      const q = qDios ?? qDobP5R5;
      if (q) add(strategies["🎯 SELECTIVO: Solo Dios OR Doble P5R5"], actualQ === q);
    }
  }

  // ─── RESULTADOS ───
  console.log("═".repeat(100));
  console.log("🏆 RESULTADOS DE TODOS LOS MOTORES — Walk-Forward Real");
  console.log("═".repeat(100));
  console.log(`Break-even: ${BE.toFixed(1)}% (necesitas acertar ${BE.toFixed(1)} de cada 100 para no perder)`);
  console.log(`Apuesta: $${COST}/sorteo · Premio: $${PREMIO}\n`);
  console.log(`${"Motor".padEnd(52)} ${"Apuestas".padStart(8)} ${"Wins".padStart(6)} ${"WR%".padStart(7)} ${"P&L".padStart(14)} ${"ROI%".padStart(8)} ${"vs BE".padStart(7)}`);
  console.log("─".repeat(100));

  const entries = Object.entries(strategies)
    .filter(([, s]) => s.bets > 0)
    .sort(([, a], [, b]) => {
      const wrA = a.wins / a.bets;
      const wrB = b.wins / b.bets;
      return wrB - wrA;
    });

  for (const [name, s] of entries) {
    const wr = (s.wins / s.bets * 100);
    const pl = s.collected - s.invested;
    const roi = (pl / s.invested * 100);
    const vsBE = wr - BE;
    const icon = vsBE > 0 ? "✅" : "❌";
    console.log(
      `${icon} ${name.padEnd(50)} ${String(s.bets).padStart(8)} ${String(s.wins).padStart(6)} ${wr.toFixed(1).padStart(6)}% ${(pl >= 0 ? "+" : "") + "$" + pl.toLocaleString()}`.padEnd(90) +
      ` ${(roi >= 0 ? "+" : "") + roi.toFixed(1)}%`.padStart(8) +
      ` ${(vsBE >= 0 ? "+" : "") + vsBE.toFixed(1)}%`.padStart(7)
    );
  }

  console.log("\n" + "═".repeat(100));
  const winners = entries.filter(([, s]) => (s.wins / s.bets * 100) > BE);
  if (winners.length > 0) {
    console.log(`✅ ${winners.length} MOTOR(ES) SUPERAN EL BREAK-EVEN:`);
    for (const [name, s] of winners) {
      const wr = (s.wins / s.bets * 100);
      const pl = s.collected - s.invested;
      console.log(`   🏆 ${name}: ${wr.toFixed(1)}% WR · +$${pl.toLocaleString()} · ${s.bets} apuestas`);
    }
  } else {
    console.log("🔴 Ningún motor supera el break-even en walk-forward");
  }
  console.log("═".repeat(100));
}

run().catch(console.error);
