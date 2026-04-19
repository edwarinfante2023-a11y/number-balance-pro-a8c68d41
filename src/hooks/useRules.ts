import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Database } from "@/integrations/supabase/types";

export type Rule = Database["public"]["Tables"]["rules"]["Row"];
export type InsertRule = Database["public"]["Tables"]["rules"]["Insert"];
export type UpdateRule = Database["public"]["Tables"]["rules"]["Update"];

export function useRules() {
  const queryClient = useQueryClient();

  const rulesQuery = useQuery({
    queryKey: ["rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rules")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Rule[];
    },
  });

  const createRule = useMutation({
    mutationFn: async (newRule: InsertRule) => {
      const { data, error } = await supabase.from("rules").insert(newRule).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Regla creada exitosamente");
      queryClient.invalidateQueries({ queryKey: ["rules"] });
    },
    onError: (error: any) => {
      toast.error("Error al crear regla", { description: error.message });
    },
  });

  const updateRule = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: UpdateRule }) => {
      const { data, error } = await supabase
        .from("rules")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rules"] });
    },
    onError: (error: any) => {
      toast.error("Error al actualizar regla", { description: error.message });
    },
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Regla eliminada exitosamente");
      queryClient.invalidateQueries({ queryKey: ["rules"] });
    },
    onError: (error: any) => {
      toast.error("Error al eliminar regla", { description: error.message });
    },
  });

  return {
    rules: rulesQuery.data ?? [],
    isLoading: rulesQuery.isLoading,
    isError: rulesQuery.isError,
    createRule,
    updateRule,
    deleteRule,
  };
}
