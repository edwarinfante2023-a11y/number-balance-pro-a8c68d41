import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const env = fs.readFileSync(".env", "utf-8");
let url = "";
let key = "";
env.split("\n").forEach(line => {
  if (line.startsWith("VITE_SUPABASE_URL=")) url = line.split("=")[1].trim().replace(/"/g, '');
  if (line.startsWith("VITE_SUPABASE_PUBLISHABLE_KEY=")) key = line.split("=")[1].trim().replace(/"/g, '');
});

const supabase = createClient(url, key);

async function check() {
  const { data, error } = await supabase
    .from("sync_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);
    
  console.log("Error:", error);
  console.log("Últimos 10 logs de sync:");
  data?.forEach(d => {
    console.log(`\n[${d.created_at}] Nuevas=${d.nuevas} Errores=${d.errores}`);
    console.log(`Detalle:\n${d.detalle?.join("\n")}`);
  });
}

check();
