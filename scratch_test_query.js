import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing DB credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testQuery() {
  console.log("Fetching raw draws...");
  const { data: rawDraws, error } = await supabase
    .from("draws")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    console.error("Error fetching draws:", error);
    return;
  }

  console.log(`Found ${rawDraws.length} draws`);
  
  if (rawDraws.length > 0) {
    console.log("Raw Draw Data:");
    console.dir(rawDraws, { depth: null });
  }
}

testQuery();
