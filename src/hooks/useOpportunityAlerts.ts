import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export interface OpportunityAlertRow {
  id: string;
  fecha: string;
  hora: string;
  cartera_id: string;
  internal_score: number;
  top_mean: number;
  gap: number;
  notified_at: string | null;
  dismissed_at: string | null;
  created_at: string;
}

/** Trae alertas de oportunidad activas (no descartadas) de hoy. */
export function useActiveOpportunityAlerts() {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);

  const query = useQuery<OpportunityAlertRow[]>({
    queryKey: ["opportunity-alerts", "active", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("opportunity_alerts")
        .select("*")
        .eq("fecha", today)
        .is("dismissed_at", null)
        .order("hora", { ascending: true });
      if (error) throw error;
      return (data ?? []) as OpportunityAlertRow[];
    },
    refetchInterval: 60_000,
  });

  // Realtime: invalidar al detectar cambios
  useEffect(() => {
    const channel = supabase
      .channel("opportunity_alerts_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "opportunity_alerts" },
        () => {
          qc.invalidateQueries({ queryKey: ["opportunity-alerts"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  return query;
}

/** Marca una alerta como descartada. */
export async function dismissOpportunity(id: string) {
  await supabase
    .from("opportunity_alerts")
    .update({ dismissed_at: new Date().toISOString() })
    .eq("id", id);
}

/** Tracks IDs ya vistos en esta sesión para no duplicar toasts. */
export function useSeenAlertsState() {
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const markSeen = (id: string) => setSeen((s) => {
    if (s.has(id)) return s;
    const next = new Set(s);
    next.add(id);
    return next;
  });
  return { seen, markSeen };
}