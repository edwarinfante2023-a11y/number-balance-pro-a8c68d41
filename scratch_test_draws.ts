import { supabase } from "./src/integrations/supabase/client";

async function checkSorteos() {
  const { data, error } = await supabase
    .from("lottery_draws")
    .select("id, hora, nombre")
    .eq("activa", true);
  
  if (error) {
    console.error("Error:", error);
    return;
  }
  
  console.log("Lottery draws in DB:");
  data?.forEach(d => console.log(`${d.hora} -> ${d.nombre}`));
}

checkSorteos();
