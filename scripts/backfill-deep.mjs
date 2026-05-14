/**
 * 🕵️ Scraper Histórico de Anguila (v2 — Puppeteer)
 *
 * Usa un navegador real para visitar enloteria.com y extraer
 * los números ganadores de TODAS las fechas que muestra cada página.
 *
 * Cada página de fecha muestra ~15 días de historia, así que
 * visitamos una página por cada 15 días por hora.
 *
 * Uso:
 *   node scripts/backfill-deep.mjs 2025-06 2026-03
 */

import puppeteer from "puppeteer";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

// ─── Leer .env ──────────────────────────────────────────────────
const envContent = readFileSync(".env", "utf-8");
const envVars = {};
for (const line of envContent.split("\n")) {
  const match = line.match(/^([A-Z_]+)="?(.+?)"?$/);
  if (match) envVars[match[1]] = match[2];
}

const SUPABASE_URL = envVars.SUPABASE_URL;
const SUPABASE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Config ─────────────────────────────────────────────────────
const SLOTS = [
  { slug: "8am", hora: "08:00" },
  { slug: "9am", hora: "09:00" },
  { slug: "10am", hora: "10:00" },
  { slug: "11am", hora: "11:00" },
  { slug: "12pm", hora: "12:00" },
  { slug: "1pm", hora: "13:00" },
  { slug: "2pm", hora: "14:00" },
  { slug: "3pm", hora: "15:00" },
  { slug: "4pm", hora: "16:00" },
  { slug: "5pm", hora: "17:00" },
  { slug: "6pm", hora: "18:00" },
  { slug: "7pm", hora: "19:00" },
  { slug: "8pm", hora: "20:00" },
  { slug: "9pm", hora: "21:00" },
  { slug: "10pm", hora: "22:00" },
];

const MESES_ES = {
  enero: "01", febrero: "02", marzo: "03", abril: "04",
  mayo: "05", junio: "06", julio: "07", agosto: "08",
  septiembre: "09", octubre: "10", noviembre: "11", diciembre: "12",
};

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

/**
 * Parsea el texto renderizado de la página y extrae los resultados.
 * El formato es:
 *   "Anguilla 8AM\nDomingo 15 de marzo, 2026 8:00AM\n55\n47\n65\n"
 */
function parseRenderedResults(bodyText) {
  const results = [];

  // Buscar bloques: fecha seguida de 3 números
  const lines = bodyText.split("\n").map((l) => l.trim()).filter(Boolean);

  for (let i = 0; i < lines.length - 3; i++) {
    // Buscar línea con fecha: "Domingo 15 de marzo, 2026 8:00AM"
    const dateMatch = lines[i].match(
      /\w+\s+(\d{1,2})\s+de\s+(\w+),?\s+(\d{4})\s+\d{1,2}:\d{2}\s*(AM|PM)/i
    );
    if (!dateMatch) continue;

    const day = parseInt(dateMatch[1], 10);
    const monthName = dateMatch[2].toLowerCase();
    const year = parseInt(dateMatch[3], 10);
    const month = MESES_ES[monthName];
    if (!month) continue;

    // Los 3 números siguen inmediatamente
    const n1 = parseInt(lines[i + 1], 10);
    const n2 = parseInt(lines[i + 2], 10);
    const n3 = parseInt(lines[i + 3], 10);

    if (isNaN(n1) || isNaN(n2) || isNaN(n3)) continue;
    if (n1 < 0 || n1 > 99 || n2 < 0 || n2 > 99 || n3 < 0 || n3 > 99) continue;

    const fecha = `${year}-${month}-${String(day).padStart(2, "0")}`;
    results.push({ fecha, primero: n1, segundo: n2, tercero: n3 });
  }

  return results;
}

