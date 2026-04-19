import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Database } from "@/integrations/supabase/types";

export type Pattern = Database["public"]["Tables"]["patterns"]["Row"];
export type InsertPattern = Database["public"]["Tables"]["patterns"]["Insert"];
export type UpdatePattern = Database["public"]["Tables"]["patterns"]["Update"];

export function usePatterns() {
  const queryClient = useQueryClient();

  const patternsQuery = useQuery({
    queryKey: ["patterns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patterns")
        .select("*")
        .order("efectividad", { ascending: false });

      if (error) throw error;
      return data as Pattern[];
    },
  });

  const createPattern = useMutation({
    mutationFn: async (newPattern: InsertPattern) => {
      const { data, error } = await supabase.from("patterns").insert(newPattern).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patterns"] });
    },
    onError: (error: any) => {
      console.error("Error al guardar patrón", error.message);
    },
  });

  const updatePattern = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: UpdatePattern }) => {
      const { data, error } = await supabase
        .from("patterns")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patterns"] });
    },
    onError: (error: any) => {
      console.error("Error al actualizar patrón", error.message);
    },
  });

  // Batch insert for miner
  const insertPatternsBatch = useMutation({
    mutationFn: async (patterns: InsertPattern[]) => {
      const { data, error } = await supabase.from("patterns").insert(patterns).select();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`${data ? data.length : 0} Nuevos patrones guardados`);
      queryClient.invalidateQueries({ queryKey: ["patterns"] });
    },
    onError: (error: any) => {
      toast.error("Error en minería batch", { description: error.message });
    },
  });

  return {
    patterns: patternsQuery.data ?? [],
    isLoading: patternsQuery.isLoading,
    isError: patternsQuery.isError,
    createPattern,
    updatePattern,
    insertPatternsBatch,
  };
}
