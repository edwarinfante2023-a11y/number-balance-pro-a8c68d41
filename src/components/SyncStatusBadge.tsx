import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLastSync } from "@/hooks/useLastSync";

function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `hace ${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `hace ${diffHr} h`;
  const diffDay = Math.floor(diffHr / 24);
  return `hace ${diffDay} d`;
}

interface Props {
  compact?: boolean;
}

export function SyncStatusBadge({ compact = false }: Props) {
  const { data: lastSync, isLoading } = useLastSync();
  const [, setTick] = useState(0);

  // Re-render cada 30s para refrescar el "hace X min"
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  if (isLoading) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 h-12 bg-white border border-border rounded-full px-4 shadow-sm",
          compact && "h-9 px-3",
        )}
      >
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
        {!compact && (
          <span className="text-[12px] font-semibold text-muted-foreground">Sincronizando…</span>
        )}
      </div>
    );
  }

  const ageMs = lastSync ? Date.now() - lastSync.getTime() : Infinity;
  const isFresh = ageMs < 5 * 60 * 1000; // < 5 min => verde
  const Icon = isFresh ? CheckCircle2 : AlertCircle;
  const dotColor = isFresh ? "bg-emerald-500" : "bg-red-500";
  const ringColor = isFresh ? "ring-emerald-500/20" : "ring-red-500/20";
  const label = lastSync ? formatRelative(lastSync) : "sin datos";

  return (
    <div
      title={
        lastSync
          ? `Última sincronización: ${lastSync.toLocaleString()}`
          : "Aún no hay sincronizaciones registradas"
      }
      className={cn(
        "flex items-center gap-2 h-12 bg-white border border-border rounded-full px-4 shadow-sm hover:shadow-md transition-shadow cursor-default",
        compact && "h-9 px-3 gap-1.5",
      )}
    >
      <span className={cn("relative flex items-center justify-center size-2.5", "")}>
        <span
          className={cn(
            "absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping",
            dotColor,
          )}
        />
        <span className={cn("relative inline-flex rounded-full size-2.5 ring-4", dotColor, ringColor)} />
      </span>
      <Icon
        className={cn(
          "size-4",
          isFresh ? "text-emerald-600" : "text-red-600",
          compact && "size-3.5",
        )}
      />
      {!compact && (
        <div className="flex flex-col leading-none">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Sync Web
          </span>
          <span
            className={cn(
              "text-[12px] font-bold mt-0.5",
              isFresh ? "text-emerald-700" : "text-red-700",
            )}
          >
            {label}
          </span>
        </div>
      )}
      {compact && (
        <span
          className={cn(
            "text-[11px] font-bold",
            isFresh ? "text-emerald-700" : "text-red-700",
          )}
        >
          {label}
        </span>
      )}
    </div>
  );
}
