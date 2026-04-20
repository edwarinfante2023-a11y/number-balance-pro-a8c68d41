import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { buildOpportunityRanking } from "../_shared/opportunityEngine.ts";
import { generateAlertsFromRanking, dedupeAlerts } from "../_shared/alertsEngine.ts";
import type { SorteoExterno, RuleExterno, PatternExterno, AlertRowExterno } from "../_shared/types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function adapterDrawToSorteo(draw: any): SorteoExterno {
  return {
    id: draw.id,
    fecha: draw.fecha,
    hora: draw.hora,
    numeros: Array.isArray(draw.numeros) ? draw.numeros : [],
    super_x: draw.super_x,
    altoBajo: draw.alto_bajo,
    parImpar: draw.par_impar,
    subcuadrante: draw.subcuadrante,
    loteria: draw.loteria,
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
      .select("*")
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

    // 6. Fetch existing alerts today to test deduplication
    const today = new Date().toISOString().split('T')[0]; // "yyyy-MM-dd"
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

    return new Response(JSON.stringify({ 
       success: true, 
       inserted: deduped.length,
       totalScored: newAlerts.length 
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
