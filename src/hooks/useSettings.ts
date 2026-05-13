import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { defaultConfig, type ClassificationConfig } from "@shared/lottery";
import type { Json } from "@/integrations/supabase/types";

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
          [{ clave: "balance_alerts", valor: cfg as unknown as Json }],
          { onConflict: "clave" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings", "balance_alerts"] });
    },
  });
}

// ─── Pattern Learning Settings (Nivel B auto-promoción) ────────────────

export interface PatternLearningConfig {
  enabled: boolean;
  promote: { minOcurrencias: number; minEfectividad: number };
  descarte: { minOcurrencias: number; maxEfectividad: number };
}

export const defaultPatternLearning: PatternLearningConfig = {
  enabled: true,
  promote: { minOcurrencias: 20, minEfectividad: 60 },
  descarte: { minOcurrencias: 50, maxEfectividad: 40 },
};

export interface PatternLearningLastRun {
  ranAt: string;
  evaluated: number;
  promoted: number;
  descarted: number;
  log: Array<{
    id: string;
    nombre: string;
    from: string;
    to: string;
    ocurrencias: number;
    efectividad: number;
  }>;
}

export function usePatternLearningConfig() {
  return useQuery({
    queryKey: ["settings", "pattern_learning"],
    queryFn: async (): Promise<PatternLearningConfig> => {
      const { data, error } = await supabase
        .from("settings")
        .select("valor")
        .eq("clave", "pattern_learning")
        .maybeSingle();
      if (error) throw error;
      const v = (data?.valor as Partial<PatternLearningConfig> | null) ?? null;
      return {
        enabled: v?.enabled ?? defaultPatternLearning.enabled,
        promote: {
          minOcurrencias: v?.promote?.minOcurrencias ?? defaultPatternLearning.promote.minOcurrencias,
          minEfectividad: v?.promote?.minEfectividad ?? defaultPatternLearning.promote.minEfectividad,
        },
        descarte: {
          minOcurrencias: v?.descarte?.minOcurrencias ?? defaultPatternLearning.descarte.minOcurrencias,
          maxEfectividad: v?.descarte?.maxEfectividad ?? defaultPatternLearning.descarte.maxEfectividad,
        },
      };
    },
  });
}

export function useUpdatePatternLearningConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cfg: PatternLearningConfig) => {
      const { error } = await supabase
        .from("settings")
        .upsert(
          [{ clave: "pattern_learning", valor: cfg as unknown as Json }],
          { onConflict: "clave" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings", "pattern_learning"] });
    },
  });
}

export function usePatternLearningLastRun() {
  return useQuery({
    queryKey: ["settings", "pattern_learning_last_run"],
    queryFn: async (): Promise<PatternLearningLastRun | null> => {
      const { data, error } = await supabase
        .from("settings")
        .select("valor")
        .eq("clave", "pattern_learning_last_run")
        .maybeSingle();
      if (error) throw error;
      return (data?.valor as PatternLearningLastRun | null) ?? null;
    },
    refetchInterval: 60_000,
  });
}

// ─── Payouts (pagos por posición) ──────────────────────────────────────

export interface PayoutsConfig {
  /** Apuesta por número (DOP) */
  apuesta: number;
  /** Múltiplo pagado por 1er premio */
  pago1: number;
  /** Múltiplo pagado por 2do premio */
  pago2: number;
  /** Múltiplo pagado por 3er premio */
  pago3: number;
}

export const defaultPayouts: PayoutsConfig = {
  apuesta: 25,
  pago1: 70,
  pago2: 10,
  pago3: 4,
};

export function usePayouts() {
  return useQuery({
    queryKey: ["settings", "payouts"],
    queryFn: async (): Promise<PayoutsConfig> => {
      const { data, error } = await supabase
        .from("settings")
        .select("valor")
        .eq("clave", "payouts")
        .maybeSingle();
      if (error) throw error;
      const v = (data?.valor as Partial<PayoutsConfig> | null) ?? null;
      return {
        apuesta: Number(v?.apuesta ?? defaultPayouts.apuesta),
        pago1: Number(v?.pago1 ?? defaultPayouts.pago1),
        pago2: Number(v?.pago2 ?? defaultPayouts.pago2),
        pago3: Number(v?.pago3 ?? defaultPayouts.pago3),
      };
    },
  });
}

export function useUpdatePayouts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cfg: PayoutsConfig) => {
      const { error } = await supabase
        .from("settings")
        .upsert(
          [{ clave: "payouts", valor: cfg as unknown as Json }],
          { onConflict: "clave" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings", "payouts"] });
      qc.invalidateQueries({ queryKey: ["bankroll-sim"] });
    },
  });
}
