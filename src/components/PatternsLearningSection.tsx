import { useState, useEffect, useMemo } from "react";
import {
  Brain,
  CheckCircle2,
  Eye,
  XCircle,
  RefreshCw,
  Loader2,
  Save,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { usePatterns, type Pattern } from "@/hooks/usePatterns";
import {
  usePatternLearningConfig,
  useUpdatePatternLearningConfig,
  usePatternLearningLastRun,
  type PatternLearningConfig,
} from "@/hooks/useSettings";

type Estado = "observacion" | "activo" | "descartado";

const ESTADO_STYLE: Record<Estado, { bg: string; text: string; label: string; Icon: typeof CheckCircle2 }> = {
  activo: { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", label: "Activo", Icon: CheckCircle2 },
  observacion: { bg: "bg-amber-50 border-amber-200", text: "text-amber-700", label: "Observación", Icon: Eye },
  descartado: { bg: "bg-rose-50 border-rose-200", text: "text-rose-700", label: "Descartado", Icon: XCircle },
};

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

export function PatternsLearningSection() {
  const { patterns, isLoading: patternsLoading } = usePatterns();
  const { data: cfg, isLoading: cfgLoading } = usePatternLearningConfig();
  const { data: lastRun } = usePatternLearningLastRun();
  const updateCfg = useUpdatePatternLearningConfig();
  const qc = useQueryClient();

  const [draft, setDraft] = useState<PatternLearningConfig | null>(null);
  const [running, setRunning] = useState(false);
  const [filter, setFilter] = useState<Estado | "todos">("todos");

  useEffect(() => {
    if (cfg && !draft) setDraft(cfg);
  }, [cfg, draft]);

  const stats = useMemo(() => {
    const counts = { activo: 0, observacion: 0, descartado: 0 };
    for (const p of patterns) {
      const e = (p.estado as Estado) ?? "observacion";
      if (e in counts) counts[e]++;
    }
    return counts;
  }, [patterns]);

  const filtered = useMemo(() => {
    const arr = filter === "todos" ? patterns : patterns.filter((p) => p.estado === filter);
    return [...arr].sort((a, b) => Number(b.efectividad ?? 0) - Number(a.efectividad ?? 0));
  }, [patterns, filter]);

  const saveCfg = async () => {
    if (!draft) return;
    try {
      await updateCfg.mutateAsync(draft);
      toast.success("Configuración guardada");
    } catch (e: any) {
      toast.error(e?.message ?? "Error al guardar");
    }
  };

  const triggerLearn = async () => {
    setRunning(true);
    try {
      const res = await fetch("/api/public/hooks/learn-patterns", { method: "POST" });
      const json = await res.json();
      if (!res.ok || json.ok === false) throw new Error(json.error ?? `HTTP ${res.status}`);
      if (json.skipped) {
        toast.info("Aprendizaje deshabilitado en config");
      } else {
        toast.success(
          `${json.evaluated} evaluados · ${json.promoted} promovidos · ${json.descarted} descartados`,
        );
      }
      qc.invalidateQueries({ queryKey: ["patterns"] });
      qc.invalidateQueries({ queryKey: ["settings", "pattern_learning_last_run"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Error ejecutando aprendizaje");
    } finally {
      setRunning(false);
    }
  };

  if (patternsLoading || cfgLoading || !draft) {
    return (
      <div className="surface-elevated rounded-[24px] p-6 flex items-center gap-3">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
        <span className="text-[13px] text-muted-foreground font-medium">Cargando patrones...</span>
      </div>
    );
  }

  return (
    <div className="surface-elevated rounded-[24px] lg:rounded-[32px] p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-[20px] font-bold text-foreground flex items-center gap-2">
            <Brain className="size-5 text-primary" />
            Aprendizaje de patrones
          </h2>
          <p className="text-[13px] text-muted-foreground mt-1 font-medium">
            Promoción y descarte automático según efectividad real
          </p>
        </div>
        <button
          type="button"
          onClick={triggerLearn}
          disabled={running}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-[12px] font-bold hover:opacity-90 disabled:opacity-50"
        >
          {running ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          Ejecutar ahora
        </button>
      </div>

      {/* Stats actuales */}
      <div className="grid grid-cols-3 gap-3">
        <StateCount estado="activo" count={stats.activo} />
        <StateCount estado="observacion" count={stats.observacion} />
        <StateCount estado="descartado" count={stats.descartado} />
      </div>

      {/* Último run */}
      {lastRun && (
        <div className="rounded-[14px] bg-muted/40 border border-border p-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-[12px] text-muted-foreground font-medium">
            Último ciclo: <span className="text-foreground font-bold">{formatRelative(lastRun.ranAt)}</span> ·{" "}
            <span className="text-emerald-700 font-bold">{lastRun.promoted} promovidos</span> ·{" "}
            <span className="text-rose-700 font-bold">{lastRun.descarted} descartados</span> · de {lastRun.evaluated}
          </div>
        </div>
      )}

      {/* Configuración */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[14px] font-bold text-foreground">Reglas de aprendizaje</h3>
          <label className="flex items-center gap-2 text-[12px] font-bold cursor-pointer">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
              className="size-4"
            />
            <span className={draft.enabled ? "text-emerald-700" : "text-muted-foreground"}>
              {draft.enabled ? "Habilitado" : "Deshabilitado"}
            </span>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Promover */}
          <div className="rounded-[14px] border border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
            <div className="flex items-center gap-2 text-[12px] font-bold text-emerald-700">
              <TrendingUp className="size-4" />
              Promover (observación → activo)
            </div>
            <NumberField
              label="Mínimo de ocurrencias"
              value={draft.promote.minOcurrencias}
              onChange={(v) => setDraft({ ...draft, promote: { ...draft.promote, minOcurrencias: v } })}
            />
            <NumberField
              label="Efectividad mínima (%)"
              value={draft.promote.minEfectividad}
              onChange={(v) => setDraft({ ...draft, promote: { ...draft.promote, minEfectividad: v } })}
            />
          </div>

          {/* Descartar */}
          <div className="rounded-[14px] border border-rose-200 bg-rose-50/50 p-4 space-y-3">
            <div className="flex items-center gap-2 text-[12px] font-bold text-rose-700">
              <TrendingDown className="size-4" />
              Descartar (activo → descartado)
            </div>
            <NumberField
              label="Mínimo de ocurrencias"
              value={draft.descarte.minOcurrencias}
              onChange={(v) => setDraft({ ...draft, descarte: { ...draft.descarte, minOcurrencias: v } })}
            />
            <NumberField
              label="Efectividad máxima (%)"
              value={draft.descarte.maxEfectividad}
              onChange={(v) => setDraft({ ...draft, descarte: { ...draft.descarte, maxEfectividad: v } })}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={saveCfg}
            disabled={updateCfg.isPending || JSON.stringify(draft) === JSON.stringify(cfg)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-white text-[12px] font-bold hover:bg-muted disabled:opacity-50"
          >
            {updateCfg.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            Guardar config
          </button>
        </div>
      </div>

      {/* Tabla de patrones */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[14px] font-bold text-foreground">Patrones</h3>
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            {(["todos", "activo", "observacion", "descartado"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition",
                  filter === f ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-8 text-[13px] text-muted-foreground font-medium">
            Sin patrones que mostrar
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
            {filtered.map((p) => (
              <PatternRow key={p.id} pattern={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-[11px]">
      <span className="font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-20 px-2 py-1 rounded border border-border bg-white text-[13px] font-bold text-foreground tabular-nums text-right"
      />
    </label>
  );
}

function StateCount({ estado, count }: { estado: Estado; count: number }) {
  const s = ESTADO_STYLE[estado];
  return (
    <div className={cn("rounded-[14px] border p-4 flex items-center gap-3", s.bg)}>
      <s.Icon className={cn("size-5", s.text)} />
      <div>
        <div className="text-[20px] font-extrabold text-foreground tabular-nums leading-none">{count}</div>
        <div className={cn("text-[11px] font-bold uppercase tracking-wider mt-1", s.text)}>{s.label}</div>
      </div>
    </div>
  );
}

function PatternRow({ pattern }: { pattern: Pattern }) {
  const estado = (pattern.estado as Estado) ?? "observacion";
  const s = ESTADO_STYLE[estado];
  const ef = Number(pattern.efectividad ?? 0);
  const oc = Number(pattern.ocurrencias ?? 0);
  const ac = Number(pattern.aciertos ?? 0);

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-[12px] border border-border bg-white hover:bg-muted/30 transition">
      <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold border shrink-0", s.bg, s.text)}>
        <s.Icon className="size-3" />
        {s.label}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-bold text-foreground truncate">{pattern.nombre}</div>
        {pattern.hora && (
          <div className="text-[11px] text-muted-foreground font-medium">{pattern.hora}</div>
        )}
      </div>
      <div className="flex items-center gap-4 text-[11px] tabular-nums shrink-0">
        <Stat label="Aciertos" value={`${ac}/${oc}`} />
        <Stat label="Efectividad" value={`${ef.toFixed(1)}%`} highlight={ef >= 60} danger={ef <= 40 && oc >= 10} />
      </div>
    </div>
  );
}

function Stat({ label, value, highlight, danger }: { label: string; value: string; highlight?: boolean; danger?: boolean }) {
  return (
    <div className="text-right">
      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</div>
      <div
        className={cn(
          "text-[13px] font-extrabold",
          highlight ? "text-emerald-700" : danger ? "text-rose-700" : "text-foreground",
        )}
      >
        {value}
      </div>
    </div>
  );
}