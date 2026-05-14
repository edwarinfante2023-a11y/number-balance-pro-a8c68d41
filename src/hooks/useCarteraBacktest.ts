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

export function useCarteraBacktest(enabled: boolean, limit = 600, minTrain = 80, payout = 70) {
  return useQuery({
    queryKey: ["cartera-backtest", limit, minTrain, payout],
    enabled,
    queryFn: async (): Promise<BacktestResult> => {
      const res = await fetch(
        `https://project--eaae42aa-34c4-457c-a07c-36f8131c182e.lovable.app/api/public/hooks/backtest-carteras?limit=${limit}&minTrain=${minTrain}&payout=${payout}`,
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
