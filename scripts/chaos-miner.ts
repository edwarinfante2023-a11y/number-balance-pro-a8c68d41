import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

/**
 * 🌪️ ESCÁNER ANTI-CAOS (Chaos Miner - Fase 8)
 * 
 * Este script aísla el "Modo Azar" de la lotería y lo ataca utilizando
 * la Ley de los Atrasos (Regresión a la Media).
 * Su objetivo es demostrar que el "caos" es matemáticamente falso y 
 * predecible cuando los algoritmos de la lotería se saturan.
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
const getCuad = (n: number) => `${isAlto(n) ? "ALTO" : "BAJO"}_${isPar(n) ? "PAR" : "IMPAR"}`;
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
  }
];

async function run() {
  console.log("=========================================");
  console.log("🌪️ INICIANDO ESCÁNER ANTI-CAOS (Fase 8)");
  console.log("=========================================");

  // 1. Descargar historial
  const allDraws: any[] = [];
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
    allDraws.push(...chunk);
    from += limit;
    process.stdout.write(".");
  }
  console.log(`\n✅ Historial cargado: ${allDraws.length} sorteos.`);

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

  // 3. Aislar el Caos Absoluto
  console.log("\n🧹 Separando Semanas Puras... Buscando el Caos Absoluto...");
  const chaosDraws: any[] = [];
  let semanasCaoticas = 0;
  
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
          if (isAlto(history[0].numero) === isAlto(history[1].numero) || isPar(history[0].numero) === isPar(history[1].numero)) {
            aposto = true;
          }
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
        if (wr >= 60) isHackeada = true; 
      }
    }

    // SI NO FUE HACKEADA, ES UNA SEMANA DE CAOS/AZAR
    if (!isHackeada) {
      semanasCaoticas++;
      chaosDraws.push(...weekDraws);
    }
  }

  console.log(`✨ Aislamiento Completado. Encontradas ${semanasCaoticas} Semanas CAÓTICAS (${chaosDraws.length} sorteos de "puro azar").`);

  // 4. ALGORITMOS ANTI-CAOS (REGRESIÓN Y SATURACIÓN)
  console.log("\n🔬 Lanzando Algoritmos de Saturación contra la data caótica...");

  let jugadasRegresion = 0;
  let aciertosRegresion = 0;
  
  let jugadasSaturacion = 0;
  let aciertosSaturacion = 0;

  // Para simular la "Memoria Continua", no agrupamos por hora en el caos, vemos el flujo global
  const memoryStream: any[] = [];

  // Mapeamos el "Caos" cronológicamente
  const chaosSorted = chaosDraws.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

  for (const draw of chaosSorted) {
    if (memoryStream.length >= 25) { // Ventana de 25 sorteos para medir atrasos
      const recent = memoryStream.slice(-25);
      
      // -----------------------------------------------------
      // ALGORITMO 1: Frecuencia Directa (Surfeando la Ola)
      // Buscar el cuadrante MÁS CALIENTE asumiendo que la lotería está "pegada"
      // -----------------------------------------------------
      const frecs: Record<string, number> = { "ALTO_PAR": 0, "ALTO_IMPAR": 0, "BAJO_PAR": 0, "BAJO_IMPAR": 0 };
      recent.forEach(r => frecs[getCuad(r.numero)]++);
      
      // Encontrar el cuadrante con la MAYOR frecuencia
      let maxCuad = "ALTO_PAR";
      let maxVal = 0;
      for (const cuad of CUADRANTES) {
        if (frecs[cuad] > maxVal) {
          maxVal = frecs[cuad];
          maxCuad = cuad;
        }
      }

      // Si el cuadrante está EN LLAMAS (Salió 10 veces o más en 25 sorteos)
      if (maxVal >= 10) {
        jugadasRegresion++;
        if (getCuad(draw.numero) === maxCuad) aciertosRegresion++;
      }

      // -----------------------------------------------------
      // ALGORITMO 2: Inercia de Anomalía (Ir con la Ola)
      // Si el Rango está desbalanceado > 75%, asumimos que seguirá pegado
      // -----------------------------------------------------
      const hyperRecent = memoryStream.slice(-15);
      let altos = 0;
      let pares = 0;
      hyperRecent.forEach(r => {
        if (isAlto(r.numero)) altos++;
        if (isPar(r.numero)) pares++;
      });

      let targetAlto = null;
      if (altos >= 11) targetAlto = true; // Muchos altos, surfeamos el ALTO
      else if (altos <= 4) targetAlto = false; // Muchos bajos, surfeamos el BAJO

      let targetPar = null;
      if (pares >= 11) targetPar = true; // Muchos pares, surfeamos el PAR
      else if (pares <= 4) targetPar = false; // Muchos impares, surfeamos el IMPAR

      // Disparo surfeando la ola caótica
      if (targetAlto !== null && targetPar !== null) {
        jugadasSaturacion++;
        const predCuad = `${targetAlto ? "ALTO" : "BAJO"}_${targetPar ? "PAR" : "IMPAR"}`;
        if (getCuad(draw.numero) === predCuad) aciertosSaturacion++;
      }
    }
    memoryStream.push(draw);
  }

  // 5. REPORTE FINAL DEL CAOS
  const wrRegresion = jugadasRegresion > 0 ? ((aciertosRegresion / jugadasRegresion) * 100).toFixed(2) : "0.00";
  const wrSaturacion = jugadasSaturacion > 0 ? ((aciertosSaturacion / jugadasSaturacion) * 100).toFixed(2) : "0.00";

  console.log("\n=========================================");
  console.log("💥 REPORTE DE HACKEO DE CAOS 💥");
  console.log("=========================================");
  
  console.log(`Algoritmo 1: Frecuencia Directa (Surfeando la Ola)`);
  console.log(`Disparó a cuadrantes en llamas: ${jugadasRegresion} veces`);
  console.log(`Aciertos surfeando: ${aciertosRegresion}`);
  console.log(`🏆 WIN RATE: ${wrRegresion}% \n`);

  console.log(`Algoritmo 2: Inercia de Anomalía Numérica`);
  console.log(`Disparó a favor del pico extremo: ${jugadasSaturacion} veces`);
  console.log(`Aciertos surfeando: ${aciertosSaturacion}`);
  console.log(`🏆 WIN RATE: ${wrSaturacion}% \n`);

  const breakEven = 35.7;
  if (parseFloat(wrRegresion) > breakEven || parseFloat(wrSaturacion) > breakEven) {
    console.log("💡 CONCLUSIÓN DEL CIENTÍFICO DE DATOS:");
    console.log("¡HAS DOMADO EL CAOS SURFEANDO LA OLA!");
    console.log("Los generadores se atascan en el mismo número para generar caos, ");
    console.log("y apostar a favor de la tendencia es matemáticamente rentable.");
  } else {
    console.log("💡 CONCLUSIÓN:");
    console.log("Ni siquiera surfeando la ola logramos vencer al PRNG durante las semanas");
    console.log("caóticas. La varianza es tan grande que la ola colapsa al momento de apostar.");
    console.log("El Modo Francotirador (Solo Semanas Puras) se reafirma como la ÚNICA VÍA.");
  }
}

run().catch(console.error);
