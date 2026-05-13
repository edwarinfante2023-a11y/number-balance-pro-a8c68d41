import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BankrollConfig {
  fondoInicial: number;
  apuestaPorNumero: number;
  pago: number;            // múltiplo (ej 72)
  numerosPorCartera: number; // 25
  scoreMin: number;        // umbral internalScore para "filtradas"
}

export interface SimRow {
  fecha: string;
  hora: string;
  internalScore: number;
  acierto: boolean;
  costo: number;
  premio: number;
  pl: number;
}

export interface SimResult {
  rows: SimRow[];
  jugadas: number;
  aciertos: number;
  hitRate: number;
  invertido: number;
  cobrado: number;
  pl: number;
  roi: number;       // pl / invertido
  balanceFinal: number;
  maxDrawdown: number;
  equity: Array<{ i: number; balance: number }>;
}

function simulate(rows: SimRow[], cfg: BankrollConfig): SimResult {
  let balance = cfg.fondoInicial;
  let peak = balance;
  let maxDD = 0;
  const equity: Array<{ i: number; balance: number }> = [{ i: 0, balance }];
  let invertido = 0;
  let cobrado = 0;
  let aciertos = 0;
  rows.forEach((r, i) => {
    balance -= r.costo;
    invertido += r.costo;
    if (r.acierto) {
      balance += r.premio;
      cobrado += r.premio;
      aciertos++;
    }
    if (balance > peak) peak = balance;
    const dd = peak - balance;
    if (dd > maxDD) maxDD = dd;
    equity.push({ i: i + 1, balance });
  });
  const pl = balance - cfg.fondoInicial;
  return {
    rows,
    jugadas: rows.length,
    aciertos,
    hitRate: rows.length ? aciertos / rows.length : 0,
    invertido,
    cobrado,
    pl,
    roi: invertido > 0 ? pl / invertido : 0,
    balanceFinal: balance,
    maxDrawdown: maxDD,
    equity,
  };
}

/** Trae resultados evaluados + contexto de cartera y simula bankroll. */
export function useBankrollSim(cfg: BankrollConfig, dias = 90) {
  return useQuery({
    queryKey: ["bankroll-sim", cfg, dias],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - dias);

      const { data, error } = await supabase
        .from("cartera_resultados")
        .select("acierto, evaluated_at, carteras!inner(fecha, hora, contexto)")
        .gte("evaluated_at", since.toISOString())
        .order("evaluated_at", { ascending: true })
        .limit(5000);
      if (error) throw error;

      const costo = cfg.numerosPorCartera * cfg.apuestaPorNumero;
      const premio = cfg.apuestaPorNumero * cfg.pago;

      const all: SimRow[] = (data ?? []).map((r: any) => ({
        fecha: r.carteras.fecha,
        hora: r.carteras.hora,
        internalScore: Number(r.carteras?.contexto?.confidence?.internalScore ?? 0),
        acierto: !!r.acierto,
        costo,
        premio,
        pl: r.acierto ? premio - costo : -costo,
      }));

      const filtered = all.filter((r) => r.internalScore >= cfg.scoreMin);

      return {
        breakEvenHitRate: cfg.numerosPorCartera / cfg.pago,
        all: simulate(all, cfg),
        filtered: simulate(filtered, cfg),
      };
    },
  });
}