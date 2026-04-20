import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useLastSync() {
  return useQuery({
    queryKey: ["last-sync"],
    queryFn: async (): Promise<Date | null> => {
      const { data, error } = await supabase
        .from("draws")
        .select("created_at")
        .eq("origen", "scraper")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data?.created_at ? new Date(data.created_at) : null;
    },
    refetchInterval: 30_000, // refresca cada 30s
    staleTime: 15_000,
  });
}
