import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Minería de Datos — Auto-descubrimiento de patrones (Arquitectura Cuadrantes)
 *
 * Escanea la historia de sorteos buscando correlaciones estadísticas ocultas
 * estrictamente enfocadas en transiciones de cuadrantes y bloqueos.
 * (Ignora predicción de números sueltos para maximizar el hit rate).
 */

interface MinedDraw {
  numero: number;
  fecha: string;
  hora: string;
}

interface Discovery {
  nombre: string;
  descripcion: string;
  tipo: string;
  condiciones: Record<string, unknown>;
  resultado_esperado: string;
  ocurrencias: number;
  aciertos: number;
  efectividad: number;
  hora: string | null;
}

const MIN_EFECTIVIDAD = 60;
const MIN_OCURRENCIAS = 20;
const MAX_PATTERNS_PER_RUN = 15;

const isAlto = (n: number) => n >= 50;
const isPar = (n: number) => n % 2 === 0;
const cuadrante = (n: number) => `${isAlto(n) ? "ALTO" : "BAJO"}_${isPar(n) ? "PAR" : "IMPAR"}`;

// ─── ALGORITMO 1: Racha de Cuadrante (Rebotes) ────────────────────────
// "Después de N consecutivos ALTO, ¿sale BAJO?"
function mineQuadrantStreak(draws: MinedDraw[]): Discovery[] {
  const results: Discovery[] = [];
  const dimensions: Array<{
    name: string;
    classify: (n: number) => string;
    values: [string, string];
  }> = [
    { name: "Rango", classify: (n) => (isAlto(n) ? "ALTO" : "BAJO"), values: ["ALTO", "BAJO"] },
    { name: "Paridad", classify: (n) => (isPar(n) ? "PAR" : "IMPAR"), values: ["PAR", "IMPAR"] },
  ];

  for (const dim of dimensions) {
    for (const streakValue of dim.values) {
      const opposite = dim.values.find((v) => v !== streakValue)!;

      for (const streakLen of [3, 4, 5]) {
        let total = 0;
        let hits = 0;

        for (let i = streakLen; i < draws.length; i++) {
          let isStreak = true;
          for (let j = 1; j <= streakLen; j++) {
            if (dim.classify(draws[i - j].numero) !== streakValue) {
              isStreak = false;
              break;
            }
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
            descripcion: `Después de ${streakLen} sorteos consecutivos ${streakValue}, el siguiente tiende a ser ${opposite} (${ef}% de ${total} veces).`,
            tipo: "compensacion",
            condiciones: { algorithm: "quadrant_streak", dimension: dim.name, streakValue, streakLen, opposite },
            resultado_esperado: opposite,
            ocurrencias: total,
            aciertos: hits,
            efectividad: ef,
            hora: null,
          });
        }
      }
    }
  }

  return results.sort((a, b) => b.efectividad - a.efectividad).slice(0, 4);
}

// ─── ALGORITMO 2: Transición de Bloqueos ─────────────────────────────
// "Cuando se rompe una racha de 3 Altos y sale un Bajo, ¿qué paridad tiene ese Bajo?"
// El cliente hipotetiza que asume la paridad contraria al último Alto. Vamos a minarlo.
function mineBlockTransition(draws: MinedDraw[]): Discovery[] {
  const results: Discovery[] = [];
  
  // Buscar bloqueos de Rango
  let totalBloqueos = 0;
  let hitsInvertedParity = 0;
  let hitsSameParity = 0;

  for (let i = 3; i < draws.length; i++) {
    const d1 = draws[i-3];
    const d2 = draws[i-2];
    const d3 = draws[i-1];
    const target = draws[i];

    const r1 = isAlto(d1.numero) ? "ALTO" : "BAJO";
    const r2 = isAlto(d2.numero) ? "ALTO" : "BAJO";
    const r3 = isAlto(d3.numero) ? "ALTO" : "BAJO";
    const rT = isAlto(target.numero) ? "ALTO" : "BAJO";

    // Si hubo una racha de 3 del mismo rango, y el target la rompió
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
        descripcion: `Cuando se rompe una racha de Rango, el bloqueo tiende a traer la paridad contraria al último sorteo (${efInverted}% de ${totalBloqueos} bloqueos).`,
        tipo: "bloqueo",
        condiciones: { algorithm: "block_transition", type: "inverted_parity" },
        resultado_esperado: "OPPOSITE_PARITY_BLOCK", // El motor ya maneja la inversión nativamente
        ocurrencias: totalBloqueos,
        aciertos: hitsInvertedParity,
        efectividad: efInverted,
        hora: null,
      });
    } else if (efSame >= MIN_EFECTIVIDAD) {
      results.push({
        nombre: `Bloqueo Rango → Paridad Mantenida`,
        descripcion: `Cuando se rompe una racha de Rango, el bloqueo tiende a mantener la paridad del último sorteo (${efSame}% de ${totalBloqueos} bloqueos).`,
        tipo: "bloqueo",
        condiciones: { algorithm: "block_transition", type: "same_parity" },
        resultado_esperado: "SAME_PARITY_BLOCK",
        ocurrencias: totalBloqueos,
        aciertos: hitsSameParity,
        efectividad: efSame,
        hora: null,
      });
    }
  }

  return results;
}

