import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CarteraEvalRow = {
  cartera_id: string;
  fecha: string;
  hora: string;
  acierto: boolean | null;
  alert_score: number | null;
};

export type ConfusionMatrix = {
  tp: number; // alerta & acierto
  fp: number; // alerta & falló
  fn: number; // sin alerta & acierto
  tn: number; // sin alerta & falló
  precision: number | null;
  recall: number | null;
  f1: number | null;
  accuracy: number | null;
  baseRate: number | null; // acierto rate sin filtrar
  alertRate: number | null;
  lift: number | null; // precision / baseRate
};

export type HourBucket = {
  hora: string;
  total: number;
  evaluadas: number;
  aciertos: number;
  hitRate: number | null;
  alertas: number;
  alertasAciertos: number;
  alertHitRate: number | null;
};

export function useScoreMetrics(limit = 500) {
  return useQuery({
    queryKey: ["score_metrics", limit],
    queryFn: async (): Promise<CarteraEvalRow[]> => {
      const { data, error } = await supabase
        .from("carteras")
        .select(
          `id, fecha, hora,
           cartera_resultados ( acierto ),
           opportunity_alerts ( internal_score )`,
        )
        .order("fecha", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []).map((r: any) => {
        const res = Array.isArray(r.cartera_resultados)
          ? r.cartera_resultados[0]
          : r.cartera_resultados;
        const alert = Array.isArray(r.opportunity_alerts)
          ? r.opportunity_alerts[0]
          : r.opportunity_alerts;
        return {
          cartera_id: r.id,
          fecha: r.fecha,
          hora: r.hora,
          acierto: res?.acierto ?? null,
          alert_score: alert?.internal_score ?? null,
        };
      });
    },
    staleTime: 30_000,
  });
}

export function computeConfusion(
  rows: CarteraEvalRow[],
  scoreThreshold = 70,
): ConfusionMatrix {
  const evaluated = rows.filter((r) => r.acierto !== null);
  let tp = 0,
    fp = 0,
    fn = 0,
    tn = 0;
  for (const r of evaluated) {
    const isAlert = r.alert_score !== null && r.alert_score >= scoreThreshold;
    const hit = r.acierto === true;
    if (isAlert && hit) tp++;
    else if (isAlert && !hit) fp++;
    else if (!isAlert && hit) fn++;
    else tn++;
  }
  const total = evaluated.length;
  const precision = tp + fp > 0 ? tp / (tp + fp) : null;
  const recall = tp + fn > 0 ? tp / (tp + fn) : null;
  const f1 =
    precision !== null && recall !== null && precision + recall > 0
      ? (2 * precision * recall) / (precision + recall)
      : null;
  const accuracy = total > 0 ? (tp + tn) / total : null;
  const baseRate = total > 0 ? (tp + fn) / total : null;
  const alertRate = total > 0 ? (tp + fp) / total : null;
  const lift =
    precision !== null && baseRate !== null && baseRate > 0
      ? precision / baseRate
      : null;
  return { tp, fp, fn, tn, precision, recall, f1, accuracy, baseRate, alertRate, lift };
}

export function bucketByHour(rows: CarteraEvalRow[]): HourBucket[] {
  const map = new Map<string, HourBucket>();
  for (const r of rows) {
    const b = map.get(r.hora) ?? {
      hora: r.hora,
      total: 0,
      evaluadas: 0,
      aciertos: 0,
      hitRate: null,
      alertas: 0,
      alertasAciertos: 0,
      alertHitRate: null,
    };
    b.total++;
    if (r.acierto !== null) {
      b.evaluadas++;
      if (r.acierto) b.aciertos++;
    }
    if (r.alert_score !== null) {
      b.alertas++;
      if (r.acierto === true) b.alertasAciertos++;
    }
    map.set(r.hora, b);
  }
  for (const b of map.values()) {
    b.hitRate = b.evaluadas > 0 ? (b.aciertos / b.evaluadas) * 100 : null;
    b.alertHitRate =
      b.alertas > 0 ? (b.alertasAciertos / b.alertas) * 100 : null;
  }
  return Array.from(map.values()).sort((a, b) => a.hora.localeCompare(b.hora));
}