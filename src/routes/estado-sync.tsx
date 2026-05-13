import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Clock,
  Database,
  Timer,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/estado-sync")({
  component: EstadoSyncPage,
});

type SlotStat = {
  slug: string;
  hora: string;
  upserts: number;
  errores: number;
  periodos_ok: number;
  periodos_total: number;
};

type SyncRun = {
  id: string;
  created_at: string;
  ok: boolean;
  duration_ms: number;
  slots_total: number;
  periodos_total: number;
  combinaciones: number;
  upserts: number;
  errores: number;
  detalle: string[];
  by_slot: Record<string, SlotStat>;
  triggered_by: string;
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function fmtRelative(iso: string) {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return `hace ${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `hace ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `hace ${hr} h`;
  return `hace ${Math.floor(hr / 24)} d`;
}

function fmtDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${Math.round(s % 60)}s`;
}

function EstadoSyncPage() {
  const { data: runs = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["lottery_stats_sync_runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lottery_stats_sync_runs" as never)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as unknown as SyncRun[];
    },
  });

  const last = runs[0];

  return (
    <div className="space-y-6 p-4 lg:p-8 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[24px] lg:text-[32px] font-extrabold text-foreground tracking-tight">
            Estado del Sync de Estadísticas
          </h1>
          <p className="text-[13px] font-semibold text-muted-foreground mt-1">
            Histórico agregado de enloteria.com · 15 anguillas × 6 periodos = 90 combinaciones
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 h-10 rounded-[12px] bg-primary text-primary-foreground hover:bg-primary/90 px-4 text-[12px] font-bold transition-all disabled:opacity-50"
        >
          <RefreshCw className={cn("size-3.5", isFetching && "animate-spin")} />
          Refrescar
        </button>
      </div>

      {/* Resumen último run */}
      {last && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <SummaryCard
            icon={Clock}
            label="Última ejecución"
            value={fmtRelative(last.created_at)}
            sub={fmtDate(last.created_at)}
          />
          <SummaryCard
            icon={Database}
            label="Filas guardadas"
            value={last.upserts.toLocaleString()}
            sub={`${last.combinaciones} combinaciones`}
          />
          <SummaryCard
            icon={Timer}
            label="Duración"
            value={fmtDuration(last.duration_ms)}
            sub={`${last.slots_total} slots × ${last.periodos_total} periodos`}
          />
          <SummaryCard
            icon={last.errores === 0 ? CheckCircle2 : AlertTriangle}
            label="Errores"
            value={last.errores.toString()}
            sub={last.ok ? "Todo OK" : "Con incidencias"}
            tone={last.errores === 0 ? "ok" : last.errores > 5 ? "bad" : "warn"}
          />
        </div>
      )}

      {/* Grid por slot del último run */}
      {last && Object.keys(last.by_slot).length > 0 && (
        <div className="bg-white rounded-[24px] border border-border shadow-sm p-5 lg:p-6">
          <h2 className="text-[14px] font-extrabold text-foreground uppercase tracking-wider mb-4">
            Estado por anguilla (último run)
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 gap-2">
            {Object.values(last.by_slot)
              .sort((a, b) => a.hora.localeCompare(b.hora))
              .map((slot) => {
                const allOk = slot.errores === 0 && slot.periodos_ok === slot.periodos_total;
                const partial = slot.periodos_ok > 0 && !allOk;
                return (
                  <div
                    key={slot.hora}
                    className={cn(
                      "rounded-[12px] border p-3 text-center",
                      allOk && "bg-emerald-50 border-emerald-200",
                      partial && "bg-amber-50 border-amber-200",
                      !allOk && !partial && "bg-red-50 border-red-200",
                    )}
                  >
                    <div className="text-[13px] font-extrabold text-foreground tabular-nums">
                      {slot.hora}
                    </div>
                    <div className="text-[10px] font-bold uppercase text-muted-foreground mt-0.5">
                      {slot.slug}
                    </div>
                    <div className="text-[11px] font-bold text-foreground mt-2 tabular-nums">
                      {slot.upserts}
                    </div>
                    <div className="text-[10px] font-semibold text-muted-foreground">filas</div>
                    <div
                      className={cn(
                        "text-[10px] font-bold mt-1 tabular-nums",
                        slot.periodos_ok === slot.periodos_total
                          ? "text-emerald-700"
                          : "text-red-700",
                      )}
                    >
                      {slot.periodos_ok}/{slot.periodos_total} periodos
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Lista de runs */}
      <div className="bg-white rounded-[24px] border border-border shadow-sm p-5 lg:p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="size-10 rounded-xl bg-primary/10 grid place-items-center">
            <Activity className="size-5 text-primary" />
          </div>
          <div>
            <h2 className="text-[14px] font-extrabold text-foreground uppercase tracking-wider">
              Bitácora de runs
            </h2>
            <p className="text-[11px] font-semibold text-muted-foreground">
              Últimas 20 ejecuciones del scraper de estadísticas
            </p>
          </div>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-[13px] font-bold text-muted-foreground">
            <Loader2 className="size-5 animate-spin inline mr-3 text-primary" />
            Cargando…
          </div>
        ) : runs.length === 0 ? (
          <div className="text-[12px] font-bold text-muted-foreground/50 text-center py-16 uppercase border-2 border-dashed border-border rounded-[20px]">
            Sin ejecuciones registradas todavía. Disparalo desde
            <code className="mx-1">POST /api/public/hooks/sync-lottery-stats</code>
          </div>
        ) : (
          <ul className="space-y-2">
            {runs.map((r) => (
              <RunRow key={r.id} run={r} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  sub,
  tone = "neutral",
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  sub: string;
  tone?: "ok" | "warn" | "bad" | "neutral";
}) {
  const toneClass =
    tone === "ok"
      ? "text-emerald-700 bg-emerald-50"
      : tone === "warn"
      ? "text-amber-700 bg-amber-50"
      : tone === "bad"
      ? "text-red-700 bg-red-50"
      : "text-primary bg-primary/10";
  return (
    <div className="bg-white rounded-[20px] border border-border shadow-sm p-4">
      <div className="flex items-center gap-2">
        <div className={cn("size-8 rounded-lg grid place-items-center", toneClass)}>
          <Icon className="size-4" />
        </div>
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="text-[22px] font-extrabold text-foreground tabular-nums mt-2">{value}</div>
      <div className="text-[11px] font-semibold text-muted-foreground mt-0.5">{sub}</div>
    </div>
  );
}

function RunRow({ run }: { run: SyncRun }) {
  const [open, setOpen] = useState(false);
  let Icon = CheckCircle2;
  let iconColor = "text-emerald-600";
  let badge = "OK";
  let badgeBg = "bg-emerald-100 text-emerald-800";
  if (run.errores > 0 && run.upserts === 0) {
    Icon = XCircle;
    iconColor = "text-red-600";
    badge = "FATAL";
    badgeBg = "bg-red-100 text-red-800";
  } else if (run.errores > 0) {
    Icon = AlertTriangle;
    iconColor = "text-amber-600";
    badge = "WARN";
    badgeBg = "bg-amber-100 text-amber-800";
  }
  const slotsConError = Object.values(run.by_slot ?? {}).filter((s) => s.errores > 0);

  return (
    <li className="rounded-[16px] border border-border bg-white shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="size-7 rounded-[8px] bg-muted flex items-center justify-center text-muted-foreground shrink-0">
          {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </div>
        <Icon className={cn("size-5 shrink-0", iconColor)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-bold text-foreground tabular-nums">
              {fmtDate(run.created_at)}
            </span>
            <span className="text-[11px] font-semibold text-muted-foreground">
              · {fmtRelative(run.created_at)}
            </span>
            <span
              className={cn(
                "text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md",
                badgeBg,
              )}
            >
              {badge}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
              {run.triggered_by}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-[11px] font-semibold tabular-nums flex-wrap">
            <span className="text-muted-foreground">
              dur <strong className="text-foreground">{fmtDuration(run.duration_ms)}</strong>
            </span>
            <span className="text-muted-foreground">
              slots <strong className="text-foreground">{run.slots_total}</strong>
            </span>
            <span className="text-muted-foreground">
              periodos <strong className="text-foreground">{run.periodos_total}</strong>
            </span>
            <span className="text-emerald-700">
              filas <strong>{run.upserts.toLocaleString()}</strong>
            </span>
            <span className={cn(run.errores > 0 ? "text-red-700" : "text-muted-foreground")}>
              err <strong>{run.errores}</strong>
            </span>
          </div>
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-2 bg-muted/20 border-t border-border space-y-3">
          {slotsConError.length > 0 && (
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-red-700 mb-1">
                Slots con errores
              </div>
              <div className="flex flex-wrap gap-1">
                {slotsConError.map((s) => (
                  <span
                    key={s.hora}
                    className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-red-100 text-red-800 tabular-nums"
                  >
                    {s.hora} · {s.errores} err
                  </span>
                ))}
              </div>
            </div>
          )}
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground mb-1">
              Detalle
            </div>
            {run.detalle.length === 0 ? (
              <div className="text-[11px] italic text-muted-foreground/60">Sin detalle</div>
            ) : (
              <ul className="space-y-0.5 max-h-[260px] overflow-y-auto pr-2">
                {run.detalle.map((line, i) => (
                  <li
                    key={i}
                    className={cn(
                      "text-[11px] font-mono leading-relaxed",
                      line.startsWith("✗") ? "text-red-700" : "text-foreground/80",
                    )}
                  >
                    {line}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </li>
  );
}