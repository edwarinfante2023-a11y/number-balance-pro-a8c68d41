import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing DB credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedData() {
  console.log("Fetching lottery_draws...");
  const { data: sorteos, error: errSorteos } = await supabase
    .from("lottery_draws")
    .select("id, hora, loteria_id");

  if (errSorteos) {
    console.error("Error fetching lottery_draws:", errSorteos);
    return;
  }

  if (!sorteos || sorteos.length === 0) {
    console.error("No lottery_draws found! Can't seed.");
    return;
  }

  console.log(`Found ${sorteos.length} active sorteos.`);

  // Generate draws for the last 5 days
  const now = new Date();
  const drawsToInsert = [];

  for (let i = 4; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const fecha = date.toISOString().split("T")[0];

    for (const sorteo of sorteos) {
      // Simulate random number 0-99
      const numero = Math.floor(Math.random() * 100);
      
      // Classify
      const altoBajo = numero >= 50 ? "ALTO" : "BAJO";
      const parImpar = numero % 2 === 0 ? "PAR" : "IMPAR";
      const cuadrante = `${altoBajo}_${parImpar}`;

      drawsToInsert.push({
        sorteo_id: sorteo.id,
        fecha: fecha,
        numero: numero,
        alto_bajo: altoBajo,
        par_impar: parImpar,
        cuadrante: cuadrante,
        subcuadrante: cuadrante,
        origen: "scraper",
      });
    }
  }

  console.log(`Inserting ${drawsToInsert.length} draws...`);
  
  // Insert in batches of 50
  let inserted = 0;
  for (let i = 0; i < drawsToInsert.length; i += 50) {
    const batch = drawsToInsert.slice(i, i + 50);
    const { error: insertErr } = await supabase.from("draws").insert(batch);
    if (insertErr) {
       console.error("Error inserting batch:", insertErr);
    } else {
       inserted += batch.length;
    }
  }

  console.log(`Successfully inserted ${inserted} draws!`);
}

seedData();
