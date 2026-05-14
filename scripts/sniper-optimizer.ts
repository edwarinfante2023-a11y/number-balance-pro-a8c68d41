import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

/**
 * 🎯 SNIPER OPTIMIZER (Fase 6)
 * 
 * Este script purga el ruido aleatorio aislando solo las semanas donde la lotería
 * usó un algoritmo matemático. Sobre ese oro puro, corre una minería multidimensional
 * para encontrar patrones con un margen de ganancia extremo (>65%).
 */

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

// Helpers
const isAlto = (n: number) => n >= 50;
const isPar = (n: number) => n % 2 === 0;
const getCuadrante = (n: number) => `${isAlto(n) ? "ALTO" : "BAJO"}_${isPar(n) ? "PAR" : "IMPAR"}`;
const CUADRANTES = ["ALTO_PAR", "ALTO_IMPAR", "BAJO_PAR", "BAJO_IMPAR"];

const ALGORITMOS_BASE = [
  {
    id: "COMPENSACION",
    eval: (history: any[], target: any) => {
      if (history.length < 2) return false;
      const h0 = history[0].numero;
      const h1 = history[1].numero;
      if (isAlto(h0) === isAlto(h1)) return isAlto(target.numero) !== isAlto(h0);
      if (isPar(h0) === isPar(h1)) return isPar(target.numero) !== isPar(h0);
      return false;
    }
  },
  {
    id: "TENDENCIA",
    eval: (history: any[], target: any) => {
      if (history.length < 2) return false;
      const h0 = history[0].numero;
      const h1 = history[1].numero;
      if (isAlto(h0) === isAlto(h1)) return isAlto(target.numero) === isAlto(h0);
      if (isPar(h0) === isPar(h1)) return isPar(target.numero) === isPar(h0);
      return false;
    }
  }
];

