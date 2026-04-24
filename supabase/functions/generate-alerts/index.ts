import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { buildOpportunityRanking } from "../_shared/opportunityEngine.ts";
import { generateAlertsFromRanking, dedupeAlerts, getTodayLocal } from "../_shared/alertsEngine.ts";
import { sendPushToAll, type PushSubscriptionRecord } from "../_shared/webPush.ts";
import type { SorteoExterno, RuleExterno, PatternExterno, AlertRowExterno } from "../_shared/types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function adapterDrawToSorteo(draw: any): SorteoExterno {
  return {
    id: draw.id,
    fecha: draw.fecha,
    hora: draw.lottery_draws?.hora ?? draw.hora ?? "",
    numeros: Array.isArray(draw.numeros) ? draw.numeros : [],
    super_x: draw.super_x,
    altoBajo: draw.alto_bajo,
    parImpar: draw.par_impar,
    subcuadrante: draw.subcuadrante ?? draw.cuadrante,
    loteria: draw.lottery_draws?.lotteries?.nombre ?? draw.loteria ?? "",
    numero: draw.numero || (draw.numeros && draw.numeros.length > 0 ? draw.numeros[0] : 0),
    origen: draw.origen,
    extra: draw.extra || {}
  } as any;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
       throw new Error("Missing SUPABASE env vars");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch draws (limit robust for metrics)
    const { data: rawDraws, error: e1 } = await supabase
      .from("draws")
      .select("*, lottery_draws!inner(hora, loteria_id, lotteries!inner(nombre))")
      .order("created_at", { ascending: false })
      .limit(5000);
      
    if (e1) throw e1;

    // 2. Fetch Rules
    const { data: rawRules, error: e2 } = await supabase
      .from("rules")
      .select("*")
      .eq("activo", true);
      
    if (e2) throw e2;

    // 3. Fetch Patterns
    const { data: rawPatterns, error: e3 } = await supabase
      .from("patterns")
      .select("*")
      .eq("activa", true)
      .eq("estado", "activo");

    if (e3) throw e3;

    const sorteos = (rawDraws || []).map(adapterDrawToSorteo);
    const rules = (rawRules || []) as RuleExterno[];
    const patterns = (rawPatterns || []) as PatternExterno[];

    // 4. Compute Nivel 5 Ranking
    const ranking = buildOpportunityRanking(sorteos, rules, patterns);

    // 5. Generate Alerts
    const newAlerts = generateAlertsFromRanking(ranking);

    if (newAlerts.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No alerts generated.", count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 6. Fetch existing alerts today to test deduplication (usando AST, no UTC)
    const today = getTodayLocal();
    const { data: rawAlerts, error: e4 } = await supabase
      .from("alerts")
      .select("*")
      .gte("fecha", today);

    if (e4) throw e4;
    
    // 7. Deduplicate
    const deduped = dedupeAlerts(newAlerts, rawAlerts as AlertRowExterno[]);

    // 8. Insert new
    if (deduped.length > 0) {
       const { error: insertError } = await supabase
          .from("alerts")
          .insert(deduped);
          
       if (insertError) throw insertError;
       
       console.log(`[generate-alerts] Inserted ${deduped.length} new alerts into DB.`);
    }

    // 9. Send Web Push notifications
    let pushSent = 0;
    if (deduped.length > 0) {
      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("id, endpoint, keys_p256dh, keys_auth")
        .eq("activa", true);

      if (subs && subs.length > 0) {
        // Usar la alerta de mayor score como mensaje principal
        const topAlert = deduped.reduce((a, b) => (a.score > b.score ? a : b));
        const isCritical = topAlert.nivel === "critical";

        const pushResult = await sendPushToAll(
          subs as PushSubscriptionRecord[],
          {
            title: isCritical ? "🚨 Alerta Crítica — Cuadrante" : "🎯 Nueva Alerta — Cuadrante",
            body: `Score ${topAlert.score} a las ${topAlert.hora}. ${topAlert.descripcion?.slice(0, 100)}`,
            tag: `alert-${today}-${topAlert.hora}`,
            data: { url: "/alertas" },
          },
        );

        pushSent = pushResult.sent;
        console.log(`[generate-alerts] Push sent to ${pushResult.sent} devices, ${pushResult.expired.length} expired.`);

        // 10. Cleanup expired subscriptions
        if (pushResult.expired.length > 0) {
          await supabase
            .from("push_subscriptions")
            .update({ activa: false })
            .in("id", pushResult.expired);
          console.log(`[generate-alerts] Cleaned ${pushResult.expired.length} expired push subs.`);
        }
      }
    }

    return new Response(JSON.stringify({ 
       success: true, 
       inserted: deduped.length,
       totalScored: newAlerts.length,
       pushSent,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[generate-alerts] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
