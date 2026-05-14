import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

/**
 * 🧬 DEEP CHAOS TERMINATOR (Algoritmo Genético - Fase 9)
 * 
 * Implementa Teoría de la Evolución de Darwin para crear cerebros (redes neuronales)
 * aleatorios, evaluarlos contra el caos, asesinar a los débiles, y cruzar (reproducir) 
 * a los fuertes aplicándoles mutaciones hasta evolucionar a un "Depredador Alfa".
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

// ---------------------------------------------
// ARQUITECTURA GENÉTICA (ADN del Cerebro)
// ---------------------------------------------
const NUM_INPUTS = 5; 
const NUM_OUTPUTS = 4; // Los 4 cuadrantes
const GENOME_SIZE = NUM_INPUTS * NUM_OUTPUTS; // 20 Pesos Sinápticos (Genes)

interface Genome {
  id: string;
  genes: number[]; // Array de pesos de -1 a 1
  fitness: number; // Aciertos
  winRate: number;
}

function randomGene() {
  return (Math.random() * 2) - 1; // Entre -1 y 1
}

function createRandomGenome(): Genome {
  return {
    id: Math.random().toString(36).substring(7),
    genes: Array.from({ length: GENOME_SIZE }, () => randomGene()),
    fitness: 0,
    winRate: 0
  };
}

// ---------------------------------------------
// MOTOR DE INFERENCIA
// ---------------------------------------------
function predictQuadrant(genome: Genome, inputs: number[]): string {
  const scores = [0, 0, 0, 0];
  let geneIndex = 0;
  
  // Multiplicar los inputs por los genes (pesos sinápticos)
  for (let out = 0; out < NUM_OUTPUTS; out++) {
    for (let inp = 0; inp < NUM_INPUTS; inp++) {
      scores[out] += inputs[inp] * genome.genes[geneIndex];
      geneIndex++;
    }
  }

  // Activar la red y elegir la puntuación más alta
  let maxScore = -Infinity;
  let maxIndex = 0;
  for (let i = 0; i < NUM_OUTPUTS; i++) {
    if (scores[i] > maxScore) {
      maxScore = scores[i];
      maxIndex = i;
    }
  }
  return CUADRANTES[maxIndex];
}

async function runEvolution() {
  console.log("=========================================");
  console.log("🧬 INICIANDO PROYECTO GÉNESIS (Deep Chaos Terminator)");
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

  // 2. Extraer el Entorno de Combate (Data de Entrenamiento)
  // Normalizar los datos para que la Red Neuronal los entienda (0 a 1)
  const trainingData: { inputs: number[], target: string }[] = [];
  
  // Usaremos los últimos 2000 sorteos para que la evolución sea rápida y precisa
  const recentDraws = allDraws.slice(-2000); 

  for (let i = 1; i < recentDraws.length; i++) {
    const prev = recentDraws[i-1];
    const current = recentDraws[i];
    
    const d = new Date(current.fecha + "T12:00:00");
    const horaNum = parseInt((current.lottery_draws?.hora || "00:00").split(":")[0]);

    // Entradas al cerebro (Inputs normalizados de 0 a 1)
    const inputs = [
      d.getDay() / 6,               // Día (0-1)
      horaNum / 24,                 // Hora (0-1)
      isAlto(prev.numero) ? 1 : 0,  // Anterior era Alto?
      isPar(prev.numero) ? 1 : 0,   // Anterior era Par?
      prev.numero / 100             // Número exacto anterior (0-1)
    ];

    trainingData.push({
      inputs,
      target: getCuad(current.numero)
    });
  }

  console.log(`\n✅ Arena de Combate lista. ${trainingData.length} sorteos ingresados.\n`);

  // ---------------------------------------------
  // BUCLE DE EVOLUCIÓN (GENERACIONES)
  // ---------------------------------------------
  const POPULATION_SIZE = 100; // 100 cerebros compitiendo
  const GENERATIONS = 30; // 30 ciclos de vida y muerte
  const MUTATION_RATE = 0.1; // 10% de probabilidad de mutación genética

  // Crear población inicial (Adán y Eva x 50)
  let population: Genome[] = Array.from({ length: POPULATION_SIZE }, () => createRandomGenome());

  let bestGlobalWinRate = 0;

  for (let gen = 1; gen <= GENERATIONS; gen++) {
    process.stdout.write(`🔄 Generación ${gen}: Evaluando supervivencia... `);
    
    // FASE 1: Lucha por la Supervivencia (Testear contra la lotería)
    for (const genome of population) {
      genome.fitness = 0;
      for (const td of trainingData) {
        const prediction = predictQuadrant(genome, td.inputs);
        if (prediction === td.target) {
          genome.fitness++;
        }
      }
      genome.winRate = (genome.fitness / trainingData.length) * 100;
    }

    // Ordenar de más fuerte a más débil
    population.sort((a, b) => b.fitness - a.fitness);

    const alfa = population[0]; // El Depredador Alfa de esta generación
    if (alfa.winRate > bestGlobalWinRate) bestGlobalWinRate = alfa.winRate;

    console.log(`[Alfa WinRate: ${alfa.winRate.toFixed(2)}%]`);

    // FASE 2: Selección Natural (Asesinato de los débiles)
    // Nos quedamos solo con el Top 20%
    const survivors = population.slice(0, 20);

    // FASE 3: Reproducción (Crossover) y Mutación
    const nextGeneration: Genome[] = [];
    
    // Los sobrevivientes pasan a la siguiente ronda (Elitismo)
    survivors.forEach(s => nextGeneration.push({ ...s, id: s.id + "-E", fitness: 0, winRate: 0 }));

    // Crear 80 hijos nuevos mezclando los genes de los ganadores
    while (nextGeneration.length < POPULATION_SIZE) {
      // Elegir dos padres al azar entre los sobrevivientes
      const p1 = survivors[Math.floor(Math.random() * survivors.length)];
      const p2 = survivors[Math.floor(Math.random() * survivors.length)];
      
      const childGenes = [];
      for (let i = 0; i < GENOME_SIZE; i++) {
        // Crossover (Mendeliano): 50% gen del padre 1, 50% gen del padre 2
        let gene = Math.random() < 0.5 ? p1.genes[i] : p2.genes[i];
        
        // Mutación Aleatoria (Radiación/Evolución)
        if (Math.random() < MUTATION_RATE) {
          gene += randomGene() * 0.5; // Mutación pequeña
          // Mantener entre -1 y 1
          if (gene > 1) gene = 1;
          if (gene < -1) gene = -1;
        }
        childGenes.push(gene);
      }

      nextGeneration.push({
        id: Math.random().toString(36).substring(7),
        genes: childGenes,
        fitness: 0,
        winRate: 0
      });
    }

    // La nueva población reemplaza a la vieja
    population = nextGeneration;
  }

  // RESULTADO FINAL
  console.log("\n=========================================");
  console.log("🦖 LA EVOLUCIÓN HA TERMINADO");
  console.log("=========================================");
  console.log(`Win Rate Inicial (Gen 1): ~25.00%`);
  console.log(`Win Rate Máximo Alcanzado por el Depredador Alfa: ${bestGlobalWinRate.toFixed(2)}%`);
  console.log("-----------------------------------------");
  
  if (bestGlobalWinRate > 35.7) {
    console.log("💡 CONCLUSIÓN DARWINIANA:");
    console.log("La Evolución logró romper el Caos. Las mutaciones genéticas encontraron ");
    console.log("un camino que nosotros no pudimos programar manualmente.");
  } else {
    console.log("💡 CONCLUSIÓN DARWINIANA:");
    console.log("Ni siquiera simulando miles de años de evolución pudimos crear un cerebro");
    console.log("capaz de predecir el generador PRNG durante el Caos.");
    console.log("El Generador es un Muro Matemático Infranqueable. La lotería hizo un buen trabajo.");
  }
}

runEvolution().catch(console.error);
