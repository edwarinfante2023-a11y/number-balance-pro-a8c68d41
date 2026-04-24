import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

/**
 * Convierte una base64 URL-safe string a Uint8Array para la Push API.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export type PushPermission = "default" | "granted" | "denied" | "unsupported";

export function usePushNotifications() {
  const { session } = useAuth();
  const [permission, setPermission] = useState<PushPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const isSupported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  // Verificar estado actual al montar
  useEffect(() => {
    if (!isSupported) {
      setPermission("unsupported");
      setIsLoading(false);
      return;
    }

    setPermission(Notification.permission as PushPermission);

    // Verificar si ya hay una suscripción activa
    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((sub) => {
        setIsSubscribed(!!sub);
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, [isSupported]);

  /**
   * Solicita permiso, registra el Service Worker, y guarda la suscripción en Supabase.
   */
  const subscribe = useCallback(async () => {
    if (!isSupported || !session?.user?.id) {
      toast.error("Push notifications no soportadas en este navegador");
      return false;
    }

    if (!VAPID_PUBLIC_KEY) {
      console.error("VITE_VAPID_PUBLIC_KEY no configurada");
      toast.error("Error de configuración del servidor");
      return false;
    }

    try {
      setIsLoading(true);

      // 1. Solicitar permiso
      const perm = await Notification.requestPermission();
      setPermission(perm as PushPermission);

      if (perm !== "granted") {
        toast.error("Permiso de notificaciones denegado");
        setIsLoading(false);
        return false;
      }

      // 2. Registrar Service Worker
      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
      });
      await navigator.serviceWorker.ready;

      // 3. Crear suscripción push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });

      const json = subscription.toJSON();

      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("Suscripción push incompleta");
      }

      // 4. Guardar en Supabase (tabla nueva no presente aún en types.ts → cast)
      const { error } = await (supabase as any).from("push_subscriptions").upsert(
        {
          user_id: session.user.id,
          endpoint: json.endpoint,
          keys_p256dh: json.keys.p256dh,
          keys_auth: json.keys.auth,
          activa: true,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "endpoint",
        }
      );

      if (error) throw error;

      setIsSubscribed(true);
      toast.success("🔔 Notificaciones push activadas", {
        description: "Recibirás alertas directamente en tu dispositivo.",
      });

      return true;
    } catch (err) {
      console.error("[Push] Error subscribing:", err);
      toast.error("Error al activar notificaciones", {
        description: err instanceof Error ? err.message : "Intenta de nuevo",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, session?.user?.id]);

  /**
   * Desactiva las notificaciones push y elimina la suscripción.
   */
  const unsubscribe = useCallback(async () => {
    try {
      setIsLoading(true);

      // 1. Cancelar suscripción del navegador
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();

        // 2. Desactivar en Supabase
        await (supabase as any)
          .from("push_subscriptions")
          .update({ activa: false, updated_at: new Date().toISOString() })
          .eq("endpoint", endpoint);
      }

      setIsSubscribed(false);
      toast.success("Notificaciones desactivadas");
      return true;
    } catch (err) {
      console.error("[Push] Error unsubscribing:", err);
      toast.error("Error al desactivar notificaciones");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Envía una notificación de prueba local (sin pasar por el servidor).
   */
  const sendTestNotification = useCallback(async () => {
    if (permission !== "granted") {
      toast.error("Primero activa las notificaciones");
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    registration.showNotification("🎯 Prueba — Cuadrante", {
      body: "Si ves esto, las notificaciones push están funcionando correctamente.",
      icon: "/icon-192.png",
      badge: "/badge-72.png",
      tag: "test-notification",
    });
  }, [permission]);

  return {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
    sendTestNotification,
  };
}
