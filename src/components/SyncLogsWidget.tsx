import { useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronRight,
  Activity,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useSyncLogs, type SyncLog } from "@/hooks/useSyncLogs";
import { cn } from "@/lib/utils";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `hace ${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `hace ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `hace ${hr} h`;
  return `hace ${Math.floor(hr / 24)} d`;
}

export function SyncLogsWidget() {
  const { data: logs = [], isLoading, refetch, isFetching } = useSyncLogs(20);

  return (
    <div className="bg-white rounded-[24px] lg:rounded-[32px] border border-border shadow-sm p-5 lg:p-8 relative overflow-hidden">
      <div className="flex items-center justify-between mb-6 border-b border-border pb-6">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-primary/10 grid place-items-center">
            <Activity className="size-5 text-primary" />
          </div>
          <div>
            <h3 className="text-[16px] font-bold text-foreground">Bitácora de Sincronización</h3>
            <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-widest mt-0.5">
              Últimas 20 ejecuciones · sync-web
            </p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 h-10 rounded-[12px] bg-muted/50 hover:bg-muted border border-border px-4 text-[12px] font-bold text-foreground transition-all disabled:opacity-50"
          title="Recargar"
        >
          <RefreshCw className={cn("size-3.5", isFetching && "animate-spin")} />
          Refrescar
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10 text-[13px] font-bold text-muted-foreground">
          <Loader2 className="size-5 animate-spin inline mr-3 text-primary" />
          Cargando bitácora…
        </div>
      ) : logs.length === 0 ? (
        <div className="text-[12px] font-bold text-muted-foreground/50 text-center py-16 uppercase border-2 border-dashed border-border rounded-[20px]">
          Sin ejecuciones registradas todavía
        </div>
      ) : (
        <ul className="space-y-2 max-h-[480px] overflow-y-auto pr-2 custom-scrollbar">
          {logs.map((log) => (
            <SyncLogRow key={log.id} log={log} />
          ))}
        </ul>
      )}
    </div>
  );
}

function SyncLogRow({ log }: { log: SyncLog }) {
  const [open, setOpen] = useState(false);

  let Icon = CheckCircle2;
  let iconColor = "text-emerald-600";
  let bgRing = "border-emerald-200/60";
  let badge = "OK";
  let badgeBg = "bg-emerald-100 text-emerald-800";

  if (!log.ok && log.errores > 0 && log.total_procesadas === 0) {
    Icon = XCircle;
    iconColor = "text-red-600";
    bgRing = "border-red-200/60";
    badge = "FATAL";
    badgeBg = "bg-red-100 text-red-800";
  } else if (log.errores > 0) {
    Icon = AlertTriangle;
    iconColor = "text-amber-600";
    bgRing = "border-amber-200/60";
    badge = "WARN";
    badgeBg = "bg-amber-100 text-amber-800";
  }

  return (
    <li className={cn("rounded-[16px] border bg-white shadow-sm overflow-hidden", bgRing)}>
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
              {formatDateTime(log.created_at)}
            </span>
            <span className="text-[11px] font-semibold text-muted-foreground">
              · {formatRelative(log.created_at)}
            </span>
            <span
              className={cn(
                "text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md",
                badgeBg,
              )}
            >
              {badge}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-[11px] font-semibold tabular-nums">
            <span className="text-muted-foreground">
              proc <strong className="text-foreground">{log.total_procesadas}</strong>
            </span>
            <span className="text-emerald-700">
              + nuevas <strong>{log.nuevas}</strong>
            </span>
            <span className="text-muted-foreground">
              dup <strong className="text-foreground">{log.duplicadas}</strong>
            </span>
            <span className={cn(log.errores > 0 ? "text-red-700" : "text-muted-foreground")}>
              err <strong>{log.errores}</strong>
            </span>
          </div>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 bg-muted/20 border-t border-border">
          {log.detalle.length === 0 ? (
            <div className="text-[11px] font-semibold text-muted-foreground/60 italic py-2">
              Sin detalle
            </div>
          ) : (
            <ul className="space-y-1 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
              {log.detalle.map((line, idx) => (
                <li
                  key={idx}
                  className="text-[11px] font-mono text-foreground/80 leading-relaxed py-0.5"
                >
                  {line}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}
