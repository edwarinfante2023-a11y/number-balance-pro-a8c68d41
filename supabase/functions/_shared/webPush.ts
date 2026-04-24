/**
 * webPush.ts — Envío de Web Push desde Deno Edge Functions
 * 
 * Implementación ligera del protocolo Web Push sin dependencias externas pesadas.
 * Usa npm:web-push para la firma VAPID y el cifrado del payload.
 */

import webpush from "npm:web-push@3.6.7";

export interface PushSubscriptionRecord {
  id: string;
  endpoint: string;
  keys_p256dh: string;
  keys_auth: string;
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

/**
 * Configura las claves VAPID desde las variables de entorno.
 * Debe llamarse una vez antes de enviar notificaciones.
 */
function configureVapid(): void {
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@cuadrante.app";

  if (!publicKey || !privateKey) {
    throw new Error("Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY env vars");
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
}

/**
 * Envía una notificación push a una suscripción específica.
 * 
 * @returns true si se envió exitosamente, false si la suscripción expiró (410/404)
 * @throws Error si hay un problema de red o configuración
 */
export async function sendPushNotification(
  subscription: PushSubscriptionRecord,
  payload: PushPayload,
): Promise<{ success: boolean; expired: boolean }> {
  try {
    configureVapid();

    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys_p256dh,
        auth: subscription.keys_auth,
      },
    };

    await webpush.sendNotification(
      pushSubscription,
      JSON.stringify(payload),
      { TTL: 3600 }, // 1 hora de TTL
    );

    return { success: true, expired: false };
  } catch (err: any) {
    // 410 Gone o 404 = suscripción expirada, hay que limpiarla
    if (err.statusCode === 410 || err.statusCode === 404) {
      console.warn(`[webPush] Subscription expired (${err.statusCode}): ${subscription.id}`);
      return { success: false, expired: true };
    }

    console.error(`[webPush] Error sending to ${subscription.id}:`, err.message);
    return { success: false, expired: false };
  }
}

/**
 * Envía notificaciones push a múltiples suscripciones.
 * Retorna las IDs de las suscripciones expiradas para limpiarlas de la BD.
 */
export async function sendPushToAll(
  subscriptions: PushSubscriptionRecord[],
  payload: PushPayload,
): Promise<{ sent: number; expired: string[] }> {
  let sent = 0;
  const expired: string[] = [];

  // Enviar en paralelo con concurrencia controlada (máximo 10 simultáneas)
  const BATCH_SIZE = 10;
  for (let i = 0; i < subscriptions.length; i += BATCH_SIZE) {
    const batch = subscriptions.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((sub) => sendPushNotification(sub, payload)),
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.status === "fulfilled") {
        if (result.value.success) sent++;
        if (result.value.expired) expired.push(batch[j].id);
      }
    }
  }

  return { sent, expired };
}
