import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { defaultConfig, type ClassificationConfig } from "@shared/lottery";

export function useClassificationConfig() {
  return useQuery({
    queryKey: ["settings", "classification"],
    queryFn: async (): Promise<ClassificationConfig> => {
      const { data, error } = await supabase
        .from("settings")
        .select("valor")
        .eq("clave", "classification")
        .maybeSingle();
      if (error) throw error;
      const v = data?.valor as Partial<ClassificationConfig> | null;
      return {
        rangeMin: v?.rangeMin ?? defaultConfig.rangeMin,
        rangeMax: v?.rangeMax ?? defaultConfig.rangeMax,
        altoThreshold: v?.altoThreshold ?? defaultConfig.altoThreshold,
      };
    },
  });
}

export function useUpdateClassificationConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cfg: ClassificationConfig) => {
      const { error } = await supabase
        .from("settings")
        .update({ valor: cfg as unknown as Record<string, number> })
        .eq("clave", "classification");
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      qc.invalidateQueries({ queryKey: ["draws"] });
    },
  });
}
