import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Flame, X, ChevronDown, ChevronUp } from "lucide-react";
import {
  useActiveOpportunityAlerts,
  dismissOpportunity,
  type OpportunityAlertRow,
} from "@/hooks/useOpportunityAlerts";
import { cn } from "@/lib/utils";

function minutesUntil(hora: string): number {
  const [hh, mm] = hora.split(":").map((v) => parseInt(v, 10));
  if (Number.isNaN(hh) || Number.isNaN(mm)) return 0;
  const now = new Date();
  const slot = hh * 60 + mm;
  return slot - (now.getHours() * 60 + now.getMinutes());
}

export function OpportunityBanner() {
  const { data: alerts = [] } = useActiveOpportunityAlerts();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  if (!alerts.length) return null;

  // Mostrar la más cercana primero
  const sorted = [...alerts].sort((a, b) => minutesUntil(a.hora) - minutesUntil(b.hora));
  const primary = sorted[0];
  const rest = sorted.slice(1);

  return (
    <div className="sticky top-0 z-40 w-full">
      <div className="bg-primary text-primary-foreground shadow-md">
        <Row alert={primary} navigate={navigate} restCount={rest.length} expanded={expanded} onToggle={() => setExpanded((v) => !v)} />
        {expanded && rest.map((a) => (
          <div key={a.id} className="border-t border-primary-foreground/20">
            <Row alert={a} navigate={navigate} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Row({
  alert, navigate, restCount = 0, expanded, onToggle,
}: {
  alert: OpportunityAlertRow;
  navigate: ReturnType<typeof useNavigate>;
  restCount?: number;
  expanded?: boolean;
  onToggle?: () => void;
}) {
  const mins = minutesUntil(alert.hora);
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 text-[13px] font-semibold">
      <Flame className="size-4 shrink-0" />
      <span className="font-bold tabular-nums">{alert.hora}</span>
      <span className="opacity-90">· score {alert.internal_score}/100</span>
      <span className={cn("opacity-90 hidden sm:inline", mins < 0 && "line-through")}>
        · {mins > 0 ? `cierra en ~${mins} min` : "ya pasó"}
      </span>
      <div className="ml-auto flex items-center gap-1.5">
        {restCount > 0 && onToggle && (
          <button
            onClick={onToggle}
            className="h-7 px-2.5 rounded-lg bg-primary-foreground/15 hover:bg-primary-foreground/25 text-[11px] font-bold inline-flex items-center gap-1"
          >
            +{restCount} más {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          </button>
        )}
        <button
          onClick={() => navigate({ to: "/cartera", search: { hora: alert.hora } as any })}
          className="h-7 px-3 rounded-lg bg-white text-primary text-[11px] font-bold hover:bg-white/90 transition"
        >
          Ver
        </button>
        <button
          onClick={() => dismissOpportunity(alert.id)}
          className="size-7 rounded-lg hover:bg-primary-foreground/15 grid place-items-center"
          aria-label="Descartar"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}