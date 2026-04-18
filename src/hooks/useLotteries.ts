import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Lottery = Database["public"]["Tables"]["lotteries"]["Row"];
export type LotteryDraw = Database["public"]["Tables"]["lottery_draws"]["Row"];

export interface LotteryWithDraws extends Lottery {
  draws: LotteryDraw[];
}

/** Loterías madre con sus sorteos horarios anidados. */
export function useLotteries() {
  return useQuery({
    queryKey: ["lotteries"],
    queryFn: async (): Promise<LotteryWithDraws[]> => {
      const { data, error } = await supabase
        .from("lotteries")
        .select("*, draws:lottery_draws(*)")
        .eq("activa", true)
        .order("nombre");
      if (error) throw error;
      return (data ?? []).map((l) => ({
        ...l,
        draws: ((l as { draws?: LotteryDraw[] }).draws ?? [])
          .filter((d) => d.activa)
          .sort((a, b) => a.hora.localeCompare(b.hora)),
      }));
    },
  });
}

/** Sorteos horarios planos (con nombre de lotería madre). */
export function useLotteryDraws() {
  return useQuery({
    queryKey: ["lottery_draws"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lottery_draws")
        .select("*, lotteries!inner(nombre, activa)")
        .eq("activa", true)
        .order("hora");
      if (error) throw error;
      return (data ?? []).filter(
        (d) => (d as { lotteries: { activa: boolean } }).lotteries.activa,
      );
    },
  });
}

export function useCreateLottery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { nombre: string; descripcion?: string }) => {
      const { data, error } = await supabase
        .from("lotteries")
        .insert({
          nombre: input.nombre,
          descripcion: input.descripcion ?? null,
          horarios: [],
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lotteries"] }),
  });
}

export function useDeleteLottery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lotteries").update({ activa: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lotteries"] });
      qc.invalidateQueries({ queryKey: ["lottery_draws"] });
    },
  });
}

export function useCreateLotteryDraw() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { loteria_id: string; hora: string; nombre?: string }) => {
      const nombre = input.nombre?.trim() || `Sorteo ${input.hora}`;
      const { data, error } = await supabase
        .from("lottery_draws")
        .insert({
          loteria_id: input.loteria_id,
          hora: input.hora,
          nombre,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lotteries"] });
      qc.invalidateQueries({ queryKey: ["lottery_draws"] });
    },
  });
}

export function useDeleteLotteryDraw() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("lottery_draws")
        .update({ activa: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lotteries"] });
      qc.invalidateQueries({ queryKey: ["lottery_draws"] });
    },
  });
}
