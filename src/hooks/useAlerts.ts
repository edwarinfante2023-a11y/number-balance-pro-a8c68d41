import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { AlertRow, AlertInsert } from "@shared/alertsEngine";
import { subDays, format } from "date-fns";

export function useAlerts() {
  const queryClient = useQueryClient();

  const { data: alerts = [], isLoading, isError } = useQuery({
    queryKey: ["alerts"],
    queryFn: async () => {
      // Tomamos solo las de los ultimos 3 dias para no saturar memoria
      const dateLimit = format(subDays(new Date(), 3), "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("alerts")
        .select("*")
        .gte("fecha", dateLimit)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching alerts:", error);
        throw error;
      }

      return data as AlertRow[];
    },
    staleTime: 60 * 1000, 
  });

  const insertBatchAlerts = useMutation({
    mutationFn: async (newAlerts: AlertInsert[]) => {
      if (newAlerts.length === 0) return [];
      
      const { data, error } = await supabase
        .from("alerts")
        .insert(newAlerts)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data && data.length > 0) {
        queryClient.invalidateQueries({ queryKey: ["alerts"] });
        
        // Buscamos la critical
        const criticals = data.filter(d => d.nivel === 'critical');
        if (criticals.length > 0) {
          toast.error("¡Alerta Crítica Detectada!", {
            description: `Se detectaron ${data.length} nuevas alertas. (Score máximo detectado: ${Math.max(...data.map(d => d.score))})`,
          });
        }
      }
    },
  });

  const updateAlertState = useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: "new" | "seen" | "dismissed" }) => {
      const { error } = await supabase
        .from("alerts")
        .update({ estado, activa: estado !== "dismissed" })
        .eq("id", id);
      if (error) throw error;
      return { id, estado };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
  });

  const dismissAll = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("alerts")
        .update({ estado: "dismissed", activa: false })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      toast.success("Bandeja limpiada", {
        description: "Las alertas seleccionadas fueron descartadas.",
      });
    },
  });

  const unreadCount = alerts.filter(a => a.estado === "new").length;

  return {
    alerts,
    isLoading,
    isError,
    unreadCount,
    insertBatchAlerts,
    updateAlertState,
    dismissAll,
  };
}
