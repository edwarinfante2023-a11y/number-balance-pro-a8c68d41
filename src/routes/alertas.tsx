import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useAlerts } from "@/hooks/useAlerts";
import { PageHeader } from "@/components/PageHeader";
import {
  Bell,
  CheckCircle2,
  Trash2,
  AlertTriangle,
  Zap,
  Target,
  Clock,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

export const Route = createFileRoute("/alertas")({
  component: AlertasPage,
  head: () => ({
    meta: [{ title: "Alertas Internas — Cuadrante" }],
  }),
});

type FilterState = "todas" | "new" | "seen" | "dismissed";

function AlertasPage() {
  const { alerts, isLoading, updateAlertState, dismissAll } = useAlerts();
  const [filter, setFilter] = useState<FilterState>("todas");

  const filteredAlerts = useMemo(() => {
    if (filter === "todas") return alerts.filter((a) => a.estado !== "dismissed");
    return alerts.filter((a) => a.estado === filter);
  }, [alerts, filter]);

  if (isLoading) {
    return (
      <div className="pt-2">
        <PageHeader title="Alertas" description="Cargando motor de eventos..." />
        <div className="mt-8 grid place-items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  const unreadCount = alerts.filter((a) => a.estado === "new").length;

  return (
    <div className="pt-2 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="Centro de Alertas"
          description="Auditoría interna de señales fuertes y oportunidades detectadas"
        />
        {unreadCount > 0 && (
          <button
            onClick={() => {
              const newIds = alerts.filter(a => a.estado === 'new').map(a => a.id);
              if (newIds.length > 0) dismissAll.mutate(newIds);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-muted text-muted-foreground hover:bg-muted/80 rounded-full text-sm font-bold transition-colors"
          >
            <CheckCircle2 className="size-4" />
            Marcar todas leídas
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-xl">
          <FilterButton
            active={filter === "todas"}
            onClick={() => setFilter("todas")}
            label="Activas"
            count={alerts.filter((a) => a.estado !== "dismissed").length}
          />
          <FilterButton
            active={filter === "new"}
            onClick={() => setFilter("new")}
            label="Nuevas"
            count={unreadCount}
            highlight
          />
          <FilterButton
            active={filter === "seen"}
            onClick={() => setFilter("seen")}
            label="Vistas"
            count={alerts.filter((a) => a.estado === "seen").length}
          />
          <FilterButton
            active={filter === "dismissed"}
            onClick={() => setFilter("dismissed")}
            label="Descartadas"
            count={alerts.filter((a) => a.estado === "dismissed").length}
          />
        </div>
      </div>

      <div className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <div className="surface-elevated rounded-[24px] p-12 text-center animate-fade-up">
            <div className="mx-auto size-16 rounded-[20px] bg-muted/50 grid place-items-center mb-4">
              <Bell className="size-7 text-muted-foreground/40" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">Bandeja Vacía</h3>
            <p className="text-[14px] text-muted-foreground max-w-sm mx-auto">
              No hay alertas con este filtro. El sistema genera alertas cuando el score
              de Nivel 5 es críticamente alto.
            </p>
          </div>
        ) : (
          filteredAlerts.map((alert, idx) => (
            <div
              key={alert.id}
              className={cn(
                "surface-elevated rounded-[20px] p-4 sm:p-5 flex flex-col sm:flex-row gap-4 sm:items-center transition-all animate-fade-up border",
                alert.estado === "new"
                  ? alert.nivel === "critical"
                    ? "border-destructive/30 bg-destructive/5"
                    : "border-primary/20 bg-primary/5"
                  : "border-border/50 opacity-80"
              )}
              style={{ animationDelay: `${idx * 40}ms` }}
            >
              <div className="flex flex-1 items-start sm:items-center gap-4">
                <div
                  className={cn(
                    "size-10 rounded-[12px] grid place-items-center shrink-0",
                    alert.nivel === "critical"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-primary/10 text-primary"
                  )}
                >
                  {alert.tipo === "patron_detectado" ? (
                    <Zap className="size-5" />
                  ) : alert.tipo === "multiples_razones" ? (
                    <Target className="size-5" />
                  ) : (
                    <AlertTriangle className="size-5" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-[14px] font-extrabold text-foreground">
                      Hora Target: {alert.hora}
                    </span>
                    <span className="text-[11px] font-bold text-muted-foreground px-2 py-0.5 bg-muted rounded-md uppercase">
                      {alert.tipo.replace("_", " ")}
                    </span>
                    {alert.estado === "new" && (
                      <span className="flex size-2 rounded-full bg-primary animate-pulse" />
                    )}
                  </div>
                  <p className="text-[13px] text-muted-foreground font-medium leading-relaxed max-w-3xl">
                    {alert.descripcion}
                  </p>
                  <div className="flex items-center gap-4 mt-3">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground uppercase opacity-70">
                      <Clock className="size-3.5" />
                      {format(parseISO(alert.created_at), "dd MMM — HH:mm", {
                        locale: es,
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between sm:flex-col sm:items-end gap-3 shrink-0 sm:w-32 border-t sm:border-t-0 sm:border-l border-border/50 pt-3 sm:pt-0 sm:pl-4">
                <div className="flex flex-col items-start sm:items-end">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">
                    Score
                  </span>
                  <span
                    className={cn(
                      "text-[24px] font-black leading-none tabular-nums",
                      alert.nivel === "critical"
                        ? "text-destructive"
                        : "text-primary"
                    )}
                  >
                    {alert.score}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {alert.estado === "new" && (
                    <button
                      onClick={() => updateAlertState.mutate({ id: alert.id, estado: "seen" })}
                      className="p-2 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors rounded-lg bg-muted/50"
                      title="Marcar como vista"
                    >
                      <CheckCircle2 className="size-4" />
                    </button>
                  )}
                  {alert.estado !== "dismissed" && (
                    <button
                      onClick={() => updateAlertState.mutate({ id: alert.id, estado: "dismissed" })}
                      className="p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors rounded-lg bg-muted/50"
                      title="Descartar"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  label,
  count,
  highlight,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3.5 py-1.5 rounded-[9px] text-[12px] font-bold transition-all",
        active
          ? "bg-white text-foreground shadow-sm ring-1 ring-border"
          : "text-muted-foreground hover:bg-white/50 hover:text-foreground"
      )}
    >
      {label}
      <span
        className={cn(
          "px-1.5 py-0.5 rounded-md text-[10px] tabular-nums",
          highlight && count > 0
            ? "bg-primary text-white"
            : active
              ? "bg-muted text-foreground"
              : "bg-black/5"
        )}
      >
        {count}
      </span>
    </button>
  );
}
