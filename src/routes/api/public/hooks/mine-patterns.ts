import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Minería de Datos — Auto-descubrimiento de patrones.
 *
 * Escanea toda la historia de sorteos con 5 algoritmos distintos
 * buscando correlaciones estadísticas ocultas.
 *
 * Cuando encuentra una regla con ≥60% de efectividad y ≥20 ocurrencias,
 * la registra como patrón nuevo en estado 'observacion'.
 *
 * Programado: Domingos a las 3:00 AM (después del robot de aprendizaje).
 */

// ─── Tipos internos ──────────────────────────────────────────────
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

// ─── Configuración ───────────────────────────────────────────────
const MIN_EFECTIVIDAD = 60;
const MIN_OCURRENCIAS = 20;
const MAX_PATTERNS_PER_RUN = 15; // limitar para no saturar

// ─── Helpers ─────────────────────────────────────────────────────
const isAlto = (n: number) => n >= 50;
const isPar = (n: number) => n % 2 === 0;
const lastDigit = (n: number) => n % 10;
const cuadrante = (n: number) =>
  `${isAlto(n) ? "ALTO" : "BAJO"}_${isPar(n) ? "PAR" : "IMPAR"}`;

// ─── ALGORITMO 1: Secuencial ────────────────────────────────────
// "Después de que sale X, ¿qué número Y tiende a salir en los próximos 3?"
function mineSequential(draws: MinedDraw[]): Discovery[] {
  const results: Discovery[] = [];
  const LOOKAHEAD = 3;

  // Solo analizar los top 30 números más frecuentes para evitar explosión combinatoria
  const freq = new Map<number, number>();
  for (const d of draws) freq.set(d.numero, (freq.get(d.numero) ?? 0) + 1);
  const topNums = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([n]) => n);

  for (const trigger of topNums) {
    const followers = new Map<number, { total: number; hits: number }>();

    for (let i = 0; i < draws.length - LOOKAHEAD; i++) {
      if (draws[i].numero !== trigger) continue;
      const nextNums = new Set(
        draws.slice(i + 1, i + 1 + LOOKAHEAD).map((d) => d.numero),
      );
      for (const n of topNums) {
        if (n === trigger) continue;
        const entry = followers.get(n) ?? { total: 0, hits: 0 };
        entry.total++;
        if (nextNums.has(n)) entry.hits++;
        followers.set(n, entry);
      }
    }

    for (const [follower, stats] of followers) {
      if (stats.total < MIN_OCURRENCIAS) continue;
      const ef = Math.round((stats.hits / stats.total) * 100);
      if (ef >= MIN_EFECTIVIDAD) {
        results.push({
          nombre: `Secuencia ${trigger}→${follower}`,
          descripcion: `Cuando sale el ${trigger}, el ${follower} tiende a aparecer en los siguientes ${LOOKAHEAD} sorteos (${ef}% de ${stats.total} veces).`,
          tipo: "patron",
          condiciones: { algorithm: "sequential", trigger, follower, lookahead: LOOKAHEAD },
          resultado_esperado: String(follower),
          ocurrencias: stats.total,
          aciertos: stats.hits,
          efectividad: ef,
          hora: null,
        });
      }
    }
  }

  return results.sort((a, b) => b.efectividad - a.efectividad).slice(0, 5);
}

// ─── ALGORITMO 2: Último Dígito ─────────────────────────────────
// "Si el último dígito fue 3, ¿qué dígito tiende a seguir?"
function mineLastDigit(draws: MinedDraw[]): Discovery[] {
  const results: Discovery[] = [];

  for (let triggerDigit = 0; triggerDigit <= 9; triggerDigit++) {
    const followers = new Map<number, { total: number; hits: number }>();

    for (let i = 0; i < draws.length - 1; i++) {
      if (lastDigit(draws[i].numero) !== triggerDigit) continue;
      const nextDigit = lastDigit(draws[i + 1].numero);
      for (let d = 0; d <= 9; d++) {
        const entry = followers.get(d) ?? { total: 0, hits: 0 };
        entry.total++;
        if (nextDigit === d) entry.hits++;
        followers.set(d, entry);
      }
    }

    for (const [followDigit, stats] of followers) {
      if (stats.total < MIN_OCURRENCIAS) continue;
      const ef = Math.round((stats.hits / stats.total) * 100);
      if (ef >= MIN_EFECTIVIDAD) {
        results.push({
          nombre: `Eco-Dígito ${triggerDigit}→${followDigit}`,
          descripcion: `Cuando el número termina en ${triggerDigit}, el siguiente sorteo tiende a terminar en ${followDigit} (${ef}% de ${stats.total} veces).`,
          tipo: "patron",
          condiciones: { algorithm: "last_digit", triggerDigit, followDigit },
          resultado_esperado: `*${followDigit}`,
          ocurrencias: stats.total,
          aciertos: stats.hits,
          efectividad: ef,
          hora: null,
        });
      }
    }
  }

  return results.sort((a, b) => b.efectividad - a.efectividad).slice(0, 3);
}