// ─── Main ────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log("Uso: node scripts/backfill-deep.mjs YYYY-MM YYYY-MM");
    console.log("Ejemplo: node scripts/backfill-deep.mjs 2025-06 2026-03");
    process.exit(1);
  }

  const [startStr, endStr] = args;
  const [startYear, startMonth] = startStr.split("-").map(Number);
  const [endYear, endMonth] = endStr.split("-").map(Number);

  // Cargar sorteo mappings
  const { data: sorteoData } = await supabase
    .from("lottery_draws")
    .select("id, hora")
    .eq("activa", true);

  const sorteoMap = {};
  for (const row of sorteoData ?? []) {
    sorteoMap[row.hora] = row.id;
  }

  // Cargar draws existentes
  const { data: existingDraws } = await supabase
    .from("draws")
    .select("fecha, sorteo_id");

  const existingKeys = new Set(
    (existingDraws ?? []).map((d) => `${d.fecha}|${d.sorteo_id}`)
  );

  console.log(`📊 ${existingKeys.size} sorteos ya en la BD`);
  console.log(`📅 Rango: ${startStr} → ${endStr}`);

  // Lanzar navegador
  console.log("🌐 Abriendo navegador...\n");
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)");

  let totalInserted = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let pagesVisited = 0;

  // Generar las fechas "ancla" — visitamos 1 página cada 15 días
  // (cada página muestra ~15 días de resultados)
  const anchorDates = [];
  let year = startYear;
  let month = startMonth;

  while (year < endYear || (year === endYear && month <= endMonth)) {
    // Anclar al día 15 y último día de cada mes
    anchorDates.push(`${year}-${String(month).padStart(2, "0")}-15`);
    const lastDay = new Date(year, month, 0).getDate();
    anchorDates.push(`${year}-${String(month).padStart(2, "0")}-${lastDay}`);

    month++;
    if (month > 12) { month = 1; year++; }
  }

  console.log(`📋 ${anchorDates.length} fechas ancla × ${SLOTS.length} horas = ${anchorDates.length * SLOTS.length} páginas a visitar\n`);

  for (const anchorDate of anchorDates) {
    for (const slot of SLOTS) {
      const sorteoId = sorteoMap[slot.hora];
      if (!sorteoId) continue;

      const url = `https://enloteria.com/resultados-anguilla-${slot.slug}-${anchorDate}`;
      pagesVisited++;

      try {
        await page.goto(url, { waitUntil: "networkidle2", timeout: 15000 });
        await sleep(2000);

        // Extraer el texto renderizado
        const bodyText = await page.evaluate(() => document.body.innerText);
        const results = parseRenderedResults(bodyText);

        for (const r of results) {
          const key = `${r.fecha}|${sorteoId}`;
          if (existingKeys.has(key)) {
            totalSkipped++;
            continue;
          }

          const { error: insertErr } = await supabase.from("draws").insert({
            numero: r.primero,
            fecha: r.fecha,
            sorteo_id: sorteoId,
            extra: { segundo: r.segundo, tercero: r.tercero },
          });

          if (!insertErr) {
            totalInserted++;
            existingKeys.add(key);
          } else {
            totalErrors++;
          }
        }

        process.stdout.write(`\r   [${pagesVisited}/${anchorDates.length * SLOTS.length}] ${anchorDate} ${slot.hora} → ${results.length} resultados (✅${totalInserted} ⏭${totalSkipped} ❌${totalErrors})`);

      } catch (e) {
        totalErrors++;
      }

      // Pausa entre requests
      await sleep(300);
    }
  }

  await browser.close();

  console.log("\n\n" + "═".repeat(60));
  console.log(`🏁 BACKFILL COMPLETADO`);
  console.log(`   📄 Páginas visitadas: ${pagesVisited}`);
  console.log(`   ✅ Insertados:  ${totalInserted}`);
  console.log(`   ⏭️  Duplicados:  ${totalSkipped}`);
  console.log(`   ❌ Errores:     ${totalErrors}`);
  console.log("═".repeat(60));
}

main().catch(console.error);
