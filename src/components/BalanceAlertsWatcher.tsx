import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Scale } from "lucide-react";
import { useBalanceAlerts } from "@/hooks/useBalanceAlerts";

/**
 * Componente sin UI: vigila las alertas de desbalance globales y dispara
 * un toast la primera vez que aparece cada alerta única dentro de la sesión.
 * No persiste en BD — pensado para reactividad inmediata cliente.
 */
export function BalanceAlertsWatcher() {
  const navigate = useNavigate();
  const { alerts, config } = useBalanceAlerts(30);
  const seenRef = useRef<Set<string>>(new Set());
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (!config.enabled) return;

    // Primera pasada: marcar todo como visto sin tostar (evita ruido al login)
    if (!hydratedRef.current) {
      alerts.forEach((a) => seenRef.current.add(a.id));
      hydratedRef.current = true;
      return;
    }

    for (const a of alerts) {
      if (seenRef.current.has(a.id)) continue;
      seenRef.current.add(a.id);

      const title =
        a.severity === "critical"
          ? `🚨 Desbalance crítico ${a.hora}`
          : `⚖️ Desbalance detectado ${a.hora}`;
      const description = `${a.category} domina ${a.dominantSide} con ${a.pct.toFixed(1)}% (Δ +${a.delta.toFixed(1)}pts · ${a.total} sorteos)`;

      const fn = a.severity === "critical" ? toast.error : toast.warning;
      fn(title, {
        description,
        icon: <Scale className="size-4" />,
        duration: 8000,
        action: {
          label: "Ver",
          onClick: () => navigate({ to: "/equilibrio" }),
        },
      });
    }
  }, [alerts, config.enabled, navigate]);

  return null;
}
