import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

/**
 * 🤖 DYNAMIC ROLLING BACKTEST (El Cazador de Tendencias)
 * 
 * Este backtest simula a un Trader algorítmico real. 
 * NO hace trampa viendo el futuro (cero data leakage).
 * Para cada sorteo, solo mira el pasado inmediato (ventana de 40 sorteos).
 * Detecta qué algoritmo está "caliente" en ese momento exacto, 
 * y lo usa para predecir el siguiente sorteo.
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

async function run() {
  console.log("Descargando historial...");
  const allDraws: any[] = [];
  let from = 0;
  const limit = 1000;
  while (true) {
    const { data: chunk } = await supabase
      .from("draws")
      .select("numero, fecha, lottery_draws!inner(hora)")
      .order("fecha", { ascending: true })
      .range(from, from + limit - 1);
    if (!chunk || chunk.length === 0) break;
    allDraws.push(...chunk);
    from += limit;
  }
  
  console.log(`Historial cargado: ${allDraws.length} sorteos. Ejecutando IA Dinámica...`);

  let jugados = 0;
  let aciertos = 0;
  
  const historyByHora: Record<string, any[]> = {};

  for (let i = 0; i < allDraws.length; i++) {
    const current = allDraws[i];
    const hora = current.lottery_draws.hora;
    if (!historyByHora[hora]) historyByHora[hora] = [];
    
    const history = historyByHora[hora];
    
    // Necesitamos al menos 30 sorteos de ventana para tomar decisiones estadísticas
    if (history.length >= 30) {
      // Ventana de memoria a corto plazo (últimos 30 sorteos)
      // history[0] es el más viejo en esta lógica, history[length-1] es el más reciente
      const window = history.slice(-30); 
      
      // EVALUAR RANGO (ALTO/BAJO) EN LA VENTANA
      let reboteRangoHits = 0;
      let tendenciaRangoHits = 0;
      let evalRangoTotal = 0;
      
      for (let j = 2; j < window.length; j++) {
        if (isAlto(window[j-2].numero) === isAlto(window[j-1].numero)) {
          evalRangoTotal++;
          if (isAlto(window[j].numero) !== isAlto(window[j-1].numero)) reboteRangoHits++;
          if (isAlto(window[j].numero) === isAlto(window[j-1].numero)) tendenciaRangoHits++;
        }
      }
      
      // EVALUAR PARIDAD EN LA VENTANA
      let reboteParidadHits = 0;
      let tendenciaParidadHits = 0;
      let evalParidadTotal = 0;
      
      for (let j = 2; j < window.length; j++) {
        if (isPar(window[j-2].numero) === isPar(window[j-1].numero)) {
          evalParidadTotal++;
          if (isPar(window[j].numero) !== isPar(window[j-1].numero)) reboteParidadHits++;
          if (isPar(window[j].numero) === isPar(window[j-1].numero)) tendenciaParidadHits++;
        }
      }

      // PREDECIR EL FUTURO USANDO EL ALGORITMO DOMINANTE ACTUAL
      // Las pruebas son de 50/50. Necesitamos que un algoritmo domine con > 65% en la ventana para confiar.
      const UMBRAL_CONFIANZA = 0.60;
      
      let predictedRango = null;
      let predictedParidad = null;
      
      // Solo predecimos si acaba de ocurrir la condición (ej. salieron 2 altos seguidos ayer)
      const last1 = window[window.length-1];
      const last2 = window[window.length-2];
      
      if (isAlto(last1.numero) === isAlto(last2.numero) && evalRangoTotal > 5) {
        if (reboteRangoHits / evalRangoTotal >= UMBRAL_CONFIANZA) predictedRango = !isAlto(last1.numero); // Invertir
        else if (tendenciaRangoHits / evalRangoTotal >= UMBRAL_CONFIANZA) predictedRango = isAlto(last1.numero); // Mantener
      }
      
      if (isPar(last1.numero) === isPar(last2.numero) && evalParidadTotal > 5) {
        if (reboteParidadHits / evalParidadTotal >= UMBRAL_CONFIANZA) predictedParidad = !isPar(last1.numero);
        else if (tendenciaParidadHits / evalParidadTotal >= UMBRAL_CONFIANZA) predictedParidad = isPar(last1.numero);
      }
      
      // FILTRO DE FRANCOTIRADOR DINÁMICO: 
      // Solo apostamos si la IA tiene confianza ABSOLUTA tanto en el Rango como en la Paridad
      if (predictedRango !== null && predictedParidad !== null) {
        jugados++;
        const predCuadrante = `${predictedRango ? "ALTO" : "BAJO"}_${predictedParidad ? "PAR" : "IMPAR"}`;
        const realCuadrante = getCuad(current.numero);
        if (predCuadrante === realCuadrante) aciertos++;
      }
    }
    
    // Avanzar el tiempo
    historyByHora[hora].push(current);
  }

  const winRate = ((aciertos / jugados) * 100).toFixed(2);
  const inversion = jugados * 25;
  const beneficio = (aciertos * 70) - inversion;

  console.log("\n==========================================");
  console.log("RESULTADOS: MOTOR DE TENDENCIAS DINÁMICAS (En Vivo)");
  console.log("==========================================");
  console.log(`- Sorteos Analizados en Total: ${allDraws.length}`);
  console.log(`- El Robot disparó (Jugó) en: ${jugados} sorteos`);
  console.log(`- Aciertos Logrados: ${aciertos}`);
  console.log(`- Win Rate Final: ${winRate}% (Rentabilidad Pura)`);
  console.log("\n💰 SIMULACIÓN DE BANKROLL:");
  console.log(`- Dinero Invertido: $${inversion.toLocaleString()}`);
  console.log(`- BENEFICIO NETO: $${beneficio.toLocaleString()} ${beneficio > 0 ? '🚀' : '🔻'}`);
  console.log("==========================================");
}

run().catch(console.error);
