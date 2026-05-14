import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  evaluateDualSystem,
  type DualSystemState,
} from "@/lib/carteraEngine";
import { formatDateInTimeZone } from "@/lib/timezone";

/**
 * Hook reactivo del Sistema Dual AI.
 * Descarga los sorteos recientes, clasifica la semana, y evalúa el Motor Dios.
 */
export function useDualSystem(hora: string | null) {
  const today = formatDateInTimeZone();

  return useQuery<DualSystemState | null>({
    queryKey: ["dual-system", hora, today],
    enabled: !!hora,
    staleTime: 5 * 60 * 1000, // Refrescar cada 5 minutos
    queryFn: async () => {
      if (!hora) return null;

      // Traer suficientes draws para el Modo Dios (necesita historial profundo)
      const { data: rawDraws, error } = await supabase
        .from("draws")
        .select("numero, fecha, lottery_draws!inner(hora)")
        .order("fecha", { ascending: false })
        .limit(5000);

      if (error) throw error;

      const allDraws = (rawDraws ?? []).map((r: any) => ({
        numero: r.numero as number,
        fecha: r.fecha as string,
        hora: r.lottery_draws?.hora as string,
      }));

      return evaluateDualSystem(allDraws, hora, today);
    },
  });
}

/**
 * Hook simplificado para el Dashboard: evalúa el estado global del sistema
 * usando la hora más reciente que tenga datos.
 */
export function useDualSystemGlobal() {
  const today = formatDateInTimeZone();

  return useQuery<DualSystemState & { hora: string } | null>({
    queryKey: ["dual-system-global", today],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      // Traer los últimos sorteos
      const { data: rawDraws, error } = await supabase
        .from("draws")
        .select("numero, fecha, lottery_draws!inner(hora)")
        .order("fecha", { ascending: false })
        .limit(5000);

      if (error) throw error;
      if (!rawDraws || rawDraws.length === 0) return null;

      const allDraws = (rawDraws ?? []).map((r: any) => ({
        numero: r.numero as number,
        fecha: r.fecha as string,
        hora: r.lottery_draws?.hora as string,
      }));

      // Encontrar la hora más reciente con datos de hoy (o la última disponible)
      const todayDraws = allDraws.filter(d => d.fecha === today);
      const latestHora = todayDraws.length > 0
        ? todayDraws.sort((a, b) => b.hora.localeCompare(a.hora))[0].hora
        : allDraws[0].hora;

      const state = evaluateDualSystem(allDraws, latestHora, today);

      return { ...state, hora: latestHora };
    },
  });
}
