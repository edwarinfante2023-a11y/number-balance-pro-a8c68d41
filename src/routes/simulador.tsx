import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Settings2,
  TrendingUp,
  XCircle,
  Play,
  Loader2,
  RefreshCcw,
  Zap,
} from "lucide-react";
import { useCarteraBacktest, type BacktestSummary } from "@/hooks/useCarteraBacktest";
import { cn } from "@/lib/utils";

function pct(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}

function units(v: number) {
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(0)}u`;
}

export const Route = createFileRoute("/simulador")({
  head: () => ({
    meta: [
      { title: "Simulador Cuantitativo" },
      { name: "description", content: "Backtesting de la estrategia Adaptive v2 vs Standard 25" },
    ],
  }),
  component: SimuladorPage,
});

function SimuladorPage() {
  const [params, setParams] = useState({ limit: 600, minTrain: 80, payout: 70 });
  const [draft, setDraft] = useState({ limit: 600, minTrain: 80, payout: 70 });
  const [enabled, setEnabled] = useState(false);

  const { data, isLoading, isError, error, refetch, isFetching } = useCarteraBacktest(
    enabled,
    params.limit,
    params.minTrain,
    params.payout,
  );

  const adaptive = data?.strategies.adaptive_v2.summary;
  const standard = data?.strategies.standard_25.summary;
  const deltaRoi = adaptive && standard ? adaptive.roi - standard.roi : null;
  const bestHours = data?.strategies.adaptive_v2.byHour.slice(0, 8) ?? [];
  const lastDraws = data?.strategies.adaptive_v2.last ?? [];

  const handleRun = () => {
    setParams(draft);
    setEnabled(true);
    if (enabled) {
      setTimeout(() => refetch(), 50); // slight delay to ensure key updates if needed
    }
  };

  return (
    <div className="space-y-6 pt-2 pb-20">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[28px] lg:text-[32px] font-bold tracking-tight text-foreground flex items-center gap-3">
          <div className="size-10 rounded-xl bg-indigo-100 border border-indigo-200 grid place-items-center shadow-sm">
            <Activity className="size-5 text-indigo-600" />
          </div>
          Laboratorio Cuantitativo
        </h1>
        <p className="text-[15px] text-muted-foreground mt-2 max-w-2xl leading-relaxed">
          Simula miles de sorteos históricos usando el algoritmo actual para medir la rentabilidad
          real (Backtesting) sin arriesgar capital.
        </p>
      </div>

      {/* Control Panel */}
      <div className="rounded-[24px] lg:rounded-[32px] border border-border bg-white shadow-sm overflow-hidden">
        <div className="px-5 lg:px-8 py-5 border-b border-border bg-muted/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings2 className="size-5 text-muted-foreground" />
            <h4 className="text-[15px] font-bold uppercase tracking-[0.1em] text-foreground">
              Parámetros de Simulación
            </h4>
          </div>
        </div>
        <div className="p-5 lg:p-8 grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground">
              Sorteos a Simular
            </label>
            <input
              type="number"
              value={draft.limit}
              onChange={(e) => setDraft({ ...draft, limit: Number(e.target.value) })}
              className="w-full rounded-xl border border-border px-4 py-2.5 text-[14px] font-semibold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
            />
            <p className="text-[11px] text-muted-foreground">Últimos N sorteos de la base.</p>
          </div>
          <div className="space-y-2">
            <label className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground">
              Sorteos de Calentamiento
            </label>
            <input
              type="number"
              value={draft.minTrain}
              onChange={(e) => setDraft({ ...draft, minTrain: Number(e.target.value) })}
              className="w-full rounded-xl border border-border px-4 py-2.5 text-[14px] font-semibold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
            />
            <p className="text-[11px] text-muted-foreground">Mínimo historial antes de predecir.</p>
          </div>
          <div className="space-y-2">
            <label className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground">
              Pago por Acierto (Neto)
            </label>
            <input
              type="number"
              value={draft.payout}
              onChange={(e) => setDraft({ ...draft, payout: Number(e.target.value) })}
              className="w-full rounded-xl border border-border px-4 py-2.5 text-[14px] font-semibold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
            />
            <p className="text-[11px] text-muted-foreground">Ej: 70 unidades por cada 1 apostada.</p>
          </div>
        </div>
        <div className="px-5 lg:px-8 py-4 bg-muted/10 border-t border-border flex justify-end">
          <button
            onClick={handleRun}
            disabled={isFetching}
            className="h-12 px-8 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 inline-flex items-center gap-2 text-[14px] font-bold transition shadow-sm"
          >
            {isFetching ? <Loader2 className="size-5 animate-spin" /> : <Play className="size-5" />}
            {isFetching ? "Calculando simulaciones..." : "Ejecutar Backtesting"}
          </button>
        </div>
      </div>

      {isError && (
        <div className="rounded-[16px] border border-destructive/30 bg-destructive/10 p-5 flex items-start gap-3">
          <AlertCircle className="size-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <h4 className="text-[14px] font-bold text-destructive">Error en la simulación</h4>
            <p className="text-[13px] text-destructive/80 mt-1">
              {(error as Error)?.message ?? "No se pudo ejecutar el backtest"}
            </p>
          </div>
        </div>
      )}

      {/* Loading state indicator that covers previous data */}
      {isFetching && !!data && (
        <div className="rounded-[16px] border border-indigo-200 bg-indigo-50/50 p-4 text-[13px] font-medium text-indigo-800 flex items-center justify-center gap-2 animate-pulse">
          <RefreshCcw className="size-4 animate-spin" />
          Recalculando con los nuevos parámetros...
        </div>
      )}

      {/* Results Area */}
      {adaptive && standard && (
        <div className="space-y-6 animate-fade-up">
          {/* Top Level Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
            <BacktestCard title="Estrategia: Adaptativo 25/15" summary={adaptive} accent />
            <BacktestCard title="Estrategia: 25 Fijo Clásico" summary={standard} />
            <div className="rounded-[24px] bg-white border border-border p-6 lg:p-8 flex flex-col justify-between shadow-sm">
              <div>
                <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-widest text-muted-foreground">
                  <TrendingUp className="size-4" />
                  Ventaja Adaptativa (Delta ROI)
                </div>
                <div
                  className={cn(
                    "mt-3 text-[36px] font-black tabular-nums",
                    deltaRoi !== null && deltaRoi >= 0 ? "text-emerald-600" : "text-rose-600",
                  )}
                >
                  {deltaRoi !== null ? pct(deltaRoi) : "—"}
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-[12px] font-medium text-muted-foreground leading-relaxed">
                  El algoritmo adaptativo redujo la cartera a 15 números en{" "}
                  <strong className="text-foreground">{adaptive.compact}</strong> de las{" "}
                  <strong className="text-foreground">{adaptive.total}</strong> simulaciones
                  evaluadas.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* By Hour Breakdown */}
            <div className="lg:col-span-1 rounded-[24px] bg-white border border-border overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-border flex items-center gap-2 bg-muted/5">
                <Zap className="size-4 text-indigo-600" />
                <h3 className="text-[14px] font-bold uppercase tracking-widest text-foreground">
                  Top Horas Rentables
                </h3>
              </div>
              <div className="divide-y divide-border">
                {bestHours.length > 0 ? (
                  bestHours.map((h) => (
                    <div
                      key={h.hora}
                      className="grid grid-cols-4 gap-2 px-5 py-4 text-[13px] items-center hover:bg-muted/10 transition-colors"
                    >
                      <span className="font-black tabular-nums text-foreground">{h.hora}</span>
                      <span className="text-muted-foreground text-center" title="Hit Rate">
                        {pct(h.hitRate)}
                      </span>
                      <span
                        className={cn(
                          "text-center font-bold",
                          h.net >= 0 ? "text-emerald-600" : "text-rose-600",
                        )}
                        title="Net Units"
                      >
                        {units(h.net)}
                      </span>
                      <span className="text-muted-foreground text-right font-bold" title="ROI">
                        {pct(h.roi)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-[13px] text-muted-foreground">
                    Sin datos suficientes
                  </div>
                )}
              </div>
            </div>

            {/* Last Draws Table */}
            <div className="lg:col-span-2 rounded-[24px] bg-white border border-border overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-muted/5">
                <div className="flex items-center gap-2">
                  <BarChart3 className="size-4 text-indigo-600" />
                  <h3 className="text-[14px] font-bold uppercase tracking-widest text-foreground">
                    Registro Reciente (Adaptativo)
                  </h3>
                </div>
                <span className="text-[11px] text-muted-foreground font-bold tracking-widest uppercase">
                  Últimos 20
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-muted/10 text-[11px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border">
                    <tr>
                      <th className="px-5 py-3 whitespace-nowrap">Fecha / Hora</th>
                      <th className="px-5 py-3 whitespace-nowrap">Real</th>
                      <th className="px-5 py-3 whitespace-nowrap">Tamaño</th>
                      <th className="px-5 py-3 whitespace-nowrap">Ranking</th>
                      <th className="px-5 py-3 whitespace-nowrap text-right">Neto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {lastDraws.map((row, i) => (
                      <tr key={i} className="hover:bg-muted/10 transition-colors">
                        <td className="px-5 py-3 tabular-nums text-[13px] font-mono font-medium text-muted-foreground whitespace-nowrap">
                          {row.fecha} <span className="font-bold text-foreground">{row.hora}</span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[16px] font-extrabold text-foreground tabular-nums">
                              {row.numero.toString().padStart(2, "0")}
                            </span>
                            {row.hit ? (
                              <CheckCircle2 className="size-4 text-emerald-500" />
                            ) : (
                              <XCircle className="size-4 text-rose-500/70" />
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-[13px] font-semibold text-foreground">
                          {row.selectedSize} nums
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-widest",
                              row.rank !== null && row.rank <= row.selectedSize
                                ? "bg-emerald-100 text-emerald-700"
                                : row.missType === "near_miss"
                                  ? "bg-orange-100 text-orange-700"
                                  : "bg-muted text-muted-foreground",
                            )}
                          >
                            {row.rank !== null ? `#${row.rank}` : "Fuera"}
                          </span>
                        </td>
                        <td
                          className={cn(
                            "px-5 py-3 text-right text-[14px] font-bold tabular-nums",
                            row.net >= 0 ? "text-emerald-600" : "text-rose-600",
                          )}
                        >
                          {units(row.net)}
                        </td>
                      </tr>
                    ))}
                    {lastDraws.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-[13px] text-muted-foreground">
                          No hay sorteos recientes evaluados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
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
        "rounded-[24px] bg-white border p-6 lg:p-8 shadow-sm flex flex-col justify-between",
        accent ? "border-indigo-200 ring-1 ring-indigo-100" : "border-border",
      )}
    >
      <div>
        <div
          className={cn(
            "text-[12px] font-bold uppercase tracking-widest",
            accent ? "text-indigo-600" : "text-muted-foreground",
          )}
        >
          {title}
        </div>
        <div
          className={cn(
            "mt-3 text-[36px] font-black tabular-nums",
            accent ? "text-indigo-600" : "text-foreground",
          )}
        >
          {pct(summary.hitRate)}
        </div>
        <div className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground mt-1">
          Tasa de Acierto Global
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 border-t border-border pt-5">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            ROI Total
          </div>
          <div
            className={cn(
              "mt-1 text-[18px] font-extrabold tabular-nums",
              summary.roi >= 0 ? "text-emerald-600" : "text-rose-600",
            )}
          >
            {pct(summary.roi)}
          </div>
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Beneficio Neto
          </div>
          <div
            className={cn(
              "mt-1 text-[18px] font-extrabold tabular-nums",
              summary.net >= 0 ? "text-emerald-600" : "text-rose-600",
            )}
          >
            {units(summary.net)}
          </div>
        </div>
      </div>
    </div>
  );
}

// Icon for missing import
function AlertCircle(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </svg>
  );
}
