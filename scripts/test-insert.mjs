import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envContent = readFileSync(".env", "utf-8");
const envVars = {};
for (const line of envContent.split("\n")) {
  const match = line.match(/^([A-Z_]+)="?(.+?)"?$/);
  if (match) envVars[match[1]] = match[2];
}

const SUPABASE_URL = envVars.SUPABASE_URL;
const SUPABASE_KEY = envVars.SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function test() {
  const { data, error } = await supabase.from("draws").insert({
    numero: 0,
    fecha: "2099-01-01",
    sorteo_id: "00000000-0000-0000-0000-000000000000", // invalid ID, but let's see what error we get
    loteria: "test",
  });
  console.log("Result:", error ? error.message : "Success");
}

test().catch(console.error);
