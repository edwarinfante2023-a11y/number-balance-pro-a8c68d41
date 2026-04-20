import { supabase } from "./src/integrations/supabase/client";

async function checkLatestDraws() {
  const { data, error } = await supabase
    .from("draws")
    .select(`
      id, fecha, numero, origen, created_at,
      lottery_draws ( hora )
    `)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log("Latest draws in DB:");
  data?.forEach(d => {
    console.log(`[${d.origen}] ${d.fecha} ${d.lottery_draws?.hora} -> Num: ${d.numero}`);
  });
}

checkLatestDraws();