// ─── ALGORITMO 3: Día de Semana + Hora ──────────────────────────
// "Los martes a las 14:00, ¿salen más PARES o IMPARES?"
function mineDayHour(draws: MinedDraw[]): Discovery[] {
  const results: Discovery[] = [];
  const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const horas = [...new Set(draws.map((d) => d.hora))];

  for (let dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek++) {
    for (const hora of horas) {
      const matching = draws.filter((d) => {
        const dow = new Date(d.fecha + "T12:00:00").getDay();
        return dow === dayOfWeek && d.hora === hora;
      });

      if (matching.length < MIN_OCURRENCIAS) continue;

      const cuadranteCounts: Record<string, number> = {};
      for (const d of matching) {
        const q = cuadrante(d.numero);
        cuadranteCounts[q] = (cuadranteCounts[q] ?? 0) + 1;
      }

      for (const [q, count] of Object.entries(cuadranteCounts)) {
        const ef = Math.round((count / matching.length) * 100);
        if (ef >= MIN_EFECTIVIDAD) {
          results.push({
            nombre: `${dayNames[dayOfWeek]} ${hora} → ${q}`,
            descripcion: `Los ${dayNames[dayOfWeek]} a las ${hora}, el cuadrante ${q} domina (${ef}% de ${matching.length} sorteos).`,
            tipo: "patron",
            condiciones: { algorithm: "day_hour", dayOfWeek, hora, cuadrante: q },
            resultado_esperado: q,
            ocurrencias: matching.length,
            aciertos: count,
            efectividad: ef,
            hora,
          });
        }
      }
    }
  }

  return results.sort((a, b) => b.efectividad - a.efectividad).slice(0, 4);
}

// ─── ALGORITMO 4: Estacionalidad Mensual ────────────────────────
// "¿Hay cuadrantes que dominan solo en ciertos meses del año?"
function mineSeasonalMonthly(draws: MinedDraw[]): Discovery[] {
  const results: Discovery[] = [];
  const horas = [...new Set(draws.map((d) => d.hora))];
  const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

  for (const hora of horas) {
    const drawsHora = draws.filter((d) => d.hora === hora);
    if (drawsHora.length < 100) continue;

    const byMonth = new Map<number, MinedDraw[]>();
    for (const d of drawsHora) {
      const month = parseInt(d.fecha.split("-")[1], 10);
      if (!byMonth.has(month)) byMonth.set(month, []);
      byMonth.get(month)!.push(d);
    }

    const cuadrantes = ["ALTO_PAR", "ALTO_IMPAR", "BAJO_PAR", "BAJO_IMPAR"];
    for (const q of cuadrantes) {
      const monthlyEf: Array<{ month: number; ef: number; count: number; total: number }> = [];

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
            descripcion: `El cuadrante ${q} domina a las ${hora} durante ${monthLabels} con ${ef}% de efectividad (${totalOc} sorteos). Fuera de esos meses cae.`,
            tipo: "patron",
            condiciones: {
              algorithm: "seasonal_monthly",
              hora,
              cuadrante: q,
              active_months: activeMonthNums,
              monthly_breakdown: monthlyEf,
            },
            resultado_esperado: q,
            ocurrencias: totalOc,
            aciertos: totalHits,
            efectividad: ef,
            hora,
          });
        }
      }
    }
  }

  return results.sort((a, b) => b.efectividad - a.efectividad).slice(0, 5);
}

