import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Lottery = Database["public"]["Tables"]["lotteries"]["Row"];

export function useLotteries() {
  return useQuery({
    queryKey: ["lotteries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lotteries")
        .select("*")
        .eq("activa", true)
        .order("nombre");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateLottery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { nombre: string; descripcion?: string; horarios?: string[] }) => {
      const { data, error } = await supabase
        .from("lotteries")
        .insert({
          nombre: input.nombre,
          descripcion: input.descripcion ?? null,
          horarios: input.horarios ?? [],
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lotteries"] }),
  });
}
