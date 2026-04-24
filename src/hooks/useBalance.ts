import { useMemo } from "react";
import { useDraws, type Draw } from "@/hooks/useDraws";

export type BalanceWindow = 7 | 30 | 90;

export interface HourPoint {
  hora: string; // "HH:00"
  total: number;
  alto: number;
  bajo: number;
  par: number;
  impar: number;
  altoPct: number; // 0..100
  parPct: number; // 0..100
  abDeviation: number; // |altoPct - 50|
  piDeviation: number; // |parPct - 50|
}

export interface BalanceKPIs {
  totalDraws: number;
  altoPct: number;
  parPct: number;
  abDelta: number; // altoPct - 50
  piDelta: number; // parPct - 50
  worstHour: HourPoint | null; // hora con mayor desviación combinada
  worstHourCategory: "ALTO/BAJO" | "PAR/IMPAR" | null;
  pendingStreakAB: { side: "ALTO" | "BAJO"; length: number } | null;
  pendingStreakPI: { side: "PAR" | "IMPAR"; length: number } | null;
}

function bucketHour(h: string | null | undefined): string {
  if (!h) return "—";
  // "HH:mm" o "HH:mm:ss" → "HH:00"
  const hh = h.split(":")[0]?.padStart(2, "0") ?? "00";
  return `${hh}:00`;
}

function computeStreak<T extends string>(
  values: T[],
): { side: T; length: number } | null {
  if (values.length === 0) return null;
  const last = values[0];
  let n = 0;
  for (const v of values) {
    if (v === last) n++;
    else break;
  }
  if (n < 2) return null;
  return { side: last, length: n };
}

function withinWindow(fecha: string, days: number): boolean {
  const d = new Date(fecha + "T00:00:00");
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 86400000;
  return diff >= 0 && diff <= days;
}

export function useBalance(windowDays: BalanceWindow = 30) {
  const { data: draws = [], isLoading } = useDraws({ limit: 5000 });

  const result = useMemo(() => {
    const filtered: Draw[] = draws.filter((d) => withinWindow(d.fecha, windowDays));

    // ── Series por hora ────────────────────────────────────────────────
    const buckets = new Map<string, HourPoint>();
    for (let i = 0; i < 24; i++) {
      const h = `${String(i).padStart(2, "0")}:00`;
      buckets.set(h, {
        hora: h,
        total: 0,
        alto: 0,
        bajo: 0,
        par: 0,
        impar: 0,
        altoPct: 50,
        parPct: 50,
        abDeviation: 0,
        piDeviation: 0,
      });
    }

    for (const d of filtered) {
      const key = bucketHour(d.hora);
      const b = buckets.get(key);
      if (!b) continue;
      b.total++;
      if (d.alto_bajo === "ALTO") b.alto++;
      else if (d.alto_bajo === "BAJO") b.bajo++;
      if (d.par_impar === "PAR") b.par++;
      else if (d.par_impar === "IMPAR") b.impar++;
    }

    const series: HourPoint[] = [];
    for (let i = 0; i < 24; i++) {
      const h = `${String(i).padStart(2, "0")}:00`;
      const b = buckets.get(h)!;
      const altoPct = b.total > 0 ? (b.alto / b.total) * 100 : 50;
      const parPct = b.total > 0 ? (b.par / b.total) * 100 : 50;
      series.push({
        ...b,
        altoPct,
        parPct,
        abDeviation: Math.abs(altoPct - 50),
        piDeviation: Math.abs(parPct - 50),
      });
    }

    // ── KPIs globales ─────────────────────────────────────────────────
    const totalDraws = filtered.length;
    const altoTotal = filtered.filter((d) => d.alto_bajo === "ALTO").length;
    const parTotal = filtered.filter((d) => d.par_impar === "PAR").length;
    const altoPct = totalDraws > 0 ? (altoTotal / totalDraws) * 100 : 50;
    const parPct = totalDraws > 0 ? (parTotal / totalDraws) * 100 : 50;

    // Hora más desbalanceada (ignora horas sin datos)
    const populated = series.filter((s) => s.total >= 3);
    let worstHour: HourPoint | null = null;
    let worstHourCategory: "ALTO/BAJO" | "PAR/IMPAR" | null = null;
    for (const s of populated) {
      const maxDev = Math.max(s.abDeviation, s.piDeviation);
      const currentMax = worstHour ? Math.max(worstHour.abDeviation, worstHour.piDeviation) : -1;
      if (maxDev > currentMax) {
        worstHour = s;
        worstHourCategory = s.abDeviation >= s.piDeviation ? "ALTO/BAJO" : "PAR/IMPAR";
      }
    }

    // Racha pendiente: orden cronológico DESC del hook
    const sortedDesc = [...filtered].sort((a, b) => {
      const fa = a.fecha + (a.hora ?? "");
      const fb = b.fecha + (b.hora ?? "");
      return fb.localeCompare(fa);
    });
    const abSeq = sortedDesc.map((d) => d.alto_bajo as "ALTO" | "BAJO");
    const piSeq = sortedDesc.map((d) => d.par_impar as "PAR" | "IMPAR");
    const pendingStreakAB = computeStreak(abSeq);
    const pendingStreakPI = computeStreak(piSeq);

    const kpis: BalanceKPIs = {
      totalDraws,
      altoPct,
      parPct,
      abDelta: altoPct - 50,
      piDelta: parPct - 50,
      worstHour,
      worstHourCategory,
      pendingStreakAB,
      pendingStreakPI,
    };

    return { series, kpis };
  }, [draws, windowDays]);

  return { ...result, isLoading };
}