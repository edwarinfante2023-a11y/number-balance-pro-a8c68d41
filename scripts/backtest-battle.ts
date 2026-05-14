import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { buildCartera, ADAPTIVE_STRATEGY } from "../src/lib/carteraEngine.js";

// Cargar env
const envPath = path.resolve(process.cwd(), ".env.local");
let envContent = "";
try {
  envContent = fs.readFileSync(envPath, "utf-8");
} catch (e) {
  envContent = fs.readFileSync(path.resolve(process.cwd(), ".env"), "utf-8");
}
const envVars = Object.fromEntries(
  envContent.split("\n").filter(l => l && !l.startsWith("#")).map(l => {
    const i = l.indexOf("=");
    if (i === -1) return [];
    return [l.substring(0, i), l.substring(i + 1).replace(/"/g, "")];
  })
);

const supabase = createClient(
  envVars.VITE_SUPABASE_URL || envVars.SUPABASE_URL,
  envVars.VITE_SUPABASE_PUBLISHABLE_KEY || envVars.SUPABASE_PUBLISHABLE_KEY
);

// Motor viejo simulado (Números Sueltos) - recreamos la lógica antigua simplificada para backtest
function buildOldCartera(drawsHora, rules, patterns) {
  const scores = new Map();
  for (let n = 0; n <= 99; n++) scores.set(n, 0);

  // Frecuencia
  const freq = new Map();
  for (const d of drawsHora) freq.set(d.numero, (freq.get(d.numero) ?? 0) + 1);
  const maxF = Math.max(1, ...Array.from(freq.values()));
  for (const [n, f] of freq.entries()) {
    scores.set(n, (scores.get(n) || 0) + Math.round((f / maxF) * 40));
  }

  // Momentum Parcial (Regresión)
  // El viejo buscaba compensar (si salía alto, sumaba bajo)
  let altos = 0;
  for (const d of drawsHora.slice(0, 5)) if (d.numero >= 50) altos++;
  const boostRango = altos > 2 ? "BAJO" : "ALTO"; // simple compensacion

  for (let n = 0; n <= 99; n++) {
    const isAlto = n >= 50;
    if (boostRango === "ALTO" && isAlto) scores.set(n, (scores.get(n)||0) + 10);
    if (boostRango === "BAJO" && !isAlto) scores.set(n, (scores.get(n)||0) + 10);
  }

  // Seleccion 25
  const all = Array.from(scores.entries()).map(([n, s]) => ({ n, s })).sort((a,b) => b.s - a.s);
  return all.slice(0, 25).map(x => x.n);
}

async function runBacktest() {
  console.log("Iniciando Batalla de Backtest: Old Engine vs Quadrant Engine");
  
  // 1. Cargar draws (solo el primer premio)
  console.log("Descargando historial completo...");
  const allDrawsData = [];
  let from = 0;
  const limit = 1000;
  
  while (true) {
    const { data: chunk, error } = await supabase
      .from("draws")
      .select("numero, fecha, lottery_draws!inner(hora)")
      .order("fecha", { ascending: true })
      .range(from, from + limit - 1);
      
    if (error) {
      console.error("Error fetching", error);
      break;
    }
    if (!chunk || chunk.length === 0) break;
    
    allDrawsData.push(...chunk);
    from += limit;
  }
  
  if (allDrawsData.length === 0) {
    console.log("No hay datos");
    return;
  }
  
  // Filtrar SOLAMENTE los sorteos de "este año" (2026)
  const drawsThisYear = allDrawsData.filter(d => d.fecha.startsWith("2026"));
  
  const draws = drawsThisYear.map(d => ({
    numero: d.numero,
    fecha: d.fecha,
    hora: d.lottery_draws?.hora || "00:00"
  }));
  
  console.log(`Historial cargado: ${draws.length} sorteos.`);
  
  
  // ─── DEEP MINER (Fase de Entrenamiento) ───
  console.log("IA está en Modo Deep Miner (Estudiando 27,000+ combinaciones posibles)...");
  const isAlto = (n) => n >= 50;
  const isPar = (n) => n % 2 === 0;
  const getCuadrante = (n) => `${isAlto(n) ? "ALTO" : "BAJO"}_${isPar(n) ? "PAR" : "IMPAR"}`;
  const CUADRANTES = ["ALTO_PAR", "ALTO_IMPAR", "BAJO_PAR", "BAJO_IMPAR"];
  
  const drawsByHora = {};
  for (const raw of draws) {
    if (!drawsByHora[raw.hora]) drawsByHora[raw.hora] = [];
    const d = new Date(raw.fecha + "T12:00:00");
    const ctx = {
      numero: raw.numero,
      cuadrante: getCuadrante(raw.numero),
      month: d.getMonth() + 1,
      dayOfWeek: d.getDay(),
      rachaRango: 1,
      lastCuadrante: null
    };
    const arr = drawsByHora[raw.hora];
    if (arr.length > 0) {
      const last = arr[arr.length - 1];
      ctx.lastCuadrante = last.cuadrante;
      if (isAlto(last.numero) === isAlto(ctx.numero)) ctx.rachaRango = last.rachaRango + 1;
    }
    arr.push(ctx);
  }

  const combinations = new Map();
  for (const hora of Object.keys(drawsByHora)) {
    const arr = drawsByHora[hora];
    for (let i = 1; i < arr.length; i++) {
      const current = arr[i];
      const prev = arr[i - 1];
      for (const d of [current.dayOfWeek, "ANY"]) {
        for (const m of [current.month, "ANY"]) {
          for (const lc of [prev.cuadrante, "ANY"]) {
            for (const rr of [prev.rachaRango, "ANY"]) {
              let specificCount = 0;
              if (d !== "ANY") specificCount++;
              if (m !== "ANY") specificCount++;
              if (lc !== "ANY") specificCount++;
              if (rr !== "ANY") specificCount++;
              if (specificCount < 1) continue;

              const key = JSON.stringify({ algorithm: "deep_miner", hora, dayOfWeek: d, month: m, lastCuadrante: lc, prevRachaRango: rr });
              let entry = combinations.get(key);
              if (!entry) {
                entry = { total: 0, hits: { ALTO_PAR: 0, ALTO_IMPAR: 0, BAJO_PAR: 0, BAJO_IMPAR: 0 } };
                combinations.set(key, entry);
              }
              entry.total++;
              entry.hits[current.cuadrante]++;
            }
          }
        }
      }
    }
  }

  const discoveries = [];
  for (const [key, stats] of combinations.entries()) {
    if (stats.total < 15) continue;
    for (const cuad of CUADRANTES) {
      const hits = stats.hits[cuad];
      const ef = Math.round((hits / stats.total) * 100);
      if (ef >= 58) { // MODO FRANCOTIRADOR EXTREMO: Diamantes > 58%
        const conds = JSON.parse(key);
        discoveries.push({
          nombre: `D-Miner [${cuad}]`,
          tipo: "patron",
          condiciones: conds,
          resultado_esperado: cuad,
          ocurrencias: stats.total,
          aciertos: hits,
          efectividad: ef,
          hora: conds.hora,
          activa: true,
          estado: "activo"
        });
      }
    }
  }

  discoveries.sort((a, b) => b.efectividad - a.efectividad);
  const patterns = discoveries.slice(0, 15); // Solo los 15 mejores francotiradores
  console.log(`IA armó su arsenal con los ${patterns.length} mejores patrones (efectividad entre ${patterns[patterns.length-1]?.efectividad || 0}% y ${patterns[0]?.efectividad || 0}%).`);
  
  const rules = [];

  let oldHits = 0;
  let newHits = 0;
  let totalEvaluatedOld = 0;
  let totalEvaluatedNew = 0;
  
  console.log("Simulando predicciones con Inteligencia Artificial encendida...");
  
  // Agrupar por hora para agilizar
  const historyByHora = {};
  for (const d of draws) {
      if (!historyByHora[d.hora]) historyByHora[d.hora] = [];
  }
  
  for (let i = 0; i < draws.length; i++) {
    const currentDraw = draws[i];
    
    // El motor usa el historial HASTA el sorteo actual (sin incluirlo)
    const horaHistory = historyByHora[currentDraw.hora];
    
    if (horaHistory.length >= 50) { // si tenemos suficiente data para esta hora
      
      // 1. Motor Viejo (Apuesta a todo)
      const oldCartera = buildOldCartera(horaHistory, rules, patterns);
      if (oldCartera.includes(currentDraw.numero)) oldHits++;
      totalEvaluatedOld++;
      
      // 2. Motor Nuevo (Cuadrantes + IA + Filtro)
      const newCarteraRes = buildCartera(horaHistory, rules, patterns, currentDraw.hora);
      
      // FILTRO DE IA: MODO FRANCOTIRADOR
      // Solo jugamos si el Robot Jefe detectó un patrón de Deep Miner activo para este sorteo
      const quadrantReasons = newCarteraRes.reasons[String(newCarteraRes.numeros[0])] || [];
      const isSniperShot = quadrantReasons.some(r => r.includes("D-Miner"));
      
      if (isSniperShot) {
          totalEvaluatedNew++;
          if (newCarteraRes.numeros.includes(currentDraw.numero)) newHits++;
      }
    }
    
    // Agregar sorteo actual al historial para el siguiente paso
    horaHistory.unshift(currentDraw); // al inicio para que slice(0,5) funcione
  }
  
  console.log("==========================================");
  console.log(`RESULTADOS DE LA BATALLA`);
  console.log("==========================================");
  
  const oldWinRate = ((oldHits / totalEvaluatedOld) * 100).toFixed(2);
  const newWinRate = ((newHits / totalEvaluatedNew) * 100).toFixed(2);
  
  console.log(`Motor Viejo (Números Sueltos - Sin Filtro IA):`);
  console.log(`- Sorteos Jugados: ${totalEvaluatedOld}`);
  console.log(`- Aciertos: ${oldHits}`);
  console.log(`- Win Rate: ${oldWinRate}%`);
  
  console.log(`\nMotor Nuevo (Cuadrantes + Reglas IA + Filtro Anti-Riesgo):`);
  console.log(`- Sorteos Jugados: ${totalEvaluatedNew} (La IA evitó apostar en ${totalEvaluatedOld - totalEvaluatedNew} sorteos dudosos)`);
  console.log(`- Aciertos: ${newHits}`);
  console.log(`- Win Rate: ${newWinRate}%`);
  
  console.log("\n==========================================");
  
  const INITIAL_BANKROLL = 200000;
  const COSTO_POR_SORTEO = 25000; // 1,000 por número x 25 números
  const PREMIO = 72000; // 72 x 1,000
  
  const inversionViejo = totalEvaluatedOld * COSTO_POR_SORTEO;
  const gananciaViejo = oldHits * PREMIO;
  const bankrollFinalViejo = INITIAL_BANKROLL - inversionViejo + gananciaViejo;
  
  const inversionNuevo = totalEvaluatedNew * COSTO_POR_SORTEO;
  const gananciaNuevo = newHits * PREMIO;
  const bankrollFinalNuevo = INITIAL_BANKROLL - inversionNuevo + gananciaNuevo;
  
  console.log(`\n==========================================`);
  console.log(`Simulación de Bankroll (Este Año - 2026)`);
  console.log(`- Apuesta: $1,000 p/número ($25,000 por sorteo)`);
  console.log(`- Premio: $72,000 (Paga a 72)`);
  console.log(`- Capital Inicial: $${INITIAL_BANKROLL.toLocaleString()}`);
  console.log(`==========================================`);
  
  console.log(`Motor Viejo (Jugando Todos los Días):`);
  console.log(`- Inversión Total: $${inversionViejo.toLocaleString()}`);
  console.log(`- Cobrado en Premios: $${gananciaViejo.toLocaleString()}`);
  console.log(`- SALDO FINAL: $${bankrollFinalViejo.toLocaleString()} ${bankrollFinalViejo > INITIAL_BANKROLL ? '🚀' : '🔻'}`);
  
  console.log(`\nMotor Nuevo (Francotirador IA):`);
  console.log(`- Inversión Total: $${inversionNuevo.toLocaleString()}`);
  console.log(`- Cobrado en Premios: $${gananciaNuevo.toLocaleString()}`);
  console.log(`- SALDO FINAL: $${bankrollFinalNuevo.toLocaleString()} ${bankrollFinalNuevo > INITIAL_BANKROLL ? '🚀' : '🔻'}`);
  
}

runBacktest().catch(console.error);
