import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type OpportunityHistoryRow = {
  id: string;
  fecha: string;
  hora: string;
  internal_score: number;
  gap: number;
  top_mean: number;
  cartera_id: string;
  created_at: string;
  notified_at: string | null;
  dismissed_at: string | null;
  acierto: boolean | null;
  numero_ganador: number | null;
  numeros: number[] | null;
  cartera_created_at: string | null;
  scores: Record<string, number> | null;
};

export function useOpportunityHistory(limit = 200) {
  return useQuery({
    queryKey: ["opportunity_history", limit],
    queryFn: async (): Promise<OpportunityHistoryRow[]> => {
      const { data, error } = await supabase
        .from("opportunity_alerts")
        .select(
          `id, fecha, hora, internal_score, gap, top_mean, cartera_id, created_at, notified_at, dismissed_at,
           carteras:cartera_id ( numeros, scores, created_at ),
           cartera_resultados:cartera_id ( acierto, numero_ganador )`,
        )
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data ?? []).map((r: any) => {
        const res = Array.isArray(r.cartera_resultados)
          ? r.cartera_resultados[0]
          : r.cartera_resultados;
        const cart = Array.isArray(r.carteras) ? r.carteras[0] : r.carteras;
        return {
          id: r.id,
          fecha: r.fecha,
          hora: r.hora,
          internal_score: r.internal_score ?? 0,
          gap: Number(r.gap ?? 0),
          top_mean: Number(r.top_mean ?? 0),
          cartera_id: r.cartera_id,
          created_at: r.created_at,
          notified_at: r.notified_at,
          dismissed_at: r.dismissed_at,
          acierto: res?.acierto ?? null,
          numero_ganador: res?.numero_ganador ?? null,
          numeros: cart?.numeros ?? null,
          cartera_created_at: cart?.created_at ?? null,
          scores: cart?.scores ?? null,
        };
      });
    },
    staleTime: 30_000,
  });
}

export type ScoreBucket = {
  label: string;
  min: number;
  max: number;
  total: number;
  evaluadas: number;
  aciertos: number;
  hitRate: number | null;
};

export function bucketByScore(rows: OpportunityHistoryRow[]): ScoreBucket[] {
  const ranges: Array<Omit<ScoreBucket, "total" | "evaluadas" | "aciertos" | "hitRate">> = [
    { label: "60–69", min: 60, max: 69 },
    { label: "70–79", min: 70, max: 79 },
    { label: "80–89", min: 80, max: 89 },
    { label: "90–100", min: 90, max: 100 },
  ];

  return ranges.map((r) => {
    const inRange = rows.filter(
      (x) => x.internal_score >= r.min && x.internal_score <= r.max,
    );
    const evaluadas = inRange.filter((x) => x.acierto !== null);
    const aciertos = evaluadas.filter((x) => x.acierto === true).length;
    return {
      ...r,
      total: inRange.length,
      evaluadas: evaluadas.length,
      aciertos,
      hitRate: evaluadas.length > 0 ? (aciertos / evaluadas.length) * 100 : null,
    };
  });
}