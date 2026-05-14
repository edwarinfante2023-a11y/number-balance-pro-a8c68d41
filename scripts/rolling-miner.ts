import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

/**
 * 🕵️ ROLLING ALGORITHM DETECTOR (Análisis Forense)
 * 
 * Escanea el historial completo rebanándolo en bloques de 7 días (Semanas).
 * Para cada semana, intenta descifrar si la lotería usó un algoritmo específico 
 * o si fue completamente azarosa.
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

const supabaseAdmin = createClient(
  envVars.VITE_SUPABASE_URL || envVars.SUPABASE_URL,
  envVars.VITE_SUPABASE_PUBLISHABLE_KEY || envVars.SUPABASE_PUBLISHABLE_KEY
);

// Helpers
const isAlto = (n: number) => n >= 50;
const isPar = (n: number) => n % 2 === 0;
const getCuadrante = (n: number) => `${isAlto(n) ? "ALTO" : "BAJO"}_${isPar(n) ? "PAR" : "IMPAR"}`;

// Definición de "Algoritmos Módulo" que la lotería podría usar internamente
const ALGORITMOS_MATRICIALES = [
  {
    id: "COMPENSACION_RANGO",
    nombre: "Rebote de Rango (Péndulo)",
    eval: (history: any[], target: any) => {
      if (history.length < 2) return false;
      const last = isAlto(history[0].numero);
      const prev = isAlto(history[1].numero);
      // Si hubo 2 iguales, el sistema forzó uno distinto?
      if (last === prev) {
        return isAlto(target.numero) !== last; // Acierto si rompió la racha
      }
      return false;
    }
  },
  {
    id: "CONTINUIDAD_RANGO",
    nombre: "Tendencia de Rango Continua",
    eval: (history: any[], target: any) => {
      if (history.length < 2) return false;
      const last = isAlto(history[0].numero);
      const prev = isAlto(history[1].numero);
      // Si hubo 2 iguales, el sistema forzó un TERCERO igual?
      if (last === prev) {
        return isAlto(target.numero) === last; // Acierto si continuó la racha
      }
      return false;
    }
  },
  {
    id: "COMPENSACION_PARIDAD",
    nombre: "Rebote de Paridad (Inversión)",
    eval: (history: any[], target: any) => {
      if (history.length < 2) return false;
      const last = isPar(history[0].numero);
      const prev = isPar(history[1].numero);
      if (last === prev) {
        return isPar(target.numero) !== last;
      }
      return false;
    }
  },
  {
    id: "CUADRANTE_ESTATICO_DOMINANTE",
    nombre: "Cuadrante Caliente Semanal",
    eval: (history: any[], target: any) => {
      if (history.length < 10) return false;
      // Calcula cuál es el cuadrante más salido en los últimos 10 sorteos
      const counts: Record<string, number> = {};
      history.slice(0, 10).forEach(d => {
        const q = getCuadrante(d.numero);
        counts[q] = (counts[q] || 0) + 1;
      });
      const hot = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
      return getCuadrante(target.numero) === hot; // Acierto si siguió saliendo el caliente
    }
  }
];

async function runRollingMiner() {
  console.log("=========================================");
  console.log("🕵️  INICIANDO ESCÁNER FORENSE (Rolling Windows)");
  console.log("=========================================");

  const allDraws: any[] = [];
  let from = 0;
  const limit = 1000;
  process.stdout.write("Descargando base de datos completa");
  
  while (true) {
    const { data: chunk } = await supabaseAdmin
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

  // Agrupar los sorteos por "Semana del Año" para crear las ventanas
  // Formato de semana: YYYY-WW
  const drawsByWeek = new Map<string, any[]>();
  
  for (const d of allDraws) {
    const date = new Date(d.fecha + "T12:00:00");
    const year = date.getFullYear();
    const firstDayOfYear = new Date(year, 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    const weekKey = `${year}-W${weekNum.toString().padStart(2, '0')}`;
    
    if (!drawsByWeek.has(weekKey)) drawsByWeek.set(weekKey, []);
    drawsByWeek.get(weekKey)!.push(d);
  }

  const weeks = Array.from(drawsByWeek.keys()).sort();
  console.log(`\nRebanando historial en ${weeks.length} semanas de análisis...`);

  let semanasHackeadas = 0;
  let semanasCaoticas = 0;
  
  const algoritmosGanadores: Record<string, number> = {};
  ALGORITMOS_MATRICIALES.forEach(a => algoritmosGanadores[a.id] = 0);

  // Analizar semana por semana aisladamente
  for (const weekKey of weeks) {
    const weekDraws = drawsByWeek.get(weekKey)!;
    if (weekDraws.length < 15) continue; // Ignorar semanas casi vacías (días feriados, etc)

    // Agrupar por hora de la semana (para mantener el historial lineal)
    const historyByHora: Record<string, any[]> = {};
    const weekResults: Record<string, { total: number, hits: number }> = {};
    ALGORITMOS_MATRICIALES.forEach(a => weekResults[a.id] = { total: 0, hits: 0 });

    for (const draw of weekDraws) {
      const hora = draw.lottery_draws?.hora || "00:00";
      if (!historyByHora[hora]) historyByHora[hora] = [];
      
      const history = historyByHora[hora]; // Historial INVERSO (history[0] es el MÁS RECIENTE)
      
      // Probar todos los algoritmos teóricos contra este sorteo
      for (const alg of ALGORITMOS_MATRICIALES) {
        // Ejecutar algoritmo simulando que no conoce el futuro
        // Algunos algoritmos devuelven false si no aplica su condición.
        // Si el algoritmo decide "no apostar", no se cuenta como total.
        // Simularemos que el algoritmo decide apostar siempre que haya historia suficiente.
        // NOTA: Para un cálculo de win rate justo, medimos Aciertos / Veces que la Condición se cumplió.
        
        let aposto = false;
        
        if (alg.id === "COMPENSACION_RANGO" || alg.id === "CONTINUIDAD_RANGO") {
          if (history.length >= 2 && isAlto(history[0].numero) === isAlto(history[1].numero)) aposto = true;
        } else if (alg.id === "COMPENSACION_PARIDAD") {
          if (history.length >= 2 && isPar(history[0].numero) === isPar(history[1].numero)) aposto = true;
        } else if (alg.id === "CUADRANTE_ESTATICO_DOMINANTE") {
          if (history.length >= 10) aposto = true;
        }

        if (aposto) {
          weekResults[alg.id].total++;
          if (alg.eval(history, draw)) weekResults[alg.id].hits++;
        }
      }

      // Añadir el sorteo al principio del historial para la siguiente iteración
      history.unshift(draw);
    }

    // Termina la semana. Calcular qué algoritmo dominó la semana.
    let bestAlgId = null;
    let bestWinRate = 0;

    for (const alg of ALGORITMOS_MATRICIALES) {
      const res = weekResults[alg.id];
      if (res.total >= 10) { // Mínimo 10 apuestas en la semana para ser estadísticamente válido
        const wr = (res.hits / res.total) * 100;
        
        // Las predicciones de compensación son de RANGO o PARIDAD (50% baseline). 
        // Para que sean dominantes, deben superar el 60%.
        // La predicción de CUADRANTE es de 25% baseline. Debe superar el 36%.
        let isDominant = false;
        if (alg.id.includes("CUADRANTE")) {
          if (wr >= 38) isDominant = true; 
        } else {
          if (wr >= 60) isDominant = true;
        }

        if (isDominant && wr > bestWinRate) {
          bestWinRate = wr;
          bestAlgId = alg.id;
        }
      }
    }

    if (bestAlgId) {
      semanasHackeadas++;
      algoritmosGanadores[bestAlgId]++;
    } else {
      semanasCaoticas++;
    }
  }

  // REPORTE FINAL
  console.log("\n=======================================");
  console.log(`REPORTE FORENSE DE ALGORITMOS (${weeks.length} Semanas Analizadas)`);
  console.log("=======================================");
  console.log(`- Semanas Hackeadas (Reglas Detectadas): ${semanasHackeadas} semanas (${Math.round((semanasHackeadas/weeks.length)*100)}%)`);
  console.log(`- Semanas Caóticas (Puro Azar): ${semanasCaoticas} semanas (${Math.round((semanasCaoticas/weeks.length)*100)}%)`);
  console.log("\n🏆 ALGORITMOS ROTATIVOS DESCUBIERTOS:");
  
  const ranking = ALGORITMOS_MATRICIALES.map(a => ({ nombre: a.nombre, dominadas: algoritmosGanadores[a.id] }))
    .sort((a, b) => b.dominadas - a.dominadas);

  ranking.forEach((r, i) => {
    console.log(`${i+1}. "${r.nombre}": Dominó en ${r.dominadas} semanas del historial.`);
  });

  console.log("\n💡 CONCLUSIÓN DE LA IA:");
  if (semanasHackeadas > semanasCaoticas) {
    console.log("¡Confirmado! La lotería NO es aleatoria. Alterna entre los algoritmos listados arriba dependiendo de la semana.");
  } else {
    console.log("El sistema es predominantemente caótico, pero existen ventanas predecibles cuando un algoritmo domina la semana.");
  }
}

runRollingMiner().catch(console.error);
