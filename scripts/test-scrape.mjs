/**
 * Test rápido: verifica si Puppeteer puede leer los números de enloteria.com
 */
import puppeteer from "puppeteer";

async function test() {
  console.log("🌐 Abriendo navegador...");
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  const url = "https://enloteria.com/resultados-anguilla-8am-2026-03-15";
  console.log(`📄 Navegando a: ${url}`);

  await page.goto(url, { waitUntil: "networkidle2", timeout: 20000 });
  await new Promise((r) => setTimeout(r, 3000));

  // Intentar extraer números
  const result = await page.evaluate(() => {
    const body = document.body.innerText;
    console.log("Body text length:", body.length);

    // Buscar patrón XX-YY-ZZ
    const match = body.match(/(\d{1,2})\s*[-–]\s*(\d{1,2})\s*[-–]\s*(\d{1,2})/);
    if (match) {
      return {
        found: true,
        primero: parseInt(match[1], 10),
        segundo: parseInt(match[2], 10),
        tercero: parseInt(match[3], 10),
        raw: match[0],
      };
    }

    // Si no encontró el patrón, buscar dígitos grandes
    const allNumbers = body.match(/\b\d{1,2}\b/g);
    return {
      found: false,
      bodyPreview: body.substring(0, 2000),
      numbersFound: allNumbers ? allNumbers.slice(0, 20) : [],
    };
  });

  console.log("\n📊 Resultado:");
  console.log(JSON.stringify(result, null, 2));

  await browser.close();
}

test().catch(console.error);
