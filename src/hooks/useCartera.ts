import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  buildCartera,
  computeRollingStats,
  type CarteraResult,
  type CarteraStatRow,
  type CarteraRule,
  type CarteraPattern,
} from "@/lib/carteraEngine";
import type { Draw } from "@/hooks/useDraws";

/** Genera y persiste la cartera de la fecha+hora pedida (idempotente por unique). */
export function useGenerateCartera() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { hora: string; fecha?: string }) => {
      const fecha = input.fecha ?? new Date().toISOString().slice(0, 10);

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
            scores: result.scores,
            estrategia: result.contexto.estrategia,
            contexto: { ...result.contexto, reasons: result.reasons },
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
  const f = fecha ?? new Date().toISOString().slice(0, 10);
  return useQuery({
    queryKey: ["carteras", f, hora],
    enabled: !!hora,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("carteras")
        .select("*")
        .eq("fecha", f)
        .eq("hora", hora!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** Todas las carteras de un día (todas las horas). */
export function useCarterasDelDia(fecha?: string) {
  const f = fecha ?? new Date().toISOString().slice(0, 10);
  return useQuery({
    queryKey: ["carteras-dia", f],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("carteras")
        .select("id, fecha, hora, numeros, contexto, created_at")
        .eq("fecha", f)
        .order("hora", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Stats rolling: trae los resultados evaluados en los últimos `dias` y agrega. */
export function useCarteraStats(dias = 90) {
  return useQuery({
    queryKey: ["cartera-stats", dias],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - dias);
      const sinceStr = since.toISOString().slice(0, 10);

      // Join cartera_resultados → carteras
      const { data, error } = await supabase
        .from("cartera_resultados")
        .select("cartera_id, numero_ganador, acierto, evaluated_at, carteras!inner(fecha, hora)")
        .gte("evaluated_at", since.toISOString())
        .limit(5000);
      if (error) throw error;

      const rows: CarteraStatRow[] = (data ?? []).map((r: any) => ({
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