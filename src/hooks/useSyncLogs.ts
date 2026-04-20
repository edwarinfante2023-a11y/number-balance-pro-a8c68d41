import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SyncLog {
  id: string;
  ok: boolean;
  total_procesadas: number;
  nuevas: number;
  duplicadas: number;
  errores: number;
  detalle: string[];
  created_at: string;
}

export function useSyncLogs(limit = 20) {
  return useQuery({
    queryKey: ["sync-logs", limit],
    queryFn: async (): Promise<SyncLog[]> => {
      const { data, error } = await supabase
        .from("sync_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data ?? []).map((row) => ({
        ...row,
        detalle: Array.isArray(row.detalle) ? (row.detalle as string[]) : [],
      })) as SyncLog[];
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}
