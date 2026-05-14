/**
 * send-opportunity-push — envía push notifications de oportunidades detectadas.
 * Llamado por el server route /api/public/hooks/scan-opportunities cuando
 * inserta nuevas filas en opportunity_alerts.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  sendPushToAll,
  type PushSubscriptionRecord,
} from "../_shared/webPush.ts";
import { formatDateInTimeZone } from "../_shared/timezone.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OpportunityInput {
  id: string;
  hora: string;
  internal_score: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { alerts } = (await req.json()) as { alerts: OpportunityInput[] };
    if (!Array.isArray(alerts) || alerts.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, keys_p256dh, keys_auth")
      .eq("activa", true);

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: "no subs" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mejor oportunidad como mensaje principal; las otras se mencionan en body.
    const top = alerts.reduce((a, b) => (a.internal_score > b.internal_score ? a : b));
    const extra = alerts.length > 1 ? ` (+${alerts.length - 1} más)` : "";
    const today = formatDateInTimeZone();

    const result = await sendPushToAll(subs as PushSubscriptionRecord[], {
      title: `🔥 Oportunidad ${top.hora}`,
      body: `Score ${top.internal_score}/100 · 25 números listos${extra}`,
      tag: `opp-${today}-${top.hora}`,
      data: { url: `/cartera?hora=${encodeURIComponent(top.hora)}` },
    });

    // Cleanup expired
    if (result.expired.length > 0) {
      await supabase
        .from("push_subscriptions")
        .update({ activa: false })
        .in("id", result.expired);
    }

    // Marcar notified_at
    await supabase
      .from("opportunity_alerts")
      .update({ notified_at: new Date().toISOString() })
      .in("id", alerts.map((a) => a.id));

    return new Response(
      JSON.stringify({ ok: true, sent: result.sent, expired: result.expired.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[send-opportunity-push] Error:", err.message);
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
