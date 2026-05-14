import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ADAPTIVE_STRATEGY,
  buildCartera,
  computeRollingStats,
  type CarteraResult,
  type CarteraStatRow,
  type CarteraRule,
  type CarteraPattern,
} from "@/lib/carteraEngine";
import type { Draw } from "@/hooks/useDraws";
import { daysAgoDateInTimeZone, formatDateInTimeZone } from "@/lib/timezone";

/** Genera y persiste la cartera de la fecha+hora pedida (idempotente por unique). */
export function useGenerateCartera() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { hora: string; fecha?: string }) => {
      const fecha = input.fecha ?? formatDateInTimeZone();

      // Cargar inputs
      const [{ data: rawDraws, error: e1 }, { data: rawRules, error: e2 }, { data: rawPatterns, error: e3 }] =
        await Promise.all([
          supabase
            .from("draws")
            .select("*, lottery_draws!inner(id, hora, nombre, loteria_id, lotteries!inner(id, nombre))")
            .order("fecha", { ascending: false })
            .limit(5000),
          supabase.from("rules").select("id,nombre,resultado_esperado,efectividad,activo").eq("activo", true),
          supabase
            .from("patterns")
            .select("id,nombre,resultado_esperado,efectividad,hora,activa,estado")
            .eq("activa", true),
        ]);
      if (e1) throw e1;
      if (e2) throw e2;
      if (e3) throw e3;

      const draws: Draw[] = (rawDraws ?? []).map((r: any) => ({
        ...r,
        hora: r.lottery_draws.hora,
        loteria: r.lottery_draws.lotteries.nombre,
        loteria_id: r.lottery_draws.loteria_id,
        sorteo_nombre: r.lottery_draws.nombre,
      }));

      const result: CarteraResult = buildCartera(
        draws,
        (rawRules ?? []) as CarteraRule[],
        (rawPatterns ?? []) as CarteraPattern[],
        input.hora,
      );

      // Upsert (idempotente por (fecha, hora, estrategia))
      const { data, error } = await supabase
        .from("carteras")
        .upsert(
          [{
            fecha,
            hora: input.hora,
            numeros: result.numeros,
            scores: result.scores as any,
            estrategia: ADAPTIVE_STRATEGY,
            contexto: JSON.parse(JSON.stringify({ ...result.contexto, reasons: result.reasons })) as any,
          }],
          { onConflict: "fecha,hora,estrategia" },
        )
        .select()
        .single();
      if (error) throw error;
      return { row: data, result };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["carteras"] });
      qc.invalidateQueries({ queryKey: ["cartera-stats"] });
    },
  });
}

/** Última cartera para una fecha+hora (o null). */
export function useCarteraDelDia(hora: string | null, fecha?: string) {
  const f = fecha ?? formatDateInTimeZone();
  return useQuery({
    queryKey: ["carteras", f, hora],
    enabled: !!hora,
    queryFn: async () => {
      // Primero buscar cartera con la estrategia adaptativa actual
      const { data, error } = await supabase
        .from("carteras")
        .select("*")
        .eq("fecha", f)
        .eq("hora", hora!)
        .eq("estrategia", ADAPTIVE_STRATEGY)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (data) return data;

      // Fallback: buscar cualquier estrategia (para warm-up)
      const { data: fallback, error: fallbackError } = await supabase
        .from("carteras")
        .select("*")
        .eq("fecha", f)
        .eq("hora", hora!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (fallbackError) throw fallbackError;
      // Validar que el fallback tenga la estructura mínima esperada
      if (fallback && Array.isArray(fallback.numeros) && fallback.numeros.length > 0) {
        return fallback;
      }
      return null;
    },
  });
}

/** Todas las carteras de un día (todas las horas). */
export function useCarterasDelDia(fecha?: string) {
  const f = fecha ?? formatDateInTimeZone();
  return useQuery({
    queryKey: ["carteras-dia", f],
    queryFn: async () => {
      // Intentar primero solo con la estrategia adaptativa
      const { data, error } = await supabase
        .from("carteras")
        .select("id, fecha, hora, numeros, scores, contexto, created_at, estrategia, cartera_resultados ( acierto, numero_ganador, acierto_segundo, numero_segundo, acierto_tercero, numero_tercero, evaluated_at )")
        .eq("fecha", f)
        .eq("estrategia", ADAPTIVE_STRATEGY)
        .order("hora", { ascending: true });
      if (error) throw error;
      if (data && data.length > 0) return data;

      // Fallback: traer todas las estrategias, deduplicar por hora
      const { data: allData, error: allError } = await supabase
        .from("carteras")
        .select("id, fecha, hora, numeros, scores, contexto, created_at, estrategia, cartera_resultados ( acierto, numero_ganador, acierto_segundo, numero_segundo, acierto_tercero, numero_tercero, evaluated_at )")
        .eq("fecha", f)
        .order("hora", { ascending: true });
      if (allError) throw allError;
      const byHour = new Map<string, any>();
      for (const row of allData ?? []) {
        const current = byHour.get(row.hora);
        if (!current || row.estrategia === ADAPTIVE_STRATEGY) {
          byHour.set(row.hora, row);
        }
      }
      return Array.from(byHour.values()).sort((a, b) => a.hora.localeCompare(b.hora));
    },
  });
}

/** Stats rolling: trae los resultados evaluados en los últimos `dias` y agrega. */
export function useCarteraStats(dias = 90) {
  return useQuery({
    queryKey: ["cartera-stats", dias],
    queryFn: async () => {
      const sinceStr = daysAgoDateInTimeZone(dias);
      const since = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

      // Join cartera_resultados → carteras
      const { data, error } = await supabase
        .from("cartera_resultados")
        .select("cartera_id, numero_ganador, acierto, evaluated_at, carteras!inner(fecha, hora, estrategia)")
        .gte("evaluated_at", since.toISOString())
        .limit(5000);
      if (error) throw error;

      const byKey = new Map<string, any>();
      for (const r of data ?? []) {
        const key = `${r.carteras.fecha}-${r.carteras.hora}`;
        const current = byKey.get(key);
        if (!current || r.carteras.estrategia === ADAPTIVE_STRATEGY) {
          byKey.set(key, r);
        }
      }

      const rows: CarteraStatRow[] = Array.from(byKey.values()).map((r: any) => ({
        cartera_id: r.cartera_id,
        fecha: r.carteras.fecha,
        hora: r.carteras.hora,
        acierto: r.acierto,
        numero_ganador: r.numero_ganador,
      })).filter((r) => r.fecha >= sinceStr);

      return computeRollingStats(rows);
    },
  });
}
