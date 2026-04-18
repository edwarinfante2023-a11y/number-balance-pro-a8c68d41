import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Draw = Database["public"]["Tables"]["draws"]["Row"];
export type DrawInsert = Database["public"]["Tables"]["draws"]["Insert"];

export function useDraws(opts?: { limit?: number; loteria?: string; fecha?: string }) {
  return useQuery({
    queryKey: ["draws", opts],
    queryFn: async () => {
      let q = supabase
        .from("draws")
        .select("*")
        .order("fecha", { ascending: false })
        .order("hora", { ascending: false });
      if (opts?.loteria) q = q.eq("loteria", opts.loteria);
      if (opts?.fecha) q = q.eq("fecha", opts.fecha);
      if (opts?.limit) q = q.limit(opts.limit);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateDraw() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: Pick<DrawInsert, "fecha" | "hora" | "loteria" | "numero"> & {
        observacion?: string | null;
        movimiento?: string | null;
      },
    ) => {
      // alto_bajo, par_impar y cuadrante los calcula el trigger; pasamos placeholders
      const payload: DrawInsert = {
        fecha: input.fecha,
        hora: input.hora,
        loteria: input.loteria,
        numero: input.numero,
        alto_bajo: "BAJO",
        par_impar: "PAR",
        cuadrante: "BAJO_PAR",
        origen: "manual",
        observacion: input.observacion ?? null,
        movimiento: input.movimiento ?? null,
      };
      const { data, error } = await supabase
        .from("draws")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["draws"] });
    },
  });
}

export function useDeleteDraw() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("draws").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["draws"] }),
  });
}