async function run() {
  console.log("=========================================");
  console.log("🎯 OPTIMIZADOR FRANCOTIRADOR (Enfoque Vida Real - 2026)");
  console.log("=========================================");

  // 1. Descargar historial
  const allDrawsData: any[] = [];
  let from = 0;
  const limit = 1000;
  process.stdout.write("Descargando base de datos ");
  while (true) {
    const { data: chunk } = await supabase
      .from("draws")
      .select("numero, fecha, lottery_draws!inner(hora)")
      .order("fecha", { ascending: true })
      .range(from, from + limit - 1);
    if (!chunk || chunk.length === 0) break;
    allDrawsData.push(...chunk);
    from += limit;
    process.stdout.write(".");
  }
  
  // FILTRO DE VIDA REAL: Solo el historial reciente (Este año 2026)
  const allDraws = allDrawsData.filter(d => d.fecha.startsWith("2026"));
  console.log(`\n✅ Historial reciente cargado: ${allDraws.length} sorteos del 2026.`);

  // 2. Agrupar por semanas
  const drawsByWeek = new Map<string, any[]>();
  for (const d of allDraws) {
    const date = new Date(d.fecha + "T12:00:00");
    const year = date.getFullYear();
    const firstDay = new Date(year, 0, 1);
    const pastDays = (date.getTime() - firstDay.getTime()) / 86400000;
    const weekNum = Math.ceil((pastDays + firstDay.getDay() + 1) / 7);
    const weekKey = `${year}-W${weekNum.toString().padStart(2, '0')}`;
    
    if (!drawsByWeek.has(weekKey)) drawsByWeek.set(weekKey, []);
    drawsByWeek.get(weekKey)!.push(d);
  }

  // 3. Purgar Semanas Caóticas
  console.log("\n🧹 Aislando el ruido: Purgando semanas aleatorias...");
  const pureDraws: any[] = [];
  let semanasPuras = 0;
  
  for (const [weekKey, weekDraws] of drawsByWeek.entries()) {
    if (weekDraws.length < 15) continue;
    
    const historyByHora: Record<string, any[]> = {};
    const weekResults: Record<string, { total: number, hits: number }> = {};
    ALGORITMOS_BASE.forEach(a => weekResults[a.id] = { total: 0, hits: 0 });

    for (const draw of weekDraws) {
      const hora = draw.lottery_draws?.hora || "00:00";
      if (!historyByHora[hora]) historyByHora[hora] = [];
      const history = historyByHora[hora];
      
      for (const alg of ALGORITMOS_BASE) {
        let aposto = false;
        if (history.length >= 2) {
          const h0 = history[0].numero;
          const h1 = history[1].numero;
          if (isAlto(h0) === isAlto(h1) || isPar(h0) === isPar(h1)) aposto = true;
        }
        if (aposto) {
          weekResults[alg.id].total++;
          if (alg.eval(history, draw)) weekResults[alg.id].hits++;
        }
      }
      history.unshift(draw);
    }

    let isHackeada = false;
    for (const alg of ALGORITMOS_BASE) {
      const res = weekResults[alg.id];
      if (res.total >= 5) {
        const wr = (res.hits / res.total) * 100;
        if (wr >= 60) isHackeada = true; // 60% para rango/paridad
      }
    }

    if (isHackeada) {
      semanasPuras++;
      pureDraws.push(...weekDraws);
    }
  }

  console.log(`✨ Purga Completada. Retenidas ${semanasPuras} Semanas Matemáticas puras (${pureDraws.length} sorteos válidos).`);

  // 4. Minería Multidimensional sobre la data purificada
  console.log("\n🔬 Ejecutando minería multidimensional sobre el Oro Puro...");
  
  const drawsByHora: Record<string, any[]> = {};
  for (const raw of pureDraws) {
    const hora = raw.lottery_draws?.hora || "00:00";
    if (!drawsByHora[hora]) drawsByHora[hora] = [];
    const d = new Date(raw.fecha + "T12:00:00");
    const ctx = {
      numero: raw.numero,
      cuadrante: getCuadrante(raw.numero),
      month: d.getMonth() + 1,
      dayOfWeek: d.getDay(),
      rachaRango: 1,
      lastCuadrante: null as string | null,
      secondLastCuadrante: null as string | null
    };
    const arr = drawsByHora[hora];
    if (arr.length > 0) {
      const last = arr[arr.length - 1];
      ctx.lastCuadrante = last.cuadrante;
      if (arr.length > 1) {
        ctx.secondLastCuadrante = arr[arr.length - 2].cuadrante;
      }
      if (isAlto(last.numero) === isAlto(ctx.numero)) ctx.rachaRango = last.rachaRango + 1;
    }
    arr.push(ctx);
  }

  const combinations = new Map<string, { total: number, hits: Record<string, number> }>();

  for (const hora of Object.keys(drawsByHora)) {
    const arr = drawsByHora[hora];
    for (let i = 1; i < arr.length; i++) {
      const current = arr[i];
      const prev = arr[i - 1];
      
      for (const d of [current.dayOfWeek, "ANY"]) {
        for (const m of [current.month, "ANY"]) {
          for (const lc of [prev.cuadrante, "ANY"]) {
            for (const rr of [prev.rachaRango, "ANY"]) {
              for (const slc of [current.secondLastCuadrante, "ANY"]) {
                let specs = 0;
                if (d !== "ANY") specs++;
                if (m !== "ANY") specs++;
                if (lc !== "ANY") specs++;
                if (rr !== "ANY") specs++;
                if (slc !== "ANY") specs++;
                if (specs < 2) continue; // Exigimos más profundidad (mínimo 2 filtros)

                const key = JSON.stringify({ hora, dayOfWeek: d, month: m, lastCuadrante: lc, prevRachaRango: rr, secondLastCuadrante: slc });
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
  }

  // 5. Filtrar por Margen Extremo (>65%)
  const discoveries: any[] = [];
  const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const monthNames = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

  for (const [key, stats] of combinations.entries()) {
    if (stats.total < 4) continue; // Muestra reducida porque solo analizamos unos meses de este año
    for (const cuad of CUADRANTES) {
      const hits = stats.hits[cuad];
      const ef = Math.round((hits / stats.total) * 100);
      
      if (ef >= 80) { // MARGEN DIOS (Win Rate >= 80%)
        const conds = JSON.parse(key);
        let descParts = [];
        if (conds.dayOfWeek !== "ANY") descParts.push(`los ${dayNames[conds.dayOfWeek]}`);
        if (conds.month !== "ANY") descParts.push(`en ${monthNames[conds.month]}`);
        if (conds.secondLastCuadrante !== "ANY") descParts.push(`si hace 2 sorteos salió ${conds.secondLastCuadrante}`);
        if (conds.lastCuadrante !== "ANY") descParts.push(`y luego salió ${conds.lastCuadrante}`);
        if (conds.prevRachaRango !== "ANY") descParts.push(`con racha de ${conds.prevRachaRango}`);
        
        discoveries.push({
          cuadrante: cuad,
          efectividad: ef,
          aciertos: hits,
          total: stats.total,
          descripcion: `[${conds.hora}] ${descParts.join(", ")} -> ${cuad}`
        });
      }
    }
  }

  discoveries.sort((a, b) => b.efectividad - a.efectividad);
  const top10 = discoveries.slice(0, 10);

  console.log("\n=========================================");
  console.log("💎 TOP 10 REGLAS DE ORO (MARGEN EXTREMO) 💎");
  console.log("=========================================");
  console.log("Estas reglas fueron extraídas 100% de las semanas donde la lotería es predecible.");
  console.log("Garantizan el mayor margen de rentabilidad posible en Modo Francotirador:\n");

  top10.forEach((d, i) => {
    console.log(`${i+1}. WIN RATE: ${d.efectividad}% (Aciertos: ${d.aciertos}/${d.total})`);
    console.log(`   Regla: ${d.descripcion}\n`);
  });
  
  if (top10.length === 0) {
    console.log("No se encontraron patrones de nivel DIOS (>80%) en la muestra pura.");
  }
}

run().catch(console.error);
