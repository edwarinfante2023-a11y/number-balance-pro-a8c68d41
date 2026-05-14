import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

/**
 * 🧠 CEREBRO HÍBRIDO (Markov + Clustering - Fase 11)
 * 
 * Este script agrupa los sorteos en Zonas de Comportamiento (Clusters) 
 * y calcula Matrices de Transición Probabilística (Cadenas de Markov) en tiempo real
 * para predecir el flujo del dinero y ejecutar disparos de alta rentabilidad.
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

const isAlto = (n: number) => n >= 50;
const isPar = (n: number) => n % 2 === 0;
const getCuad = (n: number) => `${isAlto(n) ? "ALTO" : "BAJO"}_${isPar(n) ? "PAR" : "IMPAR"}`;
const CUADRANTES = ["ALTO_PAR", "ALTO_IMPAR", "BAJO_PAR", "BAJO_IMPAR"];

function getCluster(horaStr: string): string {
  const hora = parseInt(horaStr.split(":")[0]);
  if (hora < 13) return "APERTURA"; // Mañana
  if (hora < 18) return "VALLE";    // Tarde
  return "CIERRE";                  // Noche
}

async function runHybridBrain() {
  console.log("=========================================");
  console.log("🧠 CEREBRO HÍBRIDO (Markov + Clustering)");
  console.log("=========================================");
  console.log("Modo de Ejecución: Vida Real (Solo Data 2026)");

  // 1. Descargar historial de 2026
  const allDrawsData: any[] = [];
  let from = 0;
  const limit = 1000;
  process.stdout.write("[SYS] Sincronizando datos ");
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
  
  const draws2026 = allDrawsData.filter(d => d.fecha.startsWith("2026"));
  console.log(`\n[SYS] Dataset cargado: ${draws2026.length} sorteos reales de 2026.\n`);

  // 2. SIMULACIÓN EN TIEMPO REAL CON MEMORIA DESLIZANTE
  let jugadasFrancotirador = 0;
  let aciertosFrancotirador = 0;

  // Matrices de Markov para visualizar la estructura del PRNG
  const markovMatrix: Record<string, Record<string, Record<string, number>>> = {
    APERTURA: {}, VALLE: {}, CIERRE: {}
  };
  for (const c of ["APERTURA", "VALLE", "CIERRE"]) {
    for (const fromC of CUADRANTES) {
      markovMatrix[c][fromC] = { "ALTO_PAR": 0, "ALTO_IMPAR": 0, "BAJO_PAR": 0, "BAJO_IMPAR": 0 };
    }
  }

  const memoryWindow: any[] = [];
  const WINDOW_SIZE = 150; // Memoria de las últimas 2 semanas para calcular Markov

  for (const currentDraw of draws2026) {
    if (memoryWindow.length === WINDOW_SIZE) {
      // Calcular Matrices de Markov con la memoria reciente
      const currentMatrix = JSON.parse(JSON.stringify(markovMatrix)); // Clon profundo rápido
      
      for (let i = 1; i < memoryWindow.length; i++) {
        const prev = memoryWindow[i - 1];
        const curr = memoryWindow[i];
        const prevCuad = getCuad(prev.numero);
        const currCuad = getCuad(curr.numero);
        const cluster = getCluster(curr.lottery_draws?.hora || "00:00");
        currentMatrix[cluster][prevCuad][currCuad]++;
      }

      // Evaluar la probabilidad de transición para el SORTEO ACTUAL
      const lastDrawInMemory = memoryWindow[memoryWindow.length - 1];
      const prevCuad = getCuad(lastDrawInMemory.numero);
      const currentCluster = getCluster(currentDraw.lottery_draws?.hora || "00:00");
      
      const transRow = currentMatrix[currentCluster][prevCuad];
      let totalTrans = 0;
      for (const cuad of CUADRANTES) totalTrans += transRow[cuad];

      if (totalTrans >= 3) { // Asegurar que hay datos de transición
        let bestTarget = "";
        let bestProb = 0;
        
        for (const cuad of CUADRANTES) {
          const prob = (transRow[cuad] / totalTrans) * 100;
          if (prob > bestProb) {
            bestProb = prob;
            bestTarget = cuad;
          }
        }

        // LÓGICA DE FUSIÓN (El Francotirador)
        // Solo disparar si la Cadena de Markov supera el 50% de probabilidad real 
        // (El doble del azar puro)
        if (bestProb >= 50) {
          jugadasFrancotirador++;
          if (getCuad(currentDraw.numero) === bestTarget) aciertosFrancotirador++;
        }
      }

      memoryWindow.shift(); // Eliminar el más antiguo (Mantiene el Rolling Window)
    }
    
    memoryWindow.push(currentDraw);
  }

  // REPORTE FINANCIERO DE LA VIDA REAL (2026)
  const winRateHibrido = jugadasFrancotirador > 0 ? (aciertosFrancotirador / jugadasFrancotirador) * 100 : 0;
  
  const INITIAL_BANKROLL = 200000;
  const COSTO_POR_SORTEO = 25000;
  const PREMIO = 72000;

  const inversion = jugadasFrancotirador * COSTO_POR_SORTEO;
  const ganancia = aciertosFrancotirador * PREMIO;
  const saldoFinal = INITIAL_BANKROLL - inversion + ganancia;

  console.log("=========================================");
  console.log("📈 RESULTADOS EN VIDA REAL (AÑO 2026)");
  console.log("=========================================");
  console.log(`Estrategia: Cerebro Híbrido (Clústers + Markov + Francotirador)`);
  console.log(`Disparos Realizados: ${jugadasFrancotirador} de ${draws2026.length} posibles`);
  console.log(`Aciertos: ${aciertosFrancotirador}`);
  console.log(`🏆 WIN RATE SOSTENIDO: ${winRateHibrido.toFixed(2)}%`);
  
  console.log(`\n=========================================`);
  console.log(`💰 SIMULACIÓN FINANCIERA DEL NEGOCIO (2026)`);
  console.log(`=========================================`);
  console.log(`Inversión Total Acumulada: $${inversion.toLocaleString()}`);
  console.log(`Ingresos por Premios: $${ganancia.toLocaleString()}`);
  
  if (saldoFinal > INITIAL_BANKROLL) {
    console.log(`SALDO FINAL DE CUENTA: $${saldoFinal.toLocaleString()} 🚀`);
    console.log(`\n💡 CONCLUSIÓN:`);
    console.log(`El Cerebro Híbrido es letal y realista. Al rastrear las probabilidades de `);
    console.log(`transición en tiempo real según la hora del día, logra esquivar el ruido`);
    console.log(`y generar beneficios sostenidos en la lotería actual de 2026.`);
  } else {
    console.log(`SALDO FINAL DE CUENTA: $${saldoFinal.toLocaleString()} 🔻`);
    console.log(`\n💡 CONCLUSIÓN:`);
    console.log(`La matriz de Markov no logró superar el ruido caótico del año 2026.`);
  }
}

runHybridBrain().catch(console.error);
