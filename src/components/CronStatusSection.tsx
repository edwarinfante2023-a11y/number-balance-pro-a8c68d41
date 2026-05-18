import { useState } from "react";
import { Activity, CheckCircle2, AlertTriangle, XCircle, RefreshCw, Loader2, Clock } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useCronStatus } from "@/hooks/useCronStatus";

// Umbrales de salud (cron corre cada hora)
const WARN_MIN = 90; // > 90 min sin ejecutar = warning
const CRIT_MIN = 180; // > 3h sin ejecutar = critical

type Health = "ok" | "warn" | "crit" | "none";

function healthFromDelay(min: number | null): Health {
  if (min === null) return "none";
  if (min > CRIT_MIN) return "crit";
  if (min > WARN_MIN) return "warn";
  return "ok";
}

const HEALTH_STYLE: Record<Health, { bg: string; text: string; label: string; Icon: typeof CheckCircle2 }> = {
  ok: { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", label: "Operativo", Icon: CheckCircle2 },
  warn: { bg: "bg-amber-50 border-amber-200", text: "text-amber-700", label: "Retraso", Icon: AlertTriangle },
  crit: { bg: "bg-rose-50 border-rose-200", text: "text-rose-700", label: "Sin ejecutar", Icon: XCircle },
  none: { bg: "bg-slate-50 border-slate-200", text: "text-slate-500", label: "Sin datos", Icon: AlertTriangle },
};

function formatRelative(min: number | null): string {
  if (min === null) return "—";
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h < 24) return `hace ${h}h${m > 0 ? ` ${m}m` : ""}`;
  const d = Math.floor(h / 24);
  return `hace ${d}d`;
}

