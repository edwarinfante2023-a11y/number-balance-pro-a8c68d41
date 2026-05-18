import * as fs from "fs";
import * as path from "path";
const envPath = path.resolve(process.cwd(), ".env");
const envContent = fs.readFileSync(envPath, "utf-8");
const envVars = Object.fromEntries(
  envContent.split("\n").filter(l => l && !l.startsWith("#")).map(l => {
    const i = l.indexOf("="); return i === -1 ? [] : [l.substring(0, i), l.substring(i + 1).replace(/"/g, "")];
  })
);
process.env.SUPABASE_URL = envVars.VITE_SUPABASE_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.VITE_SUPABASE_PUBLISHABLE_KEY; // Fallback if missing

import { supabaseAdmin } from "./src/integrations/supabase/client.server";
import { ADAPTIVE_STRATEGY, buildCartera, classifyWeek, godModePredict, type CarteraPattern, type CarteraRule, type CarteraHistoricalStats } from "./src/lib/carteraEngine";
import { formatDateInTimeZone } from "./src/lib/timezone";

async function run() {
  const fecha = formatDateInTimeZone(new Date());
  
  const [
    { data: rawDraws },
    { data: rawRules },
    { data: rawPatterns },
    { data: rawStats },
    { data: sorteos }
  ] = await Promise.all([
    supabaseAdmin.from("draws").select("*, lottery_draws!inner(id, hora, nombre, loteria_id, lotteries!inner(id, nombre))").order("fecha", { ascending: false }).limit(5000),
    supabaseAdmin.from("rules").select("id,nombre,resultado_esperado,efectividad,activo").eq("activo", true),
    supabaseAdmin.from("patterns").select("id,nombre,resultado_esperado,efectividad,hora,activa,estado").eq("activa", true),
    supabaseAdmin.from("lottery_stats").select("hora,numero,frecuencia,dias_vencido,total_sorteos").eq("periodo", 0),
    supabaseAdmin.from("lottery_draws").select("hora, activa").eq("activa", true)
  ]);

  const horasTodas = Array.from(new Set((sorteos || []).map((s: any) => s.hora))).sort();
  
  const draws = (rawDraws || []).map((r: any) => ({
    ...r,
    hora: r.lottery_draws.hora,
    loteria: r.lottery_draws.lotteries.nombre,
    loteria_id: r.lottery_draws.loteria_id,
    sorteo_nombre: r.lottery_draws.nombre,
  }));

  const statsByHora = new Map<string, CarteraHistoricalStats>();
  for (const row of rawStats || []) {
    let entry = statsByHora.get(row.hora);
    if (!entry) {
      entry = { frecuencias: {}, vencidos: {}, totalSorteos: row.total_sorteos ?? 0 };
      statsByHora.set(row.hora, entry);
    }
    entry.frecuencias[row.numero] = row.frecuencia;
    if (row.dias_vencido != null) entry.vencidos[row.numero] = row.dias_vencido;
    if (row.total_sorteos && row.total_sorteos > entry.totalSorteos) {
      entry.totalSorteos = row.total_sorteos;
    }
  }

  const generated = [];
  for (const hora of horasTodas) {
    try {
      const drawsForDual = draws.map(d => ({ numero: d.numero, fecha: d.fecha, hora: d.hora }));
      const recentForRadar = draws.filter(d => d.hora === hora).sort((a, b) => `${b.fecha}`.localeCompare(`${a.fecha}`)).slice(0, 5);
      const weekType = classifyWeek(recentForRadar);
      const godResult = godModePredict(drawsForDual, hora, fecha);

      const r = buildCartera(
        draws as any,
        rawRules as CarteraRule[],
        rawPatterns as CarteraPattern[],
        hora,
        statsByHora.get(hora),
        { strategy: ADAPTIVE_STRATEGY, godModeQuadrant: godResult?.quadrant ?? null, weekType }
      );
      
      const { error } = await supabaseAdmin.from("carteras").upsert([{
        fecha, hora, numeros: r.numeros, scores: r.scores as any, estrategia: ADAPTIVE_STRATEGY,
        contexto: JSON.parse(JSON.stringify({ ...r.contexto, reasons: r.reasons })) as any,
      }], { onConflict: "fecha,hora,estrategia" });
      
      if (!error) generated.push(hora);
      else console.error(`Error upserting ${hora}:`, error);
    } catch(e) {
      console.error(`Error building ${hora}:`, e);
    }
  }
  console.log("Successfully generated carteras for hours:", generated.join(", "));
}
run();
