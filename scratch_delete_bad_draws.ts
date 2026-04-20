import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL!;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
const supabase = createClient(url, key);

async function cleanBadDraws() {
  console.log("Limpiando la data errónea que se jaló de ayer como si fuera hoy...");
  const { data, error } = await supabase
    .from("draws")
    .delete()
    .eq("origen", "scraper")
    .eq("fecha", "2026-04-20");

  if (error) {
    console.error("No se pudieron borrar los datos:", error);
  } else {
    console.log("¡Datos del 2026-04-20 arrastrados por el scraper erróneo han sido eliminados con éxito!");
  }
}

cleanBadDraws();
