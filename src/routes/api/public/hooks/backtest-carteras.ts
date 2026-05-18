import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  buildCartera,
  diagnoseWinner,
  type CarteraHistoricalStats,
  type CarteraPattern,
  type CarteraResult,
  type CarteraRule,
} from "@/lib/carteraEngine";
import type { Draw } from "@/hooks/useDraws";

type StrategyKey = "standard_25" | "adaptive_v2" | "adaptive_compensation";

type BacktestEval = {
  fecha: string;
  hora: string;
  numero: number;
  strategy: StrategyKey;
  mode: string;
  selectedSize: number;
  hit: boolean;
  cost: number;
  net: number;
  roi: number;
  internalScore: number;
  rank: number | null;
  missType: string;
};

type RawDrawRow = Draw & {
  lottery_draws: {
    hora: string;
    loteria_id: string;
    nombre: string;
    lotteries: { nombre: string };
  };
};

function buildHistoricalStats(train: Draw[], hora: string, fecha: string): CarteraHistoricalStats {
  const subset = train.filter((d) => d.hora === hora);
  const frecuencias: Record<number, number> = {};
  const lastSeen = new Map<number, string>();

  for (const d of subset) {
    frecuencias[d.numero] = (frecuencias[d.numero] ?? 0) + 1;
    const prev = lastSeen.get(d.numero);
    if (!prev || d.fecha > prev) lastSeen.set(d.numero, d.fecha);
  }

  const current = new Date(`${fecha}T12:00:00Z`).getTime();
  const vencidos: Record<number, number> = {};
  for (let n = 0; n <= 99; n++) {
    const last = lastSeen.get(n);
    if (!last) continue;
    vencidos[n] = Math.max(
      0,
      Math.round((current - new Date(`${last}T12:00:00Z`).getTime()) / 86_400_000),
    );
  }

  return { frecuencias, vencidos, totalSorteos: subset.length };
}

function evaluateStrategy(
  strategy: StrategyKey,
  result: CarteraResult,
  target: Draw,
  payoutPerHit: number,
): BacktestEval {
  const hit = result.numeros.includes(target.numero);
  const cost = result.numeros.length;
  const net = hit ? payoutPerHit - cost : -cost;
  const diagnostic = diagnoseWinner(target.numero, {
    numeros: result.numeros,
    scores: result.scores,
    contexto: result.contexto,
  });

  return {
    fecha: target.fecha,
    hora: target.hora,
    numero: target.numero,
    strategy,
    mode: result.contexto.mode,
    selectedSize: result.contexto.selectedSize,
    hit,
    cost,
    net,
    roi: cost > 0 ? net / cost : 0,
    internalScore: result.contexto.confidence.internalScore,
    rank: diagnostic.rank,
    missType: diagnostic.missType,
  };
}

function summarize(rows: BacktestEval[]) {
  const total = rows.length;
  const hits = rows.filter((r) => r.hit).length;
  const cost = rows.reduce((sum, r) => sum + r.cost, 0);
  const net = rows.reduce((sum, r) => sum + r.net, 0);
  const compact = rows.filter((r) => r.mode === "compact_15").length;
  const nearMiss = rows.filter((r) => r.missType === "near_miss").length;

  return {
    total,
    hits,
    hitRate: total > 0 ? hits / total : 0,
    cost,
    net,
    roi: cost > 0 ? net / cost : 0,
    compact,
    compactRate: total > 0 ? compact / total : 0,
    nearMiss,
  };
}

function summarizeByHour(rows: BacktestEval[]) {
  const byHour = new Map<string, BacktestEval[]>();
  for (const row of rows) {
    const list = byHour.get(row.hora) ?? [];
    list.push(row);
    byHour.set(row.hora, list);
  }
  return Array.from(byHour.entries())
    .map(([hora, list]) => ({ hora, ...summarize(list) }))
    .sort((a, b) => b.roi - a.roi);
}

