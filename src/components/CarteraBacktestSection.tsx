import { useState } from "react";
import { BarChart3, Loader2, Play, TrendingUp, Zap } from "lucide-react";
import { useCarteraBacktest, type BacktestSummary } from "@/hooks/useCarteraBacktest";
import { cn } from "@/lib/utils";

function pct(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}

function units(v: number) {
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(0)}u`;
}

export function CarteraBacktestSection() {
  const [enabled, setEnabled] = useState(false);
  const { data, isLoading, isError, error, refetch, isFetching } = useCarteraBacktest(enabled);

  const adaptive = data?.strategies.adaptive_v2.summary;
  const standard = data?.strategies.standard_25.summary;
  const deltaRoi = adaptive && standard ? adaptive.roi - standard.roi : null;
  const bestHours = data?.strategies.adaptive_v2.byHour.slice(0, 5) ?? [];

  return (
    <section className="surface-elevated rounded-[24px] p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="size-5 text-primary" />
            Backtest de carteras
          </h2>
          <p className="text-[13px] text-muted-foreground mt-1 font-medium">
            Comparación sin datos futuros: 25 fijo vs adaptativo 25/15
          </p>
        </div>
        <button
          onClick={() => {
            setEnabled(true);
            if (enabled) refetch();
          }}
          disabled={isFetching}
          className="h-10 px-4 rounded-[12px] bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-2 text-[12px] font-bold transition"
        >
          {isFetching ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
          Ejecutar backtest
        </button>
      </div>

      {!enabled && (
        <div className="rounded-[16px] border border-border bg-muted/35 p-4 text-[13px] font-medium text-muted-foreground">
          Ejecuta la simulación para ver si el modo de 15 números merece activarse por hora.
        </div>
      )}

      {isError && (
        <div className="rounded-[16px] border border-destructive/30 bg-destructive/10 p-4 text-[13px] font-semibold text-destructive">
          {(error as Error)?.message ?? "No se pudo ejecutar el backtest"}
        </div>
      )}

      {isLoading && (
        <div className="grid place-items-center py-10">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {adaptive && standard && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <BacktestCard title="Adaptativo 25/15" summary={adaptive} accent />
            <BacktestCard title="25 fijo" summary={standard} />
            <div className="rounded-[16px] bg-background border border-border p-4">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <TrendingUp className="size-4" />
                Diferencia ROI
              </div>
              <div
                className={cn(
                  "mt-2 text-[26px] font-black tabular-nums",
                  deltaRoi !== null && deltaRoi >= 0 ? "text-emerald-700" : "text-rose-600",
                )}
              >
                {deltaRoi !== null ? pct(deltaRoi) : "—"}
              </div>
              <p className="mt-1 text-[11px] font-medium text-muted-foreground">
                Compactas activadas: {adaptive.compact} de {adaptive.total}
              </p>
            </div>
          </div>

          <div className="rounded-[16px] bg-background border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <Zap className="size-4 text-primary" />
              <h3 className="text-[13px] font-bold text-foreground">
                Mejores horas por ROI adaptativo
              </h3>
            </div>
            <div className="divide-y divide-border">
              {bestHours.map((h) => (
                <div
                  key={h.hora}
                  className="grid grid-cols-5 gap-2 px-4 py-3 text-[12px] items-center"
                >
                  <span className="font-black tabular-nums text-foreground">{h.hora}</span>
                  <span className="text-muted-foreground">Hit {pct(h.hitRate)}</span>
                  <span
                    className={
                      h.net >= 0 ? "text-emerald-700 font-bold" : "text-rose-600 font-bold"
                    }
                  >
                    {units(h.net)}
                  </span>
                  <span className="text-muted-foreground">ROI {pct(h.roi)}</span>
                  <span className="text-muted-foreground">15 nums {h.compact}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function BacktestCard({
  title,
  summary,
  accent,
}: {
  title: string;
  summary: BacktestSummary;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-[16px] bg-background border p-4",
        accent ? "border-primary/30" : "border-border",
      )}
    >
      <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <div
        className={cn(
          "mt-2 text-[26px] font-black tabular-nums",
          accent ? "text-primary" : "text-foreground",
        )}
      >
        {pct(summary.hitRate)}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] font-semibold">
        <span className="text-muted-foreground">Eval {summary.total}</span>
        <span className="text-muted-foreground">ROI {pct(summary.roi)}</span>
        <span className={summary.net >= 0 ? "text-emerald-700" : "text-rose-600"}>
          {units(summary.net)}
        </span>
      </div>
    </div>
  );
}
