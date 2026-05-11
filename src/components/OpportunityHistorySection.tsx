import { useMemo } from "react";
import { Loader2, History, CheckCircle2, XCircle, MinusCircle, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useOpportunityHistory,
  bucketByScore,
  type OpportunityHistoryRow,
} from "@/hooks/useOpportunityHistory";

export function OpportunityHistorySection() {
  const { data: rows = [], isLoading } = useOpportunityHistory(200);

  const buckets = useMemo(() => bucketByScore(rows), [rows]);

  const totalEvaluadas = rows.filter((r) => r.acierto !== null).length;
  const totalAciertos = rows.filter((r) => r.acierto === true).length;
  const overallRate =
    totalEvaluadas > 0 ? (totalAciertos / totalEvaluadas) * 100 : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[20px] font-bold text-foreground flex items-center gap-2">
            <History className="size-5 text-primary" />
            Histórico de oportunidades
          </h2>
          <p className="text-[13px] text-muted-foreground mt-1 font-medium">
            Alertas disparadas y su tasa de acierto real
          </p>
        </div>
        {overallRate !== null && (
          <div className="surface-elevated rounded-[16px] px-4 py-2 text-right">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Acierto global
            </div>
            <div className="text-[22px] font-extrabold tabular-nums text-primary">
              {overallRate.toFixed(1)}%
            </div>
            <div className="text-[10px] text-muted-foreground font-medium">
              {totalAciertos}/{totalEvaluadas} evaluadas
            </div>
          </div>
        )}
      </div>

      {/* Buckets */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {buckets.map((b) => (
          <div
            key={b.label}
            className="surface-elevated rounded-[16px] p-4 flex flex-col gap-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Score {b.label}
              </span>
              <BarChart3 className="size-3.5 text-muted-foreground/50" />
            </div>
            <div className="text-[24px] font-extrabold tabular-nums text-foreground">
              {b.hitRate !== null ? `${b.hitRate.toFixed(0)}%` : "—"}
            </div>
            <div className="text-[11px] text-muted-foreground font-medium">
              {b.aciertos}/{b.evaluadas} aciertos · {b.total} alertas
            </div>
            {b.hitRate !== null && (
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full",
                    b.hitRate >= 50 ? "bg-emerald-500" : b.hitRate >= 25 ? "bg-amber-500" : "bg-rose-500",
                  )}
                  style={{ width: `${Math.min(100, b.hitRate)}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* List */}
      <div className="surface-elevated rounded-[24px] p-4 lg:p-6">
        {isLoading ? (
          <div className="grid place-items-center py-12">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-[13px] text-muted-foreground font-medium">
            Aún no se registraron alertas de oportunidad.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {rows.slice(0, 50).map((r) => (
              <HistoryRow key={r.id} row={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HistoryRow({ row }: { row: OpportunityHistoryRow }) {
  const fecha = new Date(row.fecha + "T00:00:00").toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
  });

  const StatusIcon =
    row.acierto === true ? CheckCircle2 : row.acierto === false ? XCircle : MinusCircle;
  const statusColor =
    row.acierto === true
      ? "text-emerald-600"
      : row.acierto === false
        ? "text-rose-500"
        : "text-muted-foreground/50";
  const statusLabel =
    row.acierto === true ? "Acierto" : row.acierto === false ? "Falló" : "Pendiente";

  return (
    <div className="grid grid-cols-12 gap-3 items-center py-3 px-1">
      <div className="col-span-3 sm:col-span-2">
        <div className="text-[13px] font-bold text-foreground">{row.hora}</div>
        <div className="text-[11px] text-muted-foreground font-medium">{fecha}</div>
      </div>
      <div className="col-span-2 sm:col-span-1 text-center">
        <div className="text-[16px] font-extrabold tabular-nums text-primary">
          {row.internal_score}
        </div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">score</div>
      </div>
      <div className="hidden sm:block col-span-3 text-[11px] text-muted-foreground font-medium">
        gap {row.gap.toFixed(1)} · μ {row.top_mean.toFixed(1)}
      </div>
      <div className="col-span-4 sm:col-span-3 text-[11px] text-muted-foreground font-medium truncate">
        {row.numeros && row.numeros.length > 0
          ? row.numeros.slice(0, 8).join(", ") + (row.numeros.length > 8 ? "…" : "")
          : "—"}
      </div>
      <div className="col-span-2 sm:col-span-1 text-center">
        {row.numero_ganador !== null ? (
          <span className="text-[14px] font-extrabold tabular-nums text-foreground">
            {row.numero_ganador}
          </span>
        ) : (
          <span className="text-[12px] text-muted-foreground/50">—</span>
        )}
      </div>
      <div className="col-span-1 sm:col-span-2 flex items-center justify-end gap-1.5">
        <StatusIcon className={cn("size-4", statusColor)} />
        <span className={cn("hidden sm:inline text-[11px] font-bold", statusColor)}>
          {statusLabel}
        </span>
      </div>
    </div>
  );
}