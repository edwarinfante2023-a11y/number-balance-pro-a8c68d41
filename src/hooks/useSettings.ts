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

// ─── Balance Alerts Settings ───────────────────────────────────────────

export interface BalanceAlertsConfig {
  /** Δ% mínimo respecto a 50 para disparar alerta */
  threshold: number;
  /** Mínimo de sorteos en la franja horaria para considerar la métrica */
  minSamples: number;
  /** Master switch */
  enabled: boolean;
  /** Monitorear Alto/Bajo */
  watchAB: boolean;
  /** Monitorear Par/Impar */
  watchPI: boolean;
}

export const defaultBalanceAlerts: BalanceAlertsConfig = {
  threshold: 15,
  minSamples: 5,
  enabled: true,
  watchAB: true,
  watchPI: true,
};

export function useBalanceAlertsConfig() {
  return useQuery({
    queryKey: ["settings", "balance_alerts"],
    queryFn: async (): Promise<BalanceAlertsConfig> => {
      const { data, error } = await supabase
        .from("settings")
        .select("valor")
        .eq("clave", "balance_alerts")
        .maybeSingle();
      if (error) throw error;
      const v = (data?.valor as Partial<BalanceAlertsConfig> | null) ?? null;
      return {
        threshold: v?.threshold ?? defaultBalanceAlerts.threshold,
        minSamples: v?.minSamples ?? defaultBalanceAlerts.minSamples,
        enabled: v?.enabled ?? defaultBalanceAlerts.enabled,
        watchAB: v?.watchAB ?? defaultBalanceAlerts.watchAB,
        watchPI: v?.watchPI ?? defaultBalanceAlerts.watchPI,
      };
    },
  });
}

export function useUpdateBalanceAlertsConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cfg: BalanceAlertsConfig) => {
      const { error } = await supabase
        .from("settings")
        .upsert(
          { clave: "balance_alerts", valor: cfg as unknown as Record<string, unknown> },
          { onConflict: "clave" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings", "balance_alerts"] });
    },
  });
}
