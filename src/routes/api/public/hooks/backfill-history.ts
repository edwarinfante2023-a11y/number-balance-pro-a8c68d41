import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Backfill History — Llena el historial usando los RSS feeds de enloteria.com.
 *
 * Cada RSS tiene ~8 días de historia con los 3 números ganadores.
 * Al recorrer los 15 slots (8AM-10PM), obtiene ~120 sorteos de un golpe.
 *
 * Uso: POST /api/public/hooks/backfill-history
 * Idempotente: si el sorteo ya existe, lo ignora.
 */

interface SlotConfig {
  slug: string;
  hora: string;
}

const SLOTS: SlotConfig[] = [
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

// ─── Helpers ─────────────────────────────────────────────────────
function parseRSSItems(xml: string): Array<{ title: string; pubDate: string }> {
  const items: Array<{ title: string; pubDate: string }> = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let itemMatch;
  while ((itemMatch = itemRegex.exec(xml)) !== null) {
    const itemXml = itemMatch[1];
    const titleMatch = itemXml.match(/<title>([\s\S]*?)<\/title>/);
    const pubDateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
    if (titleMatch && pubDateMatch) {
      items.push({
        title: titleMatch[1].trim(),
        pubDate: pubDateMatch[1].trim(),
      });
    }
  }
  return items;
}

function extractAllPrizes(title: string): { primero: number | null; segundo: number | null; tercero: number | null } {
  const match = title.match(/:\s*(\d{1,2})-(\d{1,2})-(\d{1,2})/);
  if (!match) return { primero: null, segundo: null, tercero: null };
  return {
    primero: parseInt(match[1], 10),
    segundo: parseInt(match[2], 10),
    tercero: parseInt(match[3], 10),
  };
}

function pubDateToISO(pubDate: string): string {
  // "Thu, 14 May 2026 08:05:40 -0400" → "2026-05-14"
  const d = new Date(pubDate);
  return d.toISOString().slice(0, 10);
}

// ─── Endpoint ────────────────────────────────────────────────────
export const Route = createFileRoute("/api/public/hooks/backfill-history")({
  server: {
    handlers: {
      OPTIONS: async () => {
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        });
      },
      POST: async () => {
        const startTime = Date.now();

        // 1. Cargar mappings de BD (hora → sorteo_id)
        const { data: sorteoData, error: sorteoErr } = await supabaseAdmin
          .from("lottery_draws")
          .select("id, hora")
          .eq("activa", true);

        if (sorteoErr) {
          return Response.json({ ok: false, error: sorteoErr.message }, { status: 500 });
        }

        const sorteoMap: Record<string, string> = {};
        for (const row of sorteoData ?? []) {
          sorteoMap[row.hora] = row.id;
        }

        // 2. Precargar todas las draws existentes para deduplicación
        const { data: existingDraws } = await supabaseAdmin
          .from("draws")
          .select("fecha, sorteo_id");

        const existingKeys = new Set(
          (existingDraws ?? []).map((d: any) => `${d.fecha}|${d.sorteo_id}`),
        );

        // 3. Recorrer todos los RSS feeds
        let totalFetched = 0;
        let totalInserted = 0;
        let totalDuplicated = 0;
        let totalErrors = 0;
        const details: string[] = [];

        for (const slot of SLOTS) {
          try {
            const url = `https://enloteria.com/rss/anguilla-${slot.slug}`;
            const response = await fetch(url);
            if (!response.ok) {
              totalErrors++;
              details.push(`⚠ HTTP ${response.status} en ${slot.slug}`);
              continue;
            }

            const xml = await response.text();
            const items = parseRSSItems(xml);

            for (const item of items) {
              // Ignorar pendientes
              if (item.title.toLowerCase().includes("pendiente")) continue;

              const prizes = extractAllPrizes(item.title);
              if (prizes.primero === null) continue;

              const fecha = pubDateToISO(item.pubDate);
              const sorteoId = sorteoMap[slot.hora];
              if (!sorteoId) continue;

              totalFetched++;
              const key = `${fecha}|${sorteoId}`;

              if (existingKeys.has(key)) {
                totalDuplicated++;
                continue;
              }

              // Insertar nuevo draw
              const { error: insertErr } = await supabaseAdmin.from("draws").insert({
                numero: prizes.primero,
                fecha,
                sorteo_id: sorteoId,
                loteria: "anguilla",
                source: "rss_backfill",
                extra: {
                  segundo: prizes.segundo,
                  tercero: prizes.tercero,
                },
              } as any);

              if (!insertErr) {
                totalInserted++;
                existingKeys.add(key); // Evitar doble inserción en este run
                details.push(`✅ ${fecha} ${slot.hora}: ${prizes.primero}-${prizes.segundo}-${prizes.tercero}`);
              } else {
                totalErrors++;
                details.push(`❌ ${fecha} ${slot.hora}: ${insertErr.message}`);
              }
            }
          } catch (e: any) {
            totalErrors++;
            details.push(`💥 ${slot.slug}: ${e.message}`);
          }
        }

        const elapsedMs = Date.now() - startTime;

        // 4. Guardar log
        await supabaseAdmin.from("settings").upsert(
          [
            {
              clave: "backfill_last_run",
              valor: {
                ranAt: new Date().toISOString(),
                totalFetched,
                totalInserted,
                totalDuplicated,
                totalErrors,
                elapsedMs,
                details: details.slice(0, 30),
              } as any,
            },
          ],
          { onConflict: "clave" },
        );

        return Response.json(
          {
            ok: true,
            totalFetched,
            totalInserted,
            totalDuplicated,
            totalErrors,
            elapsedMs,
            details: details.slice(0, 50),
          },
          {
            headers: { "Access-Control-Allow-Origin": "*" },
          },
        );
      },
    },
  },
});
