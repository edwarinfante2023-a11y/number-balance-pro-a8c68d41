import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface PushSubscriptionRow {
  id: string;
  endpoint: string;
  user_agent: string | null;
  activa: boolean;
  created_at: string;
  last_seen_at: string;
}

/** Lista todas las push_subscriptions del usuario actual. */
export function usePushSubscriptions() {
  const { session } = useAuth();
  const userId = session?.user?.id;

  return useQuery<PushSubscriptionRow[]>({
    queryKey: ["push-subscriptions", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("push_subscriptions")
        .select("id, endpoint, user_agent, activa, created_at, last_seen_at")
        .eq("user_id", userId)
        .order("last_seen_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PushSubscriptionRow[];
    },
  });
}

/** Marca como inactiva una suscripción específica. */
export function useRevokePushSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("push_subscriptions")
        .update({ activa: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["push-subscriptions"] });
    },
  });
}

/** Helper: parsea el user_agent para mostrar algo legible. */
export function parseDeviceLabel(ua: string | null): string {
  if (!ua) return "Dispositivo desconocido";
  const isMobile = /Mobile|Android|iPhone|iPad/i.test(ua);
  let browser = "Navegador";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/Chrome\//.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua)) browser = "Safari";
  let os = "";
  if (/Windows/i.test(ua)) os = "Windows";
  else if (/Mac OS X|Macintosh/i.test(ua)) os = "macOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iOS/i.test(ua)) os = "iOS";
  else if (/Linux/i.test(ua)) os = "Linux";
  return `${browser}${os ? " · " + os : ""}${isMobile ? " · móvil" : ""}`;
}
