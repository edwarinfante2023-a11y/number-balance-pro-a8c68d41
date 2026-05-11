import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Flame } from "lucide-react";
import { useActiveOpportunityAlerts } from "@/hooks/useOpportunityAlerts";

/**
 * Watcher sin UI: toast + sonido la primera vez que aparece cada
 * opportunity_alert dentro de la sesión. Realtime ya cubre invalidación.
 */
export function OpportunityWatcher() {
  const navigate = useNavigate();
  const { data: alerts = [] } = useActiveOpportunityAlerts();
  const seenRef = useRef<Set<string>>(new Set());
  const hydratedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    audioRef.current = new Audio("/notification.wav");
    audioRef.current.volume = 0.6;
  }, []);

  useEffect(() => {
    // Primera pasada: marcar todo como visto sin tostar (no hacer ruido al login)
    if (!hydratedRef.current) {
      alerts.forEach((a) => seenRef.current.add(a.id));
      hydratedRef.current = true;
      return;
    }

    for (const a of alerts) {
      if (seenRef.current.has(a.id)) continue;
      seenRef.current.add(a.id);

      toast(`🔥 Oportunidad ${a.hora}`, {
        description: `Score ${a.internal_score}/100 · 25 números listos · sorteo en ~30 min`,
        icon: <Flame className="size-4 text-primary" />,
        duration: Infinity,
        action: {
          label: "Ver cartera",
          onClick: () => navigate({ to: "/cartera", search: { hora: a.hora } as any }),
        },
      });

      // Sonido (silencioso si autoplay bloqueado)
      audioRef.current?.play().catch(() => {});
    }
  }, [alerts, navigate]);

  return null;
}