export const Route = createFileRoute("/api/public/hooks/backtest-carteras")({
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
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const limit = Math.min(1500, Math.max(100, Number(url.searchParams.get("limit") ?? 600)));
        const minTrain = Math.min(
          300,
          Math.max(30, Number(url.searchParams.get("minTrain") ?? 80)),
        );
        const payoutPerHit = Math.max(1, Number(url.searchParams.get("payout") ?? 70));

        const [
          { data: rawDraws, error: e1 },
          { data: rawRules, error: e2 },
          { data: rawPatterns, error: e3 },
        ] = await Promise.all([
          supabaseAdmin
            .from("draws")
            .select(
              "*, lottery_draws!inner(id, hora, nombre, loteria_id, lotteries!inner(id, nombre))",
            )
            .order("fecha", { ascending: false })
            .limit(5000),
          supabaseAdmin
            .from("rules")
            .select("id,nombre,resultado_esperado,efectividad,activo,tipo")
            .eq("activo", true),
          supabaseAdmin
            .from("patterns")
            .select("id,nombre,resultado_esperado,efectividad,hora,activa,estado,tipo")
            .eq("activa", true),
        ]);

        if (e1 || e2 || e3) {
          return Response.json(
            { ok: false, error: e1?.message ?? e2?.message ?? e3?.message },
            { 
              status: 500,
              headers: { "Access-Control-Allow-Origin": "*" }
            },
          );
        }

        const allDraws: Draw[] = ((rawDraws ?? []) as unknown as RawDrawRow[])
          .map((r) => ({
            ...r,
            hora: r.lottery_draws.hora,
            loteria: r.lottery_draws.lotteries.nombre,
            loteria_id: r.lottery_draws.loteria_id,
            sorteo_nombre: r.lottery_draws.nombre,
          }))
          .reverse(); // Revertir para que queden cronológicos (oldest to newest)

        const adaptiveRows: BacktestEval[] = [];
        const compensationRows: BacktestEval[] = [];
        const standardRows: BacktestEval[] = [];

        // Evaluamos solo los últimos `limit` draws, asegurando que tienen al menos `minTrain` de historia
        const targetStartIndex = Math.max(minTrain, allDraws.length - limit);

        for (let i = targetStartIndex; i < allDraws.length; i++) {
          const target = allDraws[i];
          const train = allDraws.slice(0, i);
          const stats = buildHistoricalStats(train, target.hora, target.fecha);
          if (stats.totalSorteos < Math.min(20, minTrain / 2)) continue;

          const adaptive = buildCartera(
            train,
            (rawRules ?? []) as CarteraRule[],
            (rawPatterns ?? []) as CarteraPattern[],
            target.hora,
            stats,
            { allowCompact: true },
          );
          const compensation = buildCartera(
            train,
            (rawRules ?? []) as CarteraRule[],
            (rawPatterns ?? []) as CarteraPattern[],
            target.hora,
            stats,
            { allowCompact: true },
          );
          const standard = buildCartera(
            train,
            (rawRules ?? []) as CarteraRule[],
            (rawPatterns ?? []) as CarteraPattern[],
            target.hora,
            stats,
            { allowCompact: false },
          );

          adaptiveRows.push(evaluateStrategy("adaptive_v2", adaptive, target, payoutPerHit));
          compensationRows.push(evaluateStrategy("adaptive_compensation", compensation, target, payoutPerHit));
          standardRows.push(evaluateStrategy("standard_25", standard, target, payoutPerHit));
        }

        return Response.json({
          ok: true,
          params: { limit, minTrain, payoutPerHit },
          generatedAt: new Date().toISOString(),
          strategies: {
            adaptive_v2: {
              summary: summarize(adaptiveRows),
              byHour: summarizeByHour(adaptiveRows),
              last: adaptiveRows.slice(-20).reverse(),
            },
            adaptive_compensation: {
              summary: summarize(compensationRows),
              byHour: summarizeByHour(compensationRows),
              last: compensationRows.slice(-20).reverse(),
            },
            standard_25: {
              summary: summarize(standardRows),
              byHour: summarizeByHour(standardRows),
              last: standardRows.slice(-20).reverse(),
            },
          },
        }, { headers: { "Access-Control-Allow-Origin": "*" } });
      },
    },
  },
});
