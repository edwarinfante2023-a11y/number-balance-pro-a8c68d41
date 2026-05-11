import { useMemo, useState } from "react";
import { Activity, Target, Gauge, TrendingUp as TUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useScoreMetrics,
  computeConfusion,
  bucketByHour,
} from "@/hooks/useScoreMetrics";

const THRESHOLDS = [60, 70, 80, 90];

export function ScoreMetricsSection() {
  const { data: rows = [], isLoading } = useScoreMetrics(500);
  const [threshold, setThreshold] = useState(70);

  const matrix = useMemo(() => computeConfusion(rows, threshold), [rows, threshold]);
  const hours = useMemo(() => bucketByHour(rows), [rows]);
  const maxHourRate = useMemo(
    () =>
      Math.max(
        1,
        ...hours.map((h) => Math.max(h.hitRate ?? 0, h.alertHitRate ?? 0)),
      ),
    [hours],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-bold text-foreground flex items-center gap-2">
            <Gauge className="size-5 text-primary" />
            Validación del score
          </h2>
          <p className="text-[13px] text-muted-foreground mt-1 font-medium">
            Precisión, recall y lift comparados con la base — y evolución por hora
          </p>
        </div>

        {/* Threshold selector */}
        <div className="flex items-center gap-1 surface-elevated rounded-full p-1">
          {THRESHOLDS.map((t) => (
            <button
              key={t}
              onClick={() => setThreshold(t)}
              className={cn(
                "px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all",
                threshold === t
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              ≥ {t}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Top metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Metric
              label="Precisión"
              value={fmtPct(matrix.precision)}
              hint={`${matrix.tp}/${matrix.tp + matrix.fp} alertas aciertan`}
              icon={<Target className="size-4" />}
              accent
            />
            <Metric
              label="Recall"
              value={fmtPct(matrix.recall)}
              hint={`${matrix.tp}/${matrix.tp + matrix.fn} aciertos detectados`}
              icon={<Activity className="size-4" />}
            />
            <Metric
              label="F1"
              value={matrix.f1 !== null ? matrix.f1.toFixed(2) : "—"}
              hint="balance precisión/recall"
              icon={<Gauge className="size-4" />}
            />
            <Metric
              label="Lift vs base"
              value={matrix.lift !== null ? `${matrix.lift.toFixed(2)}×` : "—"}
              hint={`base ${fmtPct(matrix.baseRate)} · alertas ${fmtPct(matrix.precision)}`}
              icon={<TUp className="size-4" />}
              accent={matrix.lift !== null && matrix.lift > 1}
            />
          </div>

          {/* Confusion matrix */}
          <div className="surface-elevated rounded-[24px] p-6">
            <h3 className="text-[14px] font-bold text-foreground mb-4">
              Matriz de confusión <span className="text-muted-foreground font-medium">(score ≥ {threshold})</span>
            </h3>
            <div className="grid grid-cols-3 gap-1 text-[11px] font-bold">
              <div />
              <div className="text-center text-emerald-700 uppercase tracking-wider py-2">Acierto real</div>
              <div className="text-center text-rose-600 uppercase tracking-wider py-2">Falló real</div>

              <div className="text-right text-muted-foreground uppercase tracking-wider py-3 pr-2">Con alerta</div>
              <ConfCell value={matrix.tp} label="TP" tone="good" />
              <ConfCell value={matrix.fp} label="FP" tone="bad" />

              <div className="text-right text-muted-foreground uppercase tracking-wider py-3 pr-2">Sin alerta</div>
              <ConfCell value={matrix.fn} label="FN" tone="warn" />
              <ConfCell value={matrix.tn} label="TN" tone="neutral" />
            </div>
            <div className="mt-4 pt-4 border-t border-border flex flex-wrap gap-x-6 gap-y-2 text-[11px] text-muted-foreground font-medium">
              <span>Accuracy: <strong className="text-foreground">{fmtPct(matrix.accuracy)}</strong></span>
              <span>Tasa base: <strong className="text-foreground">{fmtPct(matrix.baseRate)}</strong></span>
              <span>Cobertura alertas: <strong className="text-foreground">{fmtPct(matrix.alertRate)}</strong></span>
              <span>Total evaluadas: <strong className="text-foreground">{matrix.tp + matrix.fp + matrix.fn + matrix.tn}</strong></span>
            </div>
          </div>

          {/* Hour evolution */}
          <div className="surface-elevated rounded-[24px] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[14px] font-bold text-foreground">
                Evolución por hora del día
              </h3>
              <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider">
                <LegendDot color="bg-muted-foreground/60" label="Hit-rate base" />
                <LegendDot color="bg-primary" label="Hit-rate con alerta" />
              </div>
            </div>

            {hours.length === 0 ? (
              <div className="py-8 text-center text-[13px] text-muted-foreground font-medium">
                Sin datos por hora todavía.
              </div>
            ) : (
              <div className="space-y-2">
                {hours.map((h) => (
                  <HourRow key={h.hora} bucket={h} max={maxHourRate} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function fmtPct(v: number | null) {
  if (v === null) return "—";
  return `${(v * (v <= 1 ? 100 : 1)).toFixed(1)}%`;
}

function Metric({
  label,
  value,
  hint,
  icon,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "surface-elevated rounded-[16px] p-4 flex flex-col gap-2",
        accent && "ring-1 ring-primary/20",
      )}
    >
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "size-7 rounded-lg grid place-items-center",
            accent ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
          )}
        >
          {icon}
        </div>
        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
      </div>
      <span
        className={cn(
          "text-[22px] font-extrabold tabular-nums tracking-tight",
          accent ? "text-primary" : "text-foreground",
        )}
      >
        {value}
      </span>
      <span className="text-[11px] text-muted-foreground font-medium">{hint}</span>
    </div>
  );
}

function ConfCell({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone: "good" | "bad" | "warn" | "neutral";
}) {
  const styles = {
    good: "bg-emerald-50 text-emerald-700 border-emerald-200",
    bad: "bg-rose-50 text-rose-700 border-rose-200",
    warn: "bg-amber-50 text-amber-700 border-amber-200",
    neutral: "bg-muted/50 text-muted-foreground border-border",
  }[tone];
  return (
    <div className={cn("rounded-[12px] border p-3 text-center", styles)}>
      <div className="text-[22px] font-extrabold tabular-nums leading-none">
        {value}
      </div>
      <div className="text-[10px] font-bold uppercase tracking-wider mt-1 opacity-70">
        {label}
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground">
      <span className={cn("size-2 rounded-full", color)} />
      {label}
    </span>
  );
}

function HourRow({
  bucket,
  max,
}: {
  bucket: ReturnType<typeof bucketByHour>[number];
  max: number;
}) {
  return (
    <div className="grid grid-cols-12 gap-3 items-center">
      <div className="col-span-2 sm:col-span-1 text-[12px] font-bold tabular-nums text-foreground">
        {bucket.hora}
      </div>
      <div className="col-span-7 sm:col-span-8 space-y-1">
        <div className="h-2 bg-muted rounded-full overflow-hidden relative">
          <div
            className="h-full bg-muted-foreground/50 rounded-full"
            style={{ width: `${((bucket.hitRate ?? 0) / max) * 100}%` }}
          />
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden relative">
          <div
            className="h-full bg-primary rounded-full"
            style={{ width: `${((bucket.alertHitRate ?? 0) / max) * 100}%` }}
          />
        </div>
      </div>
      <div className="col-span-3 text-right text-[11px] font-medium text-muted-foreground tabular-nums">
        <div>
          base{" "}
          <strong className="text-foreground">
            {bucket.hitRate !== null ? `${bucket.hitRate.toFixed(0)}%` : "—"}
          </strong>{" "}
          <span className="opacity-60">({bucket.aciertos}/{bucket.evaluadas})</span>
        </div>
        <div>
          alert{" "}
          <strong className="text-primary">
            {bucket.alertHitRate !== null ? `${bucket.alertHitRate.toFixed(0)}%` : "—"}
          </strong>{" "}
          <span className="opacity-60">({bucket.alertasAciertos}/{bucket.alertas})</span>
        </div>
      </div>
    </div>
  );
}