export function CronStatusSection() {
  const { data, isLoading, refetch } = useCronStatus();
  const qc = useQueryClient();
  const [running, setRunning] = useState<null | "gen" | "eval" | "force_gen">(null);

  const triggerEndpoint = async (kind: "gen" | "eval" | "force_gen") => {
    setRunning(kind);
    try {
      const url =
        kind === "gen"
          ? "/api/public/hooks/generate-carteras"
          : kind === "force_gen"
          ? "/api/public/hooks/generate-carteras?force=true"
          : "/api/public/hooks/evaluate-results";
      const res = await fetch(url, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.ok === false) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      toast.success(
        kind === "gen" || kind === "force_gen"
          ? `Generación: ${json.generated?.length ?? json.creadas ?? 0} carteras`
          : `Evaluación: ${json.evaluadas ?? 0} (${json.aciertos ?? 0} aciertos)`,
      );
      qc.invalidateQueries({ queryKey: ["cron_status"] });
      qc.invalidateQueries({ queryKey: ["opportunity_history"] });
      qc.invalidateQueries({ queryKey: ["score_metrics"] });
      qc.invalidateQueries({ queryKey: ["carteras"] });
      qc.invalidateQueries({ queryKey: ["cartera-stats"] });
      qc.invalidateQueries({ queryKey: ["carteras-dia"] });
      refetch();
    } catch (err: any) {
      toast.error(err?.message ?? "Error ejecutando cron");
    } finally {
      setRunning(null);
    }
  };

  if (isLoading || !data) {
    return (
      <div className="surface-elevated rounded-[24px] p-6 flex items-center gap-3">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
        <span className="text-[13px] font-medium text-muted-foreground">
          Cargando estado del cron...
        </span>
      </div>
    );
  }

  const genHealth = healthFromDelay(data.generacionRetrasoMin);
  const evalHealth = healthFromDelay(data.evaluacionRetrasoMin);
  const overall: Health =
    genHealth === "crit" || evalHealth === "crit"
      ? "crit"
      : genHealth === "warn" || evalHealth === "warn"
        ? "warn"
        : genHealth === "none" && evalHealth === "none"
          ? "none"
          : "ok";
  const Overall = HEALTH_STYLE[overall];

  return (
    <div className="surface-elevated rounded-[24px] lg:rounded-[32px] p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-[20px] font-bold text-foreground flex items-center gap-2">
            <Activity className="size-5 text-primary" />
            Estado del cron
          </h2>
          <p className="text-[13px] text-muted-foreground mt-1 font-medium">
            Generación de carteras y evaluación de resultados (últimas 24h)
          </p>
        </div>
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full border text-[12px] font-bold",
            Overall.bg,
            Overall.text,
          )}
        >
          <Overall.Icon className="size-3.5" />
          {Overall.label}
        </div>
      </div>

      {/* Dos paneles: generación y evaluación */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <JobCard
          title="Generar carteras"
          schedule="cada hora · :02"
          health={genHealth}
          lastAt={data.lastCarteraAt}
          delayMin={data.generacionRetrasoMin}
          counts={[
            { label: "Carteras 24h", value: data.carteras24h.toString() },
          ]}
          running={running === "gen"}
          onRun={() => triggerEndpoint("gen")}
        />
        <JobCard
          title="Evaluar resultados"
          schedule="cada hora · :05"
          health={evalHealth}
          lastAt={data.lastResultadoAt}
          delayMin={data.evaluacionRetrasoMin}
          counts={[
            { label: "Evaluados 24h", value: data.resultados24h.toString() },
            { label: "Aciertos 24h", value: data.aciertos24h.toString() },
            {
              label: "Hit rate 24h",
              value: data.hitRate24h !== null ? `${data.hitRate24h.toFixed(1)}%` : "—",
            },
          ]}
          running={running === "eval"}
          onRun={() => triggerEndpoint("eval")}
        />
      </div>

      {/* Botón de Regeneración Forzada */}
      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={() => triggerEndpoint("force_gen")}
          disabled={running !== null}
          className="flex items-center gap-2 px-5 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-[14px] text-[13px] font-bold shadow-sm shadow-rose-500/20 transition disabled:opacity-50"
        >
          {running === "force_gen" ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Regenerar TODO el día (Fuerza Bruta)
        </button>
      </div>

      {/* Hint */}
      <p className="text-[11px] text-muted-foreground font-medium">
        El cron se ejecuta automáticamente cada hora. Si una tarea lleva más de
        90 min sin correr aparece como retraso; más de 3h, como sin ejecutar.
      </p>
    </div>
  );
}

function JobCard({
  title,
  schedule,
  health,
  lastAt,
  delayMin,
  counts,
  running,
  onRun,
}: {
  title: string;
  schedule: string;
  health: Health;
  lastAt: string | null;
  delayMin: number | null;
  counts: { label: string; value: string }[];
  running: boolean;
  onRun: () => void;
}) {
  const style = HEALTH_STYLE[health];
  return (
    <div className={cn("rounded-[20px] border p-5 space-y-4", style.bg)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <style.Icon className={cn("size-4", style.text)} />
            <h3 className="text-[14px] font-bold text-foreground">{title}</h3>
          </div>
          <p className="text-[11px] text-muted-foreground font-medium mt-0.5 flex items-center gap-1">
            <Clock className="size-3" />
            {schedule}
          </p>
        </div>
        <button
          type="button"
          onClick={onRun}
          disabled={running}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-border text-[11px] font-bold text-foreground hover:bg-muted transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {running ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <RefreshCw className="size-3" />
          )}
          Ejecutar
        </button>
      </div>

      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
          Última ejecución
        </span>
        <span className={cn("text-[13px] font-bold tabular-nums", style.text)}>
          {formatRelative(delayMin)}
        </span>
      </div>
      {lastAt && (
        <div className="text-[11px] text-muted-foreground font-medium -mt-2">
          {new Date(lastAt).toLocaleString()}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border/60">
        {counts.map((c) => (
          <div key={c.label} className="flex flex-col">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              {c.label}
            </span>
            <span className="text-[16px] font-extrabold text-foreground tabular-nums">
              {c.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
