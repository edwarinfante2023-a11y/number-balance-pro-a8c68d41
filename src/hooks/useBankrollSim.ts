import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ADAPTIVE_STRATEGY } from "@/lib/carteraEngine";

export interface BankrollConfig {
  fondoInicial: number;
  apuestaPorNumero: number;
  pago: number;            // múltiplo 1er premio (ej 70)
  pago2?: number;          // múltiplo 2do premio (ej 10)
  pago3?: number;          // múltiplo 3er premio (ej 4)
  numerosPorCartera: number; // 25
  scoreMin: number;        // umbral internalScore para "filtradas"
}

export interface SimRow {
  fecha: string;
  hora: string;
  selectedSize: number;
  internalScore: number;
  acierto: boolean;
  acierto2: boolean;
  acierto3: boolean;
  costo: number;
  premio: number;
  premio2: number;
  premio3: number;
  pl: number;
}

export interface SimResult {
  rows: SimRow[];
  jugadas: number;
  aciertos: number;
  aciertos2: number;
  aciertos3: number;
  hitRate: number;
  invertido: number;
  cobrado: number;
  cobrado1: number;
  cobrado2: number;
  cobrado3: number;
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
  let cobrado1 = 0;
  let cobrado2 = 0;
  let cobrado3 = 0;
  let aciertos = 0;
  let aciertos2 = 0;
  let aciertos3 = 0;
  rows.forEach((r, i) => {
    balance -= r.costo;
    invertido += r.costo;
    if (r.acierto) {
      balance += r.premio;
      cobrado += r.premio;
      cobrado1 += r.premio;
      aciertos++;
    }
    if (r.acierto2) {
      balance += r.premio2;
      cobrado += r.premio2;
      cobrado2 += r.premio2;
      aciertos2++;
    }
    if (r.acierto3) {
      balance += r.premio3;
      cobrado += r.premio3;
      cobrado3 += r.premio3;
      aciertos3++;
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
    aciertos2,
    aciertos3,
    hitRate: rows.length ? aciertos / rows.length : 0,
    invertido,
    cobrado,
    cobrado1,
    cobrado2,
    cobrado3,
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
        .select("acierto, acierto_segundo, acierto_tercero, evaluated_at, carteras!inner(fecha, hora, contexto)")
        .eq("carteras.estrategia", ADAPTIVE_STRATEGY)
        .gte("evaluated_at", since.toISOString())
        .order("evaluated_at", { ascending: true })
        .limit(5000);
      if (error) throw error;

      const premio = cfg.apuestaPorNumero * cfg.pago;
      const premio2 = cfg.apuestaPorNumero * (cfg.pago2 ?? 0);
      const premio3 = cfg.apuestaPorNumero * (cfg.pago3 ?? 0);

      const all: SimRow[] = (data ?? []).map((r: any) => {
        const a1 = !!r.acierto;
        const a2 = !!r.acierto_segundo;
        const a3 = !!r.acierto_tercero;
        const selectedSize = Number(r.carteras?.contexto?.selectedSize ?? cfg.numerosPorCartera);
        const costo = selectedSize * cfg.apuestaPorNumero;
        const cobro = (a1 ? premio : 0) + (a2 ? premio2 : 0) + (a3 ? premio3 : 0);
        return {
          fecha: r.carteras.fecha,
          hora: r.carteras.hora,
          selectedSize,
          internalScore: Number(r.carteras?.contexto?.confidence?.internalScore ?? 0),
          acierto: a1,
          acierto2: a2,
          acierto3: a3,
          costo,
          premio,
          premio2,
          premio3,
          pl: cobro - costo,
        };
      });

      const filtered = all.filter((r) => r.internalScore >= cfg.scoreMin);

      return {
        breakEvenHitRate: cfg.numerosPorCartera / cfg.pago,
        all: simulate(all, cfg),
        filtered: simulate(filtered, cfg),
      };
    },
  });
}
