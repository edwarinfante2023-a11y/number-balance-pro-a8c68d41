import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CronStatus {
  lastCarteraAt: string | null;
  lastResultadoAt: string | null;
  carteras24h: number;
  resultados24h: number;
  aciertos24h: number;
  hitRate24h: number | null;
  generacionRetrasoMin: number | null;
  evaluacionRetrasoMin: number | null;
}

const since24hISO = () => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

async function fetchCronStatus(): Promise<CronStatus> {
  const since = since24hISO();

  const [lastCart, lastRes, cartCount, resRows] = await Promise.all([
    supabase
      .from("carteras")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("cartera_resultados")
      .select("evaluated_at")
      .order("evaluated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("carteras")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since),
    supabase
      .from("cartera_resultados")
      .select("acierto")
      .gte("evaluated_at", since),
  ]);

  const lastCarteraAt = (lastCart.data as any)?.created_at ?? null;
  const lastResultadoAt = (lastRes.data as any)?.evaluated_at ?? null;
  const carteras24h = cartCount.count ?? 0;
  const resultados = (resRows.data ?? []) as { acierto: boolean }[];
  const resultados24h = resultados.length;
  const aciertos24h = resultados.filter((r) => r.acierto).length;
  const hitRate24h = resultados24h > 0 ? (aciertos24h / resultados24h) * 100 : null;

  const now = Date.now();
  const generacionRetrasoMin = lastCarteraAt
    ? Math.floor((now - new Date(lastCarteraAt).getTime()) / 60000)
    : null;
  const evaluacionRetrasoMin = lastResultadoAt
    ? Math.floor((now - new Date(lastResultadoAt).getTime()) / 60000)
    : null;

  return {
    lastCarteraAt,
    lastResultadoAt,
    carteras24h,
    resultados24h,
    aciertos24h,
    hitRate24h,
    generacionRetrasoMin,
    evaluacionRetrasoMin,
  };
}

export function useCronStatus() {
  return useQuery({
    queryKey: ["cron_status"],
    queryFn: fetchCronStatus,
    refetchInterval: 60_000,
  });
}