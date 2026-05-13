import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SenalKey = "freq" | "balance" | "regla" | "patron";

export interface SenalStat {
  senal: SenalKey;
  label: string;
  aciertosTocados: number;
  pctAciertos: number;        // 0-1
  presenciasEnTop: number;    // veces que esta señal apareció en algún número del top 25 evaluado
  hitRateSenal: number;       // aciertosTocados / presenciasEnTop
}

export interface AttributionStats {
  totalAciertos: number;
  totalEvaluadas: number;
  porSenal: SenalStat[];
  topPatrones: Array<{ nombre: string; aciertos: number }>;
  topReglas: Array<{ nombre: string; aciertos: number }>;
}

const LABELS: Record<SenalKey, string> = {
  freq: "Frecuencia por hora",
  balance: "Balance / compensación",
  regla: "Reglas activas",
  patron: "Patrones activos",
};

function classify(reason: string): { key: SenalKey; name?: string } | null {
  // Strings tienen forma: "+freq hora ×5", "+balance BAJO", "+regla NombreX", "+patrón NombreY"
  if (reason.startsWith("+freq")) return { key: "freq" };
  if (reason.startsWith("+balance")) return { key: "balance" };
  if (reason.startsWith("+regla")) return { key: "regla", name: reason.replace(/^\+regla\s+/, "").trim() };
  if (reason.startsWith("+patrón") || reason.startsWith("+patron")) {
    return { key: "patron", name: reason.replace(/^\+patr[oó]n\s+/, "").trim() };
  }
  return null;
}

/**
 * Atribución: lee carteras evaluadas y calcula qué señales del motor
 * están detrás de los aciertos reales.
 */
export function useAttributionStats(dias = 90) {
  return useQuery<AttributionStats>({
    queryKey: ["attribution-stats", dias],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - dias);

      const { data, error } = await supabase
        .from("cartera_resultados")
        .select("acierto, numero_ganador, carteras!inner(id, fecha, numeros, contexto)")
        .gte("evaluated_at", since.toISOString())
        .limit(5000);
      if (error) throw error;

      const rows = (data ?? []) as any[];
      const aciertosTocados: Record<SenalKey, number> = { freq: 0, balance: 0, regla: 0, patron: 0 };
      const presencias: Record<SenalKey, number> = { freq: 0, balance: 0, regla: 0, patron: 0 };
      const patronesAciertos = new Map<string, number>();
      const reglasAciertos = new Map<string, number>();

      let totalAciertos = 0;
      const totalEvaluadas = rows.length;

      for (const r of rows) {
        const cartera = r.carteras;
        const reasonsMap: Record<string, string[]> = cartera?.contexto?.reasons ?? {};
        const numeros: number[] = cartera?.numeros ?? [];

        // Presencias: contar cuántos números del top 25 tenían cada señal
        const senalesPresentesEnCartera: Record<SenalKey, boolean> = {
          freq: false, balance: false, regla: false, patron: false,
        };
        for (const n of numeros) {
          const reasons = reasonsMap[String(n)] ?? [];
          const seen = new Set<SenalKey>();
          for (const reason of reasons) {
            const c = classify(reason);
            if (c) seen.add(c.key);
          }
          for (const k of seen) senalesPresentesEnCartera[k] = true;
        }
        for (const k of Object.keys(presencias) as SenalKey[]) {
          if (senalesPresentesEnCartera[k]) presencias[k]++;
        }

        if (r.acierto === true) {
          totalAciertos++;
          const reasonsGanador = reasonsMap[String(r.numero_ganador)] ?? [];
          const seen = new Set<SenalKey>();
          for (const reason of reasonsGanador) {
            const c = classify(reason);
            if (!c) continue;
            seen.add(c.key);
            if (c.key === "patron" && c.name) {
              patronesAciertos.set(c.name, (patronesAciertos.get(c.name) ?? 0) + 1);
            }
            if (c.key === "regla" && c.name) {
              reglasAciertos.set(c.name, (reglasAciertos.get(c.name) ?? 0) + 1);
            }
          }
          for (const k of seen) aciertosTocados[k]++;
        }
      }

      const porSenal: SenalStat[] = (Object.keys(aciertosTocados) as SenalKey[]).map((k) => ({
        senal: k,
        label: LABELS[k],
        aciertosTocados: aciertosTocados[k],
        pctAciertos: totalAciertos > 0 ? aciertosTocados[k] / totalAciertos : 0,
        presenciasEnTop: presencias[k],
        hitRateSenal: presencias[k] > 0 ? aciertosTocados[k] / presencias[k] : 0,
      })).sort((a, b) => b.pctAciertos - a.pctAciertos);

      const topPatrones = Array.from(patronesAciertos.entries())
        .map(([nombre, aciertos]) => ({ nombre, aciertos }))
        .sort((a, b) => b.aciertos - a.aciertos)
        .slice(0, 5);
      const topReglas = Array.from(reglasAciertos.entries())
        .map(([nombre, aciertos]) => ({ nombre, aciertos }))
        .sort((a, b) => b.aciertos - a.aciertos)
        .slice(0, 5);

      return { totalAciertos, totalEvaluadas, porSenal, topPatrones, topReglas };
    },
  });
}