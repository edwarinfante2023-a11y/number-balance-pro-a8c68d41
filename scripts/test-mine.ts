import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const envContent = fs.readFileSync(".env", "utf-8");
const envVars = Object.fromEntries(
  envContent.split("\n").filter(l => l && !l.startsWith("#")).map(l => {
    const i = l.indexOf("=");
    if (i === -1) return [];
    return [l.substring(0, i), l.substring(i + 1).replace(/"/g, "")];
  })
);

const supabaseAdmin = createClient(envVars.VITE_SUPABASE_URL, envVars.VITE_SUPABASE_PUBLISHABLE_KEY);

const MIN_EFECTIVIDAD = 40;
const MIN_OCURRENCIAS = 20;

const isAlto = (n) => n >= 50;
const isPar = (n) => n % 2 === 0;
const cuadrante = (n) => `${isAlto(n) ? "ALTO" : "BAJO"}_${isPar(n) ? "PAR" : "IMPAR"}`;

function mineQuadrantStreak(draws) {
  const results = [];
  const dimensions = [
    { name: "Rango", classify: (n) => (isAlto(n) ? "ALTO" : "BAJO"), values: ["ALTO", "BAJO"] },
    { name: "Paridad", classify: (n) => (isPar(n) ? "PAR" : "IMPAR"), values: ["PAR", "IMPAR"] },
  ];

  for (const dim of dimensions) {
    for (const streakValue of dim.values) {
      const opposite = dim.values.find((v) => v !== streakValue);
      for (const streakLen of [3, 4, 5]) {
        let total = 0, hits = 0;
        for (let i = streakLen; i < draws.length; i++) {
          let isStreak = true;
          for (let j = 1; j <= streakLen; j++) {
            if (dim.classify(draws[i - j].numero) !== streakValue) { isStreak = false; break; }
          }
          if (isStreak) {
            total++;
            if (dim.classify(draws[i].numero) === opposite) hits++;
          }
        }
        if (total < MIN_OCURRENCIAS) continue;
        const ef = Math.round((hits / total) * 100);
        if (ef >= MIN_EFECTIVIDAD) {
          results.push({
            nombre: `Rebote ${streakLen}x${streakValue}→${opposite}`,
            descripcion: `Después de ${streakLen} sorteos consecutivos ${streakValue}, el siguiente tiende a ser ${opposite} (${ef}%).`,
            tipo: "compensacion",
            condiciones: { algorithm: "quadrant_streak", dimension: dim.name, streakValue, streakLen, opposite },
            resultado_esperado: opposite,
            ocurrencias: total, aciertos: hits, efectividad: ef, hora: null,
          });
        }
      }
    }
  }
  return results.sort((a, b) => b.efectividad - a.efectividad).slice(0, 4);
}

function mineBlockTransition(draws) {
  const results = [];
  let totalBloqueos = 0, hitsInvertedParity = 0, hitsSameParity = 0;

  for (let i = 3; i < draws.length; i++) {
    const d1 = draws[i-3], d2 = draws[i-2], d3 = draws[i-1], target = draws[i];
    const r1 = isAlto(d1.numero) ? "ALTO" : "BAJO";
    const r2 = isAlto(d2.numero) ? "ALTO" : "BAJO";
    const r3 = isAlto(d3.numero) ? "ALTO" : "BAJO";
    const rT = isAlto(target.numero) ? "ALTO" : "BAJO";

    if (r1 === r2 && r2 === r3 && rT !== r3) {
      totalBloqueos++;
      const lastParity = isPar(d3.numero) ? "PAR" : "IMPAR";
      const targetParity = isPar(target.numero) ? "PAR" : "IMPAR";
      if (targetParity !== lastParity) hitsInvertedParity++;
      else hitsSameParity++;
    }
  }

  if (totalBloqueos >= MIN_OCURRENCIAS) {
    const efInverted = Math.round((hitsInvertedParity / totalBloqueos) * 100);
    const efSame = Math.round((hitsSameParity / totalBloqueos) * 100);
    if (efInverted >= MIN_EFECTIVIDAD) {
      results.push({
        nombre: `Bloqueo Rango → Paridad Invertida`,
        descripcion: `Cuando se rompe una racha de Rango, el bloqueo tiende a traer la paridad contraria al último sorteo (${efInverted}%).`,
        tipo: "bloqueo", condiciones: { algorithm: "block_transition", type: "inverted_parity" },
        resultado_esperado: "OPPOSITE_PARITY_BLOCK",
        ocurrencias: totalBloqueos, aciertos: hitsInvertedParity, efectividad: efInverted, hora: null,
      });
    }
  }
  return results;
}

function mineSeasonalMonthly(draws) {
  const results = [];
  const horas = [...new Set(draws.map((d) => d.hora))];
  const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

  for (const hora of horas) {
    const drawsHora = draws.filter((d) => d.hora === hora);
    if (drawsHora.length < 100) continue;

    const byMonth = new Map();
    for (const d of drawsHora) {
      const month = parseInt(d.fecha.split("-")[1], 10);
      if (!byMonth.has(month)) byMonth.set(month, []);
      byMonth.get(month).push(d);
    }

    const cuadrantes = ["ALTO_PAR", "ALTO_IMPAR", "BAJO_PAR", "BAJO_IMPAR"];
    for (const q of cuadrantes) {
      const monthlyEf = [];
      for (const [month, monthDraws] of byMonth) {
        if (monthDraws.length < 10) continue;
        const hits = monthDraws.filter((d) => cuadrante(d.numero) === q).length;
        const ef = Math.round((hits / monthDraws.length) * 100);
        monthlyEf.push({ month, ef, count: hits, total: monthDraws.length });
      }

      if (monthlyEf.length < 3) continue;
      const avgEf = monthlyEf.reduce((s, m) => s + m.ef, 0) / monthlyEf.length;
      const hotMonths = monthlyEf.filter((m) => m.ef >= 40 && m.ef >= avgEf + 10);
      const coldMonths = monthlyEf.filter((m) => m.ef < avgEf - 5);

      if (hotMonths.length >= 2 && coldMonths.length >= 2 && hotMonths.length <= 6) {
        const activeMonthNums = hotMonths.map((m) => m.month).sort((a, b) => a - b);
        const totalOc = hotMonths.reduce((s, m) => s + m.total, 0);
        const totalHits = hotMonths.reduce((s, m) => s + m.count, 0);
        const ef = Math.round((totalHits / totalOc) * 100);

        if (ef >= MIN_EFECTIVIDAD && totalOc >= MIN_OCURRENCIAS) {
          const monthLabels = activeMonthNums.map((m) => monthNames[m - 1]).join(", ");
          results.push({
            nombre: `Estacional ${q} ${hora} (${monthLabels})`,
            descripcion: `El cuadrante ${q} domina a las ${hora} durante ${monthLabels} con ${ef}% de efectividad.`,
            tipo: "patron",
            condiciones: { algorithm: "seasonal_monthly", hora, cuadrante: q, active_months: activeMonthNums },
            resultado_esperado: q,
            ocurrencias: totalOc, aciertos: totalHits, efectividad: ef, hora,
          });
        }
      }
    }
  }
  return results.sort((a, b) => b.efectividad - a.efectividad).slice(0, 5);
}

async function runMiner() {
  console.log("Iniciando Robot Minero...");
  const allDrawsData = [];
  let from = 0;
  const limit = 1000;
  
  while (true) {
    const { data: chunk } = await supabaseAdmin.from("draws").select("numero, fecha, lottery_draws!inner(hora)").order("fecha", { ascending: true }).range(from, from + limit - 1);
    if (!chunk || chunk.length === 0) break;
    allDrawsData.push(...chunk);
    from += limit;
  }
  
  const draws = allDrawsData.map(d => ({ numero: d.numero, fecha: d.fecha, hora: d.lottery_draws?.hora || "00:00" }));
  console.log(`Analizando ${draws.length} sorteos...`);

  const allDiscoveries = [
    ...mineQuadrantStreak(draws),
    ...mineBlockTransition(draws),
    ...mineSeasonalMonthly(draws),
  ];

  console.log(`¡Robot encontró ${allDiscoveries.length} patrones matemáticos fuertes (>40% ef)!`);
  console.log(JSON.stringify(allDiscoveries, null, 2));

  // Guardar en BD como activos
  let inserted = 0;
  for (const d of allDiscoveries) {
    const { data: row } = await supabaseAdmin.from("patterns").insert({
      nombre: d.nombre,
      descripcion: d.descripcion,
      tipo: d.tipo,
      condiciones: d.condiciones,
      resultado_esperado: d.resultado_esperado,
      ocurrencias: d.ocurrencias,
      aciertos: d.aciertos,
      efectividad: d.efectividad,
      hora: d.hora,
      activa: true, // FORZAR ACTIVO PARA EL TEST
      source: "mined",
      estado: "activo",
      score_confianza: d.efectividad,
    }).select("id").single();
    if (row) inserted++;
  }

  console.log(`Insertados en BD y ACTIVADOS: ${inserted} patrones.`);
}

runMiner().catch(console.error);
