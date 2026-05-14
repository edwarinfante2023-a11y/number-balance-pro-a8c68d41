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
    .from("draws")
    .select("*")
    .order("fecha", { ascending: false })
    .limit(10);
    
  console.log("Error:", error);
  console.log("Últimos 10 sorteos en DB:", data?.length);
  data?.forEach(d => {
    console.log(`ID=${d.id} | Fecha=${d.fecha} | Primero=${d.numero} | Extra=${JSON.stringify(d.extra)}`);
  });
}

check();
