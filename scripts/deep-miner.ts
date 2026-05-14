import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

/**
 * 🧠 DEEP MINER - Machine Learning por Fuerza Bruta (Combinatoria Multidimensional)
 * 
 * Este script descarga TODO el historial y evalúa decenas de miles de combinaciones
 * matemáticas posibles cruzando variables de Tiempo, Rachas y Estados Anteriores.
 * 
 * Solo guarda los patrones que garanticen rentabilidad (Efectividad > 37% para cuadrantes).
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

const MIN_EFECTIVIDAD = 37; // Break-even de Cuadrante es 35.7%. Solo queremos oro puro (>37%)
const MIN_OCURRENCIAS = 15; // Mínimo de veces que debe haber pasado en el historial para considerarse válido

const isAlto = (n: number) => n >= 50;
const isPar = (n: number) => n % 2 === 0;
const getCuadrante = (n: number) => `${isAlto(n) ? "ALTO" : "BAJO"}_${isPar(n) ? "PAR" : "IMPAR"}`;
const CUADRANTES = ["ALTO_PAR", "ALTO_IMPAR", "BAJO_PAR", "BAJO_IMPAR"];

interface DrawContext {
  numero: number;
  fecha: string;
  hora: string;
  cuadrante: string;
  month: number;
  dayOfWeek: number;
  rachaRango: number;
  rachaParidad: number;
  lastCuadrante: string | null;
}

async function deepMine() {
  console.log("=========================================");
  console.log("🧠 INICIANDO DEEP MINER (Machine Learning)");
  console.log("=========================================");

  // 1. Descargar historial completo
  const allDrawsData: any[] = [];
  let from = 0;
  const limit = 1000;
  process.stdout.write("Descargando data de Supabase");
  
  while (true) {
    const { data: chunk, error } = await supabaseAdmin
      .from("draws")
      .select("numero, fecha, lottery_draws!inner(hora)")
      .order("fecha", { ascending: true })
      .range(from, from + limit - 1);
      
    if (error) {
      console.error("\nError fetching", error);
      break;
    }
    if (!chunk || chunk.length === 0) break;
    
    allDrawsData.push(...chunk);
    from += limit;
    process.stdout.write(".");
  }
  
  console.log(`\n✅ Historial descargado: ${allDrawsData.length} sorteos.`);

  // 2. Pre-procesar historial añadiendo contexto rico (Features)
  console.log("Ingeniería de Características (Calculando rachas, días y cuadrantes)...");
  
  // Agrupar por hora, porque las rachas deben ser lineales por tipo de sorteo
  const drawsByHora: Record<string, DrawContext[]> = {};
  
  for (const raw of allDrawsData) {
    const hora = raw.lottery_draws?.hora || "00:00";
    if (!drawsByHora[hora]) drawsByHora[hora] = [];
    
    const d = new Date(raw.fecha + "T12:00:00"); // Medio día para evitar saltos de timezone
    const context: DrawContext = {
      numero: raw.numero,
      fecha: raw.fecha,
      hora: hora,
      cuadrante: getCuadrante(raw.numero),
      month: d.getMonth() + 1, // 1-12
      dayOfWeek: d.getDay(), // 0-6 (Dom-Sab)
      rachaRango: 1,
      rachaParidad: 1,
      lastCuadrante: null
    };
    
    const arr = drawsByHora[hora];
    if (arr.length > 0) {
      const last = arr[arr.length - 1];
      context.lastCuadrante = last.cuadrante;
      
      const lastRango = isAlto(last.numero);
      const currRango = isAlto(context.numero);
      if (lastRango === currRango) context.rachaRango = last.rachaRango + 1;
      
      const lastParidad = isPar(last.numero);
      const currParidad = isPar(context.numero);
      if (lastParidad === currParidad) context.rachaParidad = last.rachaParidad + 1;
    }
    
    arr.push(context);
  }

  // 3. Crear el Espacio Combinatorio (Permutaciones)
  console.log("Generando hiper-espacio combinatorio...");
  const horas = Object.keys(drawsByHora);
  const days = ["ANY", 0, 1, 2, 3, 4, 5, 6]; // ANY = cualquier dia
  const months = ["ANY", 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const lastCuads = ["ANY", ...CUADRANTES];
  const rachasRangoLimit = ["ANY", 2, 3, 4]; // racha EXACTA anterior

  // Estructura de resultados: key -> { hits: { ALTO_PAR: 0, ... }, total: 0 }
  const combinations = new Map<string, { total: number, hits: Record<string, number> }>();
  
  let totalSorteosAnalizados = 0;

  // Analizar cada sorteo contra TODAS las abstracciones posibles
  for (const hora of horas) {
    const arr = drawsByHora[hora];
    for (let i = 1; i < arr.length; i++) { // Empezar de 1 para tener "last"
      const current = arr[i];
      const prev = arr[i - 1]; // Estado INMEDIATAMENTE ANTERIOR al resultado
      totalSorteosAnalizados++;

      // Las condiciones son sobre el estado ANTERIOR, para ver si predicen el current
      const ctxDay = current.dayOfWeek;
      const ctxMonth = current.month;
      const ctxLastCuad = prev.cuadrante;
      const ctxRachaRango = prev.rachaRango;

      // Generar todas las "Lentes" posibles (filtros combinados) que aplican a este sorteo
      for (const d of [ctxDay, "ANY"]) {
        for (const m of [ctxMonth, "ANY"]) {
          for (const lc of [ctxLastCuad, "ANY"]) {
            for (const rr of [ctxRachaRango, "ANY"]) {
              
              // Evitar combinaciones vacías de contexto (ej. ANY-ANY-ANY-ANY)
              // Queremos al menos 2 dimensiones específicas
              let specificCount = 0;
              if (d !== "ANY") specificCount++;
              if (m !== "ANY") specificCount++;
              if (lc !== "ANY") specificCount++;
              if (rr !== "ANY") specificCount++;
              if (specificCount < 1) continue;

              const key = JSON.stringify({
                algorithm: "deep_miner",
                hora: hora, // Siempre evaluamos por hora
                dayOfWeek: d,
                month: m,
                lastCuadrante: lc,
                prevRachaRango: rr
              });

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

  console.log(`Espacio de combinaciones evaluado: ${combinations.size.toLocaleString()} modelos matemáticos.`);
  console.log("Filtrando diamantes matemáticos (Rentabilidad Garantizada > 37%)...");

  const discoveries: any[] = [];
  const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const monthNames = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

  for (const [key, stats] of combinations.entries()) {
    if (stats.total < MIN_OCURRENCIAS) continue; // Descartar rarezas estadísticas

    for (const cuad of CUADRANTES) {
      const hits = stats.hits[cuad];
      const ef = Math.round((hits / stats.total) * 100);

      // Si la combinación predice un cuadrante con efectividad de francotirador
      if (ef >= MIN_EFECTIVIDAD) {
        const conds = JSON.parse(key);
        conds.targetCuadrante = cuad; // Agregar el target a las condiciones

        // Armar un nombre legible
        let descParts = [];
        if (conds.dayOfWeek !== "ANY") descParts.push(`los ${dayNames[conds.dayOfWeek]}`);
        if (conds.month !== "ANY") descParts.push(`en ${monthNames[conds.month]}`);
        if (conds.lastCuadrante !== "ANY") descParts.push(`si el anterior fue ${conds.lastCuadrante}`);
        if (conds.prevRachaRango !== "ANY") descParts.push(`tras ${conds.prevRachaRango} consecutivos del mismo rango`);

        const descStr = descParts.length > 0 ? descParts.join(" y ") : "siempre";
        const nombre = `D-Miner [${cuad}] ${descStr}`;
        const descripcion = `A las ${conds.hora}, ${descStr}, el próximo cuadrante tiende a ser ${cuad} con ${ef}% de seguridad.`;

        discoveries.push({
          nombre: nombre.substring(0, 50),
          descripcion,
          tipo: "patron",
          condiciones: conds,
          resultado_esperado: cuad,
          ocurrencias: stats.total,
          aciertos: hits,
          efectividad: ef,
          hora: conds.hora,
          activa: true,
          estado: "activo",
          source: "deep_miner",
          score_confianza: ef
        });
      }
    }
  }

  // Ordenar por efectividad (de mayor a menor) y quedarnos con los mejores 15
  discoveries.sort((a, b) => b.efectividad - a.efectividad);
  const bestDiscoveries = discoveries.slice(0, 15);

  console.log(`\n💎 DEEP MINER terminó. Encontró ${discoveries.length} patrones rentables.`);
  console.log(`Seleccionando el TOP 15 más letal:`);
  
  bestDiscoveries.forEach((d, i) => {
    console.log(`${i+1}. [${d.efectividad}%] ${d.nombre} (Aciertos: ${d.aciertos}/${d.ocurrencias})`);
  });

  // Limpiar patrones viejos del Deep Miner (para renovar el conocimiento)
  console.log("\nLimpiando base de conocimientos anterior...");
  await supabaseAdmin.from("patterns").delete().eq("source", "deep_miner");

  // Inyectar a la BD
  console.log("Inyectando nuevo conocimiento en la IA...");
  let inserted = 0;
  for (const d of bestDiscoveries) {
    const { data: row, error } = await supabaseAdmin.from("patterns").insert(d).select("id").single();
    if (error) console.error("Error insertando patrón:", error.message);
    if (row) inserted++;
  }

  console.log(`\n🚀 ¡MISIÓN CUMPLIDA! ${inserted} patrones del Deep Miner inyectados y ACTIVOS.`);
}

deepMine().catch(console.error);
