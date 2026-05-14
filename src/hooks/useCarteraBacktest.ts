import { useQuery } from "@tanstack/react-query";

export type BacktestSummary = {
  total: number;
  hits: number;
  hitRate: number;
  cost: number;
  net: number;
  roi: number;
  compact: number;
  compactRate: number;
  nearMiss: number;
};

export type BacktestHour = BacktestSummary & {
  hora: string;
};

export type BacktestResult = {
  ok: boolean;
  params: {
    limit: number;
    minTrain: number;
    payoutPerHit: number;
  };
  generatedAt: string;
  strategies: {
    adaptive_v2: {
      summary: BacktestSummary;
      byHour: BacktestHour[];
    };
    standard_25: {
      summary: BacktestSummary;
      byHour: BacktestHour[];
    };
  };
};

export function useCarteraBacktest(enabled: boolean) {
  return useQuery({
    queryKey: ["cartera-backtest", 600, 80, 70],
    enabled,
    queryFn: async (): Promise<BacktestResult> => {
      const res = await fetch(
        "/api/public/hooks/backtest-carteras?limit=600&minTrain=80&payout=70",
        {
          method: "POST",
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.ok === false) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      return json as BacktestResult;
    },
    staleTime: 5 * 60_000,
  });
}
