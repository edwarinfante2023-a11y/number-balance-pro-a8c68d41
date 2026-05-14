import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

/**
 * ⚡ EL ROMPEDOR DE RACHAS (Fase 13)
 * 
 * Análisis de supervivencia matemática de las rachas de PRNG.
 * Este script buscará el límite físico de la máquina contando
 * cuántas veces seguidas puede generar la misma propiedad sin romperse.
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

const isPar = (n: number) => n % 2 === 0;

async function runStreakBreaker() {
  console.log("=========================================");
  console.log("⚡ INICIANDO EL ROMPEDOR DE RACHAS (Fase 13)");
  console.log("=========================================");

  const allDraws: any[] = [];
  let from = 0;
  const limit = 1000;
  process.stdout.write("[SYS] Cargando historial absoluto ");
  while (true) {
    const { data: chunk } = await supabase
      .from("draws")
      .select("numero, fecha")
      .order("fecha", { ascending: true })
      .range(from, from + limit - 1);
    if (!chunk || chunk.length === 0) break;
    allDraws.push(...chunk);
    from += limit;
    process.stdout.write(".");
  }
  console.log(`\n[SYS] Historial de ${allDraws.length} sorteos listo para la Autopsia.\n`);

  // 1. AUTOPSIA DE RACHAS (Análisis de Supervivencia de Paridad)
  // Vamos a medir exclusivamente las Rachas de Paridad (Cuantos PARES seguidos o IMPARES seguidos)
  const streakLengths: Record<number, number> = {}; // { longitud: cantidad_de_veces }
  let currentStreakVal = isPar(allDraws[0].numero);
  let currentStreakLen = 1;

  for (let i = 1; i < allDraws.length; i++) {
    const isCurrentPar = isPar(allDraws[i].numero);
    if (isCurrentPar === currentStreakVal) {
      currentStreakLen++;
    } else {
      // La racha se rompió. Registramos la longitud que alcanzó.
      if (!streakLengths[currentStreakLen]) streakLengths[currentStreakLen] = 0;
      streakLengths[currentStreakLen]++;
      
      // Iniciamos nueva racha
      currentStreakVal = isCurrentPar;
      currentStreakLen = 1;
    }
  }

  // 2. IMPRESIÓN DE LA TABLA DE SUPERVIVENCIA
  console.log("📊 TABLA DE AUTOPSIA (Rachas de Paridad Históricas):");
  console.log("Longitud de Racha | Frecuencia de Aparición | Probabilidad de Sobrevivir al sig. nivel");
  console.log("---------------------------------------------------------------------------------");
  
  let maxRacha = 0;
  for (const lenStr in streakLengths) {
    if (parseInt(lenStr) > maxRacha) maxRacha = parseInt(lenStr);
  }

  // Para calcular la probabilidad de ruptura, sumamos cuantas llegaron a N y cuántas pasaron a N+1
  const probDeRuptura: Record<number, number> = {};

  for (let len = 1; len <= maxRacha; len++) {
    const cantidadExactaDeEsteLargo = streakLengths[len] || 0;
    
    // ¿Cuántas rachas llegaron A ESTE LARGO O MÁS?
    let llegaronAesteLargoOmás = 0;
    for (let j = len; j <= maxRacha; j++) {
      llegaronAesteLargoOmás += streakLengths[j] || 0;
    }

    // ¿Cuántas lograron pasar al siguiente nivel?
    let pasaronAlSiguiente = llegaronAesteLargoOmás - cantidadExactaDeEsteLargo;

    // Probabilidad de Romperse = (Las que murieron aquí) / (Todas las que llegaron hasta aquí)
    let probRuptura = 0;
    if (llegaronAesteLargoOmás > 0) {
      probRuptura = (cantidadExactaDeEsteLargo / llegaronAesteLargoOmás) * 100;
    }
    probDeRuptura[len] = probRuptura;

    // Probabilidad de sobrevivir (lo opuesto)
    const probSobrevivir = 100 - probRuptura;

    console.log(`Racha de ${len.toString().padEnd(2, ' ')}       | ${cantidadExactaDeEsteLargo.toString().padEnd(23, ' ')} | ${probSobrevivir.toFixed(2)}% de seguir, ${probRuptura.toFixed(2)}% de Romperse.`);
  }

  console.log("\n=========================================");
  console.log("🎯 ESTRATEGIA DE TENSIÓN CRÍTICA");
  console.log("=========================================");
  console.log("Vamos a simular un Francotirador que solo apuesta EN CONTRA de la racha");
  console.log("cuando la racha alcanza una longitud donde la Probabilidad de Ruptura histórica");
  console.log("es mayor al 55% (Punto Crítico).\n");

  // Encontrar el Punto de Tensión Crítica
  let TENSIÓN_CRÍTICA = 1;
  for (let len = 1; len <= maxRacha; len++) {
    if (probDeRuptura[len] >= 55) {
      TENSIÓN_CRÍTICA = len;
      break;
    }
  }
  
  // Ajuste manual: Si el punto crítico calculado es muy bajo, lo forzamos a una racha larga (Ej: 6) 
  // para mayor seguridad en la vida real.
  TENSIÓN_CRÍTICA = Math.max(TENSIÓN_CRÍTICA, 6);
  console.log(`[SYS] Punto de Tensión Crítica establecido en: Racha de ${TENSIÓN_CRÍTICA}`);

  // 3. SIMULACIÓN FINANCIERA (APOSTANDO AL QUIEBRE)
  let jugadas = 0;
  let aciertos = 0;
  
  let simStreakVal = isPar(allDraws[0].numero);
  let simStreakLen = 1;

  for (let i = 1; i < allDraws.length - 1; i++) {
    const isCurrentPar = isPar(allDraws[i].numero);
    
    if (isCurrentPar === simStreakVal) {
      simStreakLen++;
    } else {
      simStreakVal = isCurrentPar;
      simStreakLen = 1;
    }

    // Si la racha ALCANZA el punto crítico, el robot apuesta a que el SIGUIENTE sorteo LA ROMPE
    if (simStreakLen === TENSIÓN_CRÍTICA) {
      jugadas++;
      const nextSorteoPar = isPar(allDraws[i + 1].numero);
      // Acertamos si el siguiente sorteo es DIFERENTE a la racha
      if (nextSorteoPar !== simStreakVal) {
        aciertos++;
      }
    }
  }

  const COSTO_POR_SORTEO = 50000; // Apostar a Par o Impar cuesta $50,000 (50 números x $1,000)
  const PREMIO = 72000;
  const INITIAL_BANKROLL = 200000;

  const winRate = jugadas > 0 ? (aciertos / jugadas) * 100 : 0;
  const inversion = jugadas * COSTO_POR_SORTEO;
  const ganancia = aciertos * PREMIO;
  const neto = ganancia - inversion;
  const bancoFinal = INITIAL_BANKROLL + neto;

  console.log(`Disparos realizados (Solo cuando la racha llegaba a ${TENSIÓN_CRÍTICA}): ${jugadas}`);
  console.log(`Aciertos (Veces que la racha se rompió como predecimos): ${aciertos}`);
  console.log(`🏆 Win Rate del Rompedor: ${winRate.toFixed(2)}%`);
  
  console.log(`\n=========================================`);
  console.log(`💰 BALANCE FINANCIERO DEL ROMPEDOR`);
  console.log(`=========================================`);
  console.log(`Inversión Total: $${inversion.toLocaleString()}`);
  console.log(`Premios Cobrados: $${ganancia.toLocaleString()}`);
  
  if (bancoFinal > INITIAL_BANKROLL) {
    console.log(`SALDO FINAL DE CUENTA: $${bancoFinal.toLocaleString()} 🚀`);
    console.log(`\n💡 CONCLUSIÓN CIENTÍFICA:`);
    console.log(`La tensión funciona. El generador PRNG no puede mantener la estática `);
    console.log(`al infinito. Apostar en contra en los puntos de quiebre es rentable.`);
  } else {
    console.log(`SALDO FINAL DE CUENTA: $${bancoFinal.toLocaleString()} 🔻`);
    console.log(`\n💡 CONCLUSIÓN CIENTÍFICA:`);
    console.log(`Las matemáticas son brutales. Incluso en los puntos de tensión crítica,`);
    console.log(`el PRNG logra estirarse un poco más. Dado que apostar a Par/Impar`);
    console.log(`cuesta $50,000 y paga $72,000, necesitas un Win Rate masivo (>69.4%)`);
    console.log(`para ser rentable. El Rompedor de Rachas fracasó ante el casino.`);
  }
}

runStreakBreaker().catch(console.error);
