import { useMemo, useState } from "react";
import { Loader2, History, CheckCircle2, XCircle, MinusCircle, BarChart3, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  useOpportunityHistory,
  bucketByScore,
  type OpportunityHistoryRow,
} from "@/hooks/useOpportunityHistory";

export function OpportunityHistorySection() {
  const { data: rows = [], isLoading } = useOpportunityHistory(200);
  const qc = useQueryClient();
  const [evaluating, setEvaluating] = useState(false);

  const handleReevaluate = async () => {
    setEvaluating(true);
    try {
      const res = await fetch("/api/public/hooks/evaluate-results", { method: "POST" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error desconocido");
      toast.success(
        json.evaluadas === 0
          ? "Sin carteras nuevas para evaluar"
          : `${json.evaluadas} evaluadas · ${json.aciertos} aciertos`,
      );
      qc.invalidateQueries({ queryKey: ["opportunity_history"] });
      qc.invalidateQueries({ queryKey: ["score_metrics"] });
    } catch (err: any) {
      toast.error(err?.message ?? "No se pudo evaluar");
    } finally {
      setEvaluating(false);
    }
  };

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
        <div className="flex items-center gap-3">
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
          <button
            onClick={handleReevaluate}
            disabled={evaluating}
            className="flex items-center gap-1.5 px-3 py-2 rounded-[12px] bg-primary text-primary-foreground text-[12px] font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={cn("size-3.5", evaluating && "animate-spin")} />
            Re-evaluar
          </button>
        </div>
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

  // Hora real de generación de la cartera (timestamp) → HH:mm
  const genTime = row.cartera_created_at
    ? new Date(row.cartera_created_at).toLocaleTimeString("es-AR", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : null;

  // Lead time: minutos entre generación y la hora del sorteo
  let leadMin: number | null = null;
  if (row.cartera_created_at && row.hora) {
    const gen = new Date(row.cartera_created_at);
    const [hh, mm] = row.hora.split(":").map(Number);
    const draw = new Date(row.fecha + "T00:00:00");
    draw.setHours(hh ?? 0, mm ?? 0, 0, 0);
    leadMin = Math.round((draw.getTime() - gen.getTime()) / 60000);
  }

  // Posición del número ganador entre los 25, ordenados por score desc
  let posScore: number | null = null;
  if (
    row.acierto === true &&
    row.numero_ganador !== null &&
    row.scores &&
    Object.keys(row.scores).length > 0
  ) {
    const ranked = Object.entries(row.scores)
      .map(([n, s]) => ({ n: Number(n), s: Number(s) }))
      .sort((a, b) => b.s - a.s || a.n - b.n);
    const idx = ranked.findIndex((x) => x.n === row.numero_ganador);
    if (idx >= 0) posScore = idx + 1;
  }

  return (
    <div className="grid grid-cols-12 gap-3 items-center py-3 px-1">
      <div className="col-span-3 sm:col-span-2">
        <div className="text-[13px] font-bold text-foreground">
          Sorteo {row.hora}
        </div>
        <div className="text-[11px] text-muted-foreground font-medium">{fecha}</div>
        {genTime && (
          <div className="text-[10px] text-muted-foreground/80 font-medium mt-0.5">
            gen. {genTime}
            {leadMin !== null && leadMin >= 0 && ` · −${leadMin}m`}
            {leadMin !== null && leadMin < 0 && ` · +${Math.abs(leadMin)}m`}
          </div>
        )}
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
          <div className="flex flex-col items-center">
            <span
              className={cn(
                "text-[14px] font-extrabold tabular-nums",
                row.acierto === true ? "text-emerald-600" : "text-foreground",
              )}
            >
              {row.numero_ganador}
            </span>
            {posScore !== null && (
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                #{posScore}/25
              </span>
            )}
          </div>
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