// ─── ALGORITMO 3: Racha de Cuadrante ────────────────────────────
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
          // Verificar si los últimos streakLen sorteos son todos del mismo valor
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

// ─── ALGORITMO 4: Gap (Hueco) ───────────────────────────────────
// "Cuando el número X lleva N+ sorteos sin salir, ¿aparece pronto?"
function mineGap(draws: MinedDraw[]): Discovery[] {
  const results: Discovery[] = [];
  const GAP_THRESHOLDS = [10, 15, 20];
  const LOOKAHEAD = 5;

  // Solo los 20 números más frecuentes
  const freq = new Map<number, number>();
  for (const d of draws) freq.set(d.numero, (freq.get(d.numero) ?? 0) + 1);
  const topNums = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([n]) => n);

  for (const num of topNums) {
    for (const gapThreshold of GAP_THRESHOLDS) {
      let total = 0;
      let hits = 0;

      // Rastrear el gap actual de este número
      let currentGap = 0;
      for (let i = 0; i < draws.length - LOOKAHEAD; i++) {
        if (draws[i].numero === num) {
          currentGap = 0;
        } else {
          currentGap++;
        }

        if (currentGap === gapThreshold) {
          total++;
          // ¿Aparece en los próximos LOOKAHEAD sorteos?
          const nextNums = draws.slice(i + 1, i + 1 + LOOKAHEAD).map((d) => d.numero);
          if (nextNums.includes(num)) hits++;
        }
      }

      if (total < MIN_OCURRENCIAS) continue;
      const ef = Math.round((hits / total) * 100);
      if (ef >= MIN_EFECTIVIDAD) {
        results.push({
          nombre: `Gap Explosivo #${num} (${gapThreshold}+)`,
          descripcion: `Cuando el ${num} lleva ${gapThreshold}+ sorteos sin salir, tiende a aparecer en los próximos ${LOOKAHEAD} (${ef}% de ${total} veces).`,
          tipo: "patron",
          condiciones: { algorithm: "gap", numero: num, gapThreshold, lookahead: LOOKAHEAD },
          resultado_esperado: String(num),
          ocurrencias: total,
          aciertos: hits,
          efectividad: ef,
          hora: null,
        });
      }
    }
  }

  return results.sort((a, b) => b.efectividad - a.efectividad).slice(0, 4);
}

// ─── ALGORITMO 5: Día de Semana + Hora ──────────────────────────
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

      // Analizar cuadrantes
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

        // 1. Cargar toda la historia de sorteos
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

        // 2. Cargar patrones existentes para evitar duplicados
        const { data: existingPatterns } = await supabaseAdmin
          .from("patterns")
          .select("condiciones")
          .eq("source", "mined");

        const existingKeys = new Set(
          (existingPatterns ?? []).map((p: any) => JSON.stringify(p.condiciones)),
        );

        // 3. Ejecutar los 5 algoritmos de minería
        const allDiscoveries: Discovery[] = [
          ...mineSequential(draws),
          ...mineLastDigit(draws),
          ...mineQuadrantStreak(draws),
          ...mineGap(draws),
          ...mineDayHour(draws),
        ];

        // 4. Filtrar duplicados y limitar
        const newDiscoveries = allDiscoveries
          .filter((d) => !existingKeys.has(JSON.stringify(d.condiciones)))
          .slice(0, MAX_PATTERNS_PER_RUN);

        // 5. Insertar nuevos patrones descubiertos
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

        // 6. Guardar log del último mining run
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