// ─── ENDPOINT ────────────────────────────────────────────────────
export const Route = createFileRoute("/api/public/hooks/mine-patterns")({
  server: {
    handlers: {
      OPTIONS: async () => {
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        });
      },
      POST: async () => {
        const startTime = Date.now();

        const { data: rawDraws, error: e1 } = await supabaseAdmin
          .from("draws")
          .select("numero, fecha, lottery_draws!inner(hora)")
          .order("fecha", { ascending: true })
          .limit(10000);

        if (e1) {
          return Response.json({ ok: false, error: e1.message }, { status: 500 });
        }

        const draws: MinedDraw[] = ((rawDraws ?? []) as any[]).map((r) => ({
          numero: r.numero,
          fecha: r.fecha,
          hora: r.lottery_draws?.hora ?? "00:00",
        }));

        if (draws.length < 100) {
          return Response.json({
            ok: true,
            skipped: true,
            reason: `Solo hay ${draws.length} sorteos, se necesitan al menos 100 para minería.`,
          });
        }

        const { data: existingPatterns } = await supabaseAdmin
          .from("patterns")
          .select("condiciones")
          .eq("source", "mined");

        const existingKeys = new Set(
          (existingPatterns ?? []).map((p: any) => JSON.stringify(p.condiciones)),
        );

        const allDiscoveries: Discovery[] = [
          ...mineQuadrantStreak(draws),
          ...mineBlockTransition(draws),
          ...mineDayHour(draws),
          ...mineSeasonalMonthly(draws),
        ];

        const newDiscoveries = allDiscoveries
          .filter((d) => !existingKeys.has(JSON.stringify(d.condiciones)))
          .slice(0, MAX_PATTERNS_PER_RUN);

        const inserted: string[] = [];
        for (const d of newDiscoveries) {
          const { data: row, error: ie } = await supabaseAdmin
            .from("patterns")
            .insert({
              nombre: d.nombre,
              descripcion: d.descripcion,
              tipo: d.tipo as any,
              condiciones: d.condiciones,
              resultado_esperado: d.resultado_esperado,
              ocurrencias: d.ocurrencias,
              aciertos: d.aciertos,
              efectividad: d.efectividad,
              hora: d.hora,
              activa: false,
              source: "mined",
              estado: "observacion",
              score_confianza: d.efectividad,
            } as any)
            .select("id")
            .single();

          if (!ie && row) {
            inserted.push((row as any).id);
          }
        }

        const elapsedMs = Date.now() - startTime;

        await supabaseAdmin.from("settings").upsert(
          [
            {
              clave: "pattern_mining_last_run",
              valor: {
                ranAt: new Date().toISOString(),
                drawsAnalyzed: draws.length,
                totalDiscoveries: allDiscoveries.length,
                newInserted: inserted.length,
                duplicatesSkipped: allDiscoveries.length - newDiscoveries.length,
                elapsedMs,
                discoveries: newDiscoveries.map((d) => ({
                  nombre: d.nombre,
                  efectividad: d.efectividad,
                  ocurrencias: d.ocurrencias,
                })),
              } as any,
            },
          ],
          { onConflict: "clave" },
        );

        return Response.json(
          {
            ok: true,
            drawsAnalyzed: draws.length,
            totalDiscoveries: allDiscoveries.length,
            newInserted: inserted.length,
            duplicatesSkipped: allDiscoveries.length - newDiscoveries.length,
            elapsedMs,
            discoveries: newDiscoveries.map((d) => ({
              nombre: d.nombre,
              efectividad: d.efectividad,
              ocurrencias: d.ocurrencias,
              descripcion: d.descripcion,
            })),
          },
          {
            headers: {
              "Access-Control-Allow-Origin": "*",
            },
          },
        );
      },
    },
  },
});
