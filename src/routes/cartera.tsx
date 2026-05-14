import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Briefcase, Sparkles, Target, TrendingUp, Loader2, CheckCircle2, XCircle, MinusCircle, Flame, Gauge, RefreshCw, Copy } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useGenerateCartera, useCarteraDelDia, useCarteraStats, useCarterasDelDia } from "@/hooks/useCartera";
import { useLotteryDraws } from "@/hooks/useLotteries";
import { toast } from "sonner";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  AreaChart,
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import { AttributionSection } from "@/components/AttributionSection";
import { BankrollSimSection } from "@/components/BankrollSimSection";
import { APP_TIME_ZONE, appDateTimeToInstant, dateOnlyToNoonUtc, formatDateInTimeZone } from "@/lib/timezone";

export const Route = createFileRoute("/cartera")({
  validateSearch: (search: Record<string, unknown>) => ({
    hora: typeof search.hora === "string" ? search.hora : undefined,
  }),
  component: CarteraPage,
});

function CarteraPage() {
  const { hora: horaSearch } = Route.useSearch();
  const { data: lotteryDraws } = useLotteryDraws();
  const horasDisponibles = useMemo(() => {
    const set = new Set<string>();
    (lotteryDraws ?? []).forEach((d: any) => set.add(d.hora));
    return Array.from(set).sort();
  }, [lotteryDraws]);

  const [hora, setHora] = useState<string | null>(null);

  // Auto-cargar hora del search param (deep-link desde push/banner)
  useEffect(() => {
    if (horaSearch && horaSearch !== hora) setHora(horaSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [horaSearch]);

  const [windowDays, setWindowDays] = useState<30 | 60 | 90>(30);

  // Fecha para tabla de carteras (winners). Por defecto: hoy.
  const todayStr = formatDateInTimeZone();
  const [fechaTabla, setFechaTabla] = useState<string>(todayStr);

  const generate = useGenerateCartera();
  const cartera = useCarteraDelDia(hora, fechaTabla);
  const stats = useCarteraStats(windowDays);
  const carterasHoy = useCarterasDelDia(fechaTabla);

  const [reevalLoading, setReevalLoading] = useState(false);
  const [reevalStep, setReevalStep] = useState(0);
  const [reevalElapsed, setReevalElapsed] = useState(0);
  const reevalSteps = ["Iniciando", "Evaluando carteras vs sorteos", "Recalculando 2do/3ro", "Refrescando tabla"];

  useEffect(() => {
    if (!reevalLoading) return;
    const start = Date.now();
    const t = setInterval(() => setReevalElapsed(Math.floor((Date.now() - start) / 1000)), 200);
    return () => clearInterval(t);
  }, [reevalLoading]);

  const onReevaluate = async () => {
    setReevalLoading(true);
    setReevalStep(0);
    setReevalElapsed(0);
    const stepTimer = setTimeout(() => setReevalStep(1), 200);
    const stepTimer2 = setTimeout(() => setReevalStep(2), 1500);
    try {
      const res = await fetch("/api/public/hooks/evaluate-results", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
      const evaluadas = json?.evaluadas ?? json?.updated ?? 0;
      setReevalStep(3);
      await Promise.all([cartera.refetch?.(), stats.refetch?.(), carterasHoy.refetch?.()]);
      toast.success(`Evaluación re-ejecutada · ${evaluadas} carteras actualizadas`);
    } catch (e: any) {
      toast.error(e?.message ?? "Error re-evaluando");
    } finally {
      clearTimeout(stepTimer);
      clearTimeout(stepTimer2);
      setReevalLoading(false);
    }
  };

  const onGenerate = async () => {
    if (!hora) {
      toast.error("Elegí una hora primero");
      return;
    }
    try {
      const r = await generate.mutateAsync({ hora });
      toast.success(`Cartera generada · score top ${Math.max(...Object.values(r.result.scores))}`);
    } catch (e: any) {
      toast.error(e.message ?? "Error generando cartera");
    }
  };

  const ctx = (cartera.data?.contexto ?? {}) as any;
  const scoresMap = (cartera.data?.scores ?? {}) as Record<string, number>;
  const reasonsMap = (ctx.reasons ?? {}) as Record<string, string[]>;
  const numeros: number[] = (cartera.data?.numeros ?? []) as number[];

  return (
    <div className="space-y-6 pt-6">
      <PageHeader
        title="Cartera de 25 — MVP"
        description="Generador de cartera por hora con señal compuesta + dashboard de validación rolling. Baseline aleatorio: 25%."
      />

      {/* ─── Generador ─────────────────────────────── */}
      <section className="surface-raised rounded-[24px] p-6 bg-white/95 backdrop-blur-md shadow-sm border border-black/[0.04]">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Hora objetivo
            </label>
            <select
              className="h-11 rounded-xl border border-border bg-white px-4 text-[14px] font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary/30 min-w-[140px]"
              value={hora ?? ""}
              onChange={(e) => setHora(e.target.value || null)}
            >
              <option value="">— elegir —</option>
              {horasDisponibles.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>
          <button
            onClick={onGenerate}
            disabled={!hora || generate.isPending}
            className="h-11 px-6 rounded-xl bg-primary text-primary-foreground text-[13px] font-bold inline-flex items-center gap-2 hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generate.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Generar cartera
          </button>
          <button
            onClick={onReevaluate}
            disabled={reevalLoading}
            title="Re-evaluar todas las carteras contra los sorteos publicados (1ro, 2do, 3ro)"
            className="h-11 px-5 rounded-xl bg-secondary text-secondary-foreground text-[13px] font-bold inline-flex items-center gap-2 hover:bg-secondary/80 transition disabled:opacity-50 disabled:cursor-not-allowed border border-border"
          >
            {reevalLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Re-evaluar P&L
          </button>
          {cartera.data && (
            <div className="text-[12px] text-muted-foreground ml-auto">
              <span className="font-semibold text-foreground">{ctx.totalDrawsHora ?? 0}</span> sorteos en esta hora ·
              ALTO {ctx.pctAltos}% / BAJO {ctx.pctBajos}% · PAR {ctx.pctPares}% / IMPAR {ctx.pctImpares}% ·
              {" "}{ctx.reglasActivas} reglas · {ctx.patronesHora} patrones
              {ctx.compactDecision ? ` · gap15 ${ctx.compactDecision.gap15}` : ""}
            </div>
          )}
        </div>

        {reevalLoading && (
          <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-3">
            <div className="flex items-center justify-between text-[12px] font-bold mb-2">
              <span className="inline-flex items-center gap-2 text-primary">
                <Loader2 className="size-3.5 animate-spin" />
                Paso {Math.min(reevalStep + 1, reevalSteps.length)}/{reevalSteps.length} · {reevalSteps[Math.min(reevalStep, reevalSteps.length - 1)]}
              </span>
              <span className="text-muted-foreground tabular-nums">{reevalElapsed}s</span>
            </div>
            <div className="h-1.5 rounded-full bg-primary/10 overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500 ease-out"
                style={{ width: `${Math.round(((reevalStep + 1) / reevalSteps.length) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Metadata de generación */}
        {cartera.data && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-primary/10 text-primary font-bold">
              <Sparkles className="size-3" />
              Generada {new Date((cartera.data as any).created_at).toLocaleString("es-DO", {
                timeZone: APP_TIME_ZONE, day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false,
              })}
            </span>
            <span className="inline-flex items-center h-7 px-2.5 rounded-full bg-muted text-muted-foreground font-bold">
              Sorteo {(cartera.data as any).hora} · {dateOnlyToNoonUtc((cartera.data as any).fecha).toLocaleDateString("es-DO", { timeZone: APP_TIME_ZONE, day: "2-digit", month: "short", year: "numeric" })}
            </span>
            <span className="inline-flex items-center h-7 px-2.5 rounded-full bg-emerald-50 text-emerald-700 font-bold">
              {(cartera.data as any).contexto?.selectedSize ?? numeros.length} números · {(cartera.data as any).contexto?.mode === "compact_15" ? "alta confianza" : "estándar"}
            </span>
            {(() => {
              const created = new Date((cartera.data as any).created_at);
              const draw = appDateTimeToInstant((cartera.data as any).fecha, (cartera.data as any).hora);
              const diffMin = Math.round((draw.getTime() - created.getTime()) / 60000);
              if (diffMin >= 0) {
                return (
                  <span className="inline-flex items-center h-7 px-2.5 rounded-full bg-emerald-50 text-emerald-700 font-bold">
                    {diffMin} min antes del sorteo
                  </span>
                );
              }
              return (
                <span className="inline-flex items-center h-7 px-2.5 rounded-full bg-amber-50 text-amber-700 font-bold">
                  {Math.abs(diffMin)} min después del sorteo
                </span>
              );
            })()}
          </div>
        )}

        {/* Grid de números */}
        {cartera.data ? (
          <div className="mt-6">
            <div className="flex justify-end gap-2 mb-3">
              <button
                type="button"
                onClick={() => {
                  const pad = (n: number) => String(n).padStart(2, "0");
                  const sorted = [...numeros].sort((a, b) => a - b);
                  const altos = sorted.filter((n) => (scoresMap[String(n)] ?? 0) >= 80).map(pad);
                  const fecha = dateOnlyToNoonUtc((cartera.data as any).fecha)
                    .toLocaleDateString("es-DO", { timeZone: APP_TIME_ZONE, day: "2-digit", month: "short" });
                  const filas: string[] = [];
                  for (let i = 0; i < sorted.length; i += 10) {
                    filas.push(sorted.slice(i, i + 10).map(pad).join(" - "));
                  }
                  const msg =
                    `🎯 Cartera ${(cartera.data as any).hora} · ${fecha}\n\n` +
                    filas.join("\n") +
                    (altos.length ? `\n\n⭐ Alta convicción: ${altos.join(", ")}` : "");
                  navigator.clipboard.writeText(msg).then(
                    () => toast.success("Mensaje listo para WhatsApp"),
                    () => toast.error("No se pudo copiar"),
                  );
                }}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground text-[12px] font-bold transition"
              >
                <Copy className="size-3.5" />
                Copiar para cliente
              </button>
              <button
                type="button"
                onClick={() => {
                  const txt = numeros.map((n) => String(n).padStart(2, "0")).join(", ");
                  navigator.clipboard.writeText(txt).then(
                    () => toast.success(`${numeros.length} números copiados`),
                    () => toast.error("No se pudo copiar"),
                  );
                }}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-muted hover:bg-muted/70 text-foreground text-[12px] font-bold transition"
              >
                <Copy className="size-3.5" />
                Copiar números
              </button>
            </div>
            <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-9 lg:grid-cols-[repeat(13,minmax(0,1fr))] gap-2">
              {numeros.map((n) => {
                const s = scoresMap[String(n)] ?? 0;
                const reasons = reasonsMap[String(n)] ?? [];
                return (
                  <div
                    key={n}
                    title={reasons.join(" · ")}
                    className={cn(
                      "relative rounded-xl p-2 text-center cursor-help transition-all hover:-translate-y-0.5",
                      s >= 80 ? "bg-primary text-primary-foreground shadow-md" :
                      s >= 60 ? "bg-primary/15 text-primary" :
                                "bg-muted text-foreground",
                    )}
                  >
                    <div className="text-[18px] font-black tabular-nums leading-tight">
                      {String(n).padStart(2, "0")}
                    </div>
                    <div className="text-[10px] font-bold opacity-80 mt-0.5">{s}</div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-3 mt-4 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded bg-primary" /> ≥80 alta convicción</span>
              <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded bg-primary/15" /> 60–79 moderada</span>
              <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded bg-muted" /> resto</span>
            </div>
          </div>
        ) : hora ? (
          <div className="mt-6 text-[13px] text-muted-foreground">
            No hay cartera generada para esta hora hoy. Pulsá <b>Generar</b>.
          </div>
        ) : null}
      </section>

      {/* ─── Dashboard rolling ─────────────────────── */}
      {/* ─── Confianza por hora (hoy) ──────────────── */}
      <section className="surface-raised rounded-[24px] p-6 bg-white/95 backdrop-blur-md shadow-sm border border-black/[0.04]">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-[18px] font-black tracking-tight text-foreground inline-flex items-center gap-2">
              <Gauge className="size-5 text-primary" />
              Confianza por hora {fechaTabla === todayStr ? "— hoy" : `— ${fechaTabla}`}
            </h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              Score interno (0–100) de cada cartera del día seleccionado. Las marcadas <b>alta</b> son candidatas a oportunidad.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={fechaTabla}
              max={todayStr}
              onChange={(e) => setFechaTabla(e.target.value || todayStr)}
              className="h-9 px-3 rounded-xl border border-border bg-white text-[12px] font-mono font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {fechaTabla !== todayStr && (
              <button
                onClick={() => setFechaTabla(todayStr)}
                className="h-9 px-3 rounded-xl bg-muted hover:bg-muted/70 text-[11px] font-bold uppercase tracking-wider transition"
              >
                Hoy
              </button>
            )}
          </div>
        </div>

        {carterasHoy.isLoading ? (
          <div className="grid place-items-center h-24 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : !carterasHoy.data || carterasHoy.data.length === 0 ? (
          <div className="rounded-xl bg-muted/40 p-5 text-center text-[13px] text-muted-foreground">
            No hay carteras para <b>{fechaTabla}</b>. {fechaTabla === todayStr ? <>El cron horario las arma a los <b>:02</b> de cada hora.</> : "Probá otra fecha."}
          </div>
        ) : (
          <>
          {(() => {
            // Resumen demo del día: apuesta = $1 por número (25 por cartera), payout = 70x
            const APUESTA = 1;
            const PAYOUT = 70;
            const evaluadas = (carterasHoy.data as any[]).filter((c) => {
              const r = Array.isArray(c.cartera_resultados) ? c.cartera_resultados[0] : c.cartera_resultados;
              return r?.acierto !== undefined && r?.acierto !== null;
            });
            const aciertos = evaluadas.filter((c) => {
              const r = Array.isArray(c.cartera_resultados) ? c.cartera_resultados[0] : c.cartera_resultados;
              return r.acierto === true;
            }).length;
            const apostado = evaluadas.length * 25 * APUESTA;
            const cobrado = aciertos * PAYOUT * APUESTA;
            const pnl = cobrado - apostado;
            const roi = apostado > 0 ? (pnl / apostado) * 100 : 0;
            return (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                <div className="rounded-xl border border-black/[0.04] bg-white p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Carteras hoy</div>
                  <div className="mt-1 text-[20px] font-black tabular-nums">{(carterasHoy.data as any[]).length}</div>
                  <div className="text-[11px] text-muted-foreground">{evaluadas.length} evaluadas · {aciertos} aciertos</div>
                </div>
                <div className="rounded-xl border border-black/[0.04] bg-white p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Hit-rate hoy</div>
                  <div className="mt-1 text-[20px] font-black tabular-nums">
                    {evaluadas.length > 0 ? `${((aciertos / evaluadas.length) * 100).toFixed(0)}%` : "—"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">baseline 25%</div>
                </div>
                <div className="rounded-xl border border-black/[0.04] bg-white p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Apostado / Cobrado</div>
                  <div className="mt-1 text-[20px] font-black tabular-nums">${apostado} / ${cobrado}</div>
                  <div className="text-[11px] text-muted-foreground">$1 por número · pago 70×</div>
                </div>
                <div className={cn(
                  "rounded-xl border p-3",
                  pnl > 0 ? "bg-emerald-50 border-emerald-200" :
                  pnl < 0 ? "bg-rose-50 border-rose-200" :
                  "bg-white border-black/[0.04]",
                )}>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">P&amp;L demo</div>
                  <div className={cn(
                    "mt-1 text-[20px] font-black tabular-nums",
                    pnl > 0 ? "text-emerald-700" : pnl < 0 ? "text-rose-700" : "text-foreground",
                  )}>
                    {pnl >= 0 ? "+" : ""}${pnl}
                  </div>
                  <div className={cn(
                    "text-[11px] font-bold",
                    pnl > 0 ? "text-emerald-700" : pnl < 0 ? "text-rose-700" : "text-muted-foreground",
                  )}>
                    ROI {roi >= 0 ? "+" : ""}{roi.toFixed(0)}%
                  </div>
                </div>
              </div>
            );
          })()}
          <div className="mb-5">
            <AttributionSection />
          </div>
          <BankrollSimSection />
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2">Hora</th>
                  <th className="px-3 py-2">Confianza</th>
                  <th className="px-3 py-2">Internal</th>
                  <th className="px-3 py-2">Top μ</th>
                  <th className="px-3 py-2">Gap</th>
                  <th className="px-3 py-2">Sorteos hora</th>
                  <th className="px-3 py-2">Generada</th>
                  <th className="px-3 py-2">Resultado</th>
                  <th className="px-3 py-2">Ganador</th>
                  <th className="px-3 py-2 text-center">2do</th>
                  <th className="px-3 py-2 text-center">3ro</th>
                  <th className="px-3 py-2 text-right">P&amp;L</th>
                  <th className="px-3 py-2">Acción</th>
                </tr>
              </thead>
              <tbody>
                {carterasHoy.data
                  .map((c: any) => {
                    const conf = (c.contexto?.confidence ?? {}) as {
                      internalScore?: number; topMean?: number; gap?: number;
                    };
                    const score = conf.internalScore ?? 0;
                    return { c, conf, score };
                  })
                  .sort((a, b) => b.score - a.score)
                  .map(({ c, conf, score }) => {
                    const tier = score >= 70 ? "alta" : score >= 50 ? "media" : "baja";
                    const res = Array.isArray(c.cartera_resultados) ? c.cartera_resultados[0] : c.cartera_resultados;
                    const acierto: boolean | null = res?.acierto ?? null;
                    const ganador: number | null = res?.numero_ganador ?? null;
                    const ganador2: number | null = res?.numero_segundo ?? null;
                    const ganador3: number | null = res?.numero_tercero ?? null;
                    const acierto2: boolean | null = res?.acierto_segundo ?? null;
                    const acierto3: boolean | null = res?.acierto_tercero ?? null;
                    // Posición del ganador rankeada por score
                    let posScore: number | null = null;
                    if (acierto === true && ganador !== null && c.scores) {
                      const ranked = Object.entries(c.scores as Record<string, number>)
                        .map(([n, s]) => ({ n: Number(n), s: Number(s) }))
                        .sort((a, b) => b.s - a.s || a.n - b.n);
                      const idx = ranked.findIndex((x) => x.n === ganador);
                      if (idx >= 0) posScore = idx + 1;
                    }
                    // P&L demo: $1 por número (25), payout 70x si pega
                    const pnlRow = acierto === true ? 70 - 25 : acierto === false ? -25 : null;
                    return (
                      <tr
                        key={c.id}
                        className={cn(
                          "border-t border-border/60 transition",
                          tier === "alta" && "bg-primary/5",
                        )}
                      >
                        <td className="px-3 py-2.5 font-bold tabular-nums">{c.hora}</td>
                        <td className="px-3 py-2.5">
                          <ConfidencePill tier={tier} />
                        </td>
                        <td className="px-3 py-2.5 font-black tabular-nums">{score}</td>
                        <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                          {conf.topMean?.toFixed?.(1) ?? "—"}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                          {conf.gap !== undefined ? (conf.gap >= 0 ? "+" : "") + conf.gap.toFixed(1) : "—"}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                          {c.contexto?.totalDrawsHora ?? 0}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-muted-foreground text-[11px]">
                          {c.created_at
                            ? new Date(c.created_at).toLocaleString("es-DO", {
                                timeZone: APP_TIME_ZONE, day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false,
                              })
                            : "—"}
                        </td>
                        <td className="px-3 py-2.5">
                          {acierto === true ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                              <CheckCircle2 className="size-3.5" />
                              Acierto{acierto2 ? " + 2da" : ""}{acierto3 ? " + 3ra" : ""}
                            </span>
                          ) : acierto === false && acierto2 ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600">
                              <CheckCircle2 className="size-3.5" /> Acierto 2da
                            </span>
                          ) : acierto === false && acierto3 ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600">
                              <CheckCircle2 className="size-3.5" /> Acierto 3ra
                            </span>
                          ) : acierto === false ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600">
                              <XCircle className="size-3.5" /> Falló
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground/70">
                              <MinusCircle className="size-3.5" /> Pendiente
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {ganador !== null ? (
                            <div className="flex items-center gap-1.5">
                              <span className={cn(
                                "tabular-nums font-black",
                                acierto === true ? "text-emerald-700" : "text-foreground",
                              )}>
                                {String(ganador).padStart(2, "0")}
                              </span>
                              {posScore !== null && (
                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                                  #{posScore}/25
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {ganador2 !== null ? (
                            <span className={cn(
                              "inline-flex items-center gap-1 text-[11px] font-bold tabular-nums",
                              acierto2 ? "text-emerald-700" : "text-muted-foreground",
                            )}>
                              {acierto2 ? "✓" : "·"} {String(ganador2).padStart(2, "0")}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {ganador3 !== null ? (
                            <span className={cn(
                              "inline-flex items-center gap-1 text-[11px] font-bold tabular-nums",
                              acierto3 ? "text-emerald-700" : "text-muted-foreground",
                            )}>
                              {acierto3 ? "✓" : "·"} {String(ganador3).padStart(2, "0")}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </td>
                        <td className={cn(
                          "px-3 py-2.5 text-right tabular-nums font-black",
                          pnlRow === null ? "text-muted-foreground/50" :
                          pnlRow > 0 ? "text-emerald-700" : "text-rose-600",
                        )}>
                          {pnlRow === null ? "—" : `${pnlRow > 0 ? "+" : ""}$${pnlRow}`}
                        </td>
                        <td className="px-3 py-2.5">
                          <button
                            onClick={() => {
                              setHora(c.hora);
                              if (typeof window !== "undefined") {
                                requestAnimationFrame(() =>
                                  window.scrollTo({ top: 0, behavior: "smooth" }),
                                );
                              }
                            }}
                            className="h-7 px-3 rounded-lg bg-muted hover:bg-muted/70 text-[11px] font-bold transition"
                          >
                            Ver
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </section>

      <section className="surface-raised rounded-[24px] p-6 bg-white/95 backdrop-blur-md shadow-sm border border-black/[0.04]">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-[18px] font-black tracking-tight text-foreground">Performance rolling</h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              Hit-rate observado vs baseline aleatorio (25%). Ventana de evaluación.
            </p>
          </div>
          <div className="flex gap-1 p-1 rounded-xl bg-muted">
            {[30, 60, 90].map((d) => (
              <button
                key={d}
                onClick={() => setWindowDays(d as 30 | 60 | 90)}
                className={cn(
                  "h-8 px-3 rounded-lg text-[12px] font-bold transition",
                  windowDays === d ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        {stats.isLoading ? (
          <div className="grid place-items-center h-40 text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : !stats.data || stats.data.total === 0 ? (
          <div className="rounded-xl bg-muted/40 p-6 text-center text-[13px] text-muted-foreground">
            Aún no hay carteras evaluadas. Generá carteras hora a hora y esperá a que el evaluador automático registre los resultados.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              <Kpi
                icon={<Target className="size-4" />}
                label="Hit-rate"
                value={`${(stats.data.hitRate * 100).toFixed(1)}%`}
                hint={`baseline ${(stats.data.baseline * 100).toFixed(0)}%`}
              />
              <Kpi
                icon={<TrendingUp className="size-4" />}
                label="Lift vs aleatorio"
                value={`${stats.data.lift >= 0 ? "+" : ""}${(stats.data.lift * 100).toFixed(1)}pp`}
                tone={stats.data.lift > 0 ? "good" : stats.data.lift < 0 ? "bad" : "neutral"}
              />
              <Kpi
                icon={<CheckCircle2 className="size-4" />}
                label="Wilson 95%"
                value={`${(stats.data.wilsonLow * 100).toFixed(1)}–${(stats.data.wilsonHigh * 100).toFixed(1)}%`}
                hint={stats.data.wilsonLow > stats.data.baseline ? "señal real" : "no concluyente"}
                tone={stats.data.wilsonLow > stats.data.baseline ? "good" : "neutral"}
              />
              <Kpi
                icon={<Briefcase className="size-4" />}
                label="Sample size"
                value={String(stats.data.total)}
                hint={`${stats.data.hits} aciertos`}
              />
            </div>

            {/* Línea por día */}
            <div className="rounded-xl bg-muted/20 p-4 mb-4">
              <div className="text-[12px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                Hit-rate por día
              </div>
              <ChartContainer
                config={{ hitRate: { label: "Hit-rate", color: "hsl(var(--primary))" } }}
                className="h-[200px] w-full aspect-auto"
              >
                <AreaChart data={stats.data.porDia.map((d) => ({ ...d, hitRatePct: d.hitRate * 100 }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="fecha" tickFormatter={(v) => v.slice(5)} />
                  <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ReferenceLine y={25} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" label={{ value: "baseline 25%", position: "right", fontSize: 10 }} />
                  <Area dataKey="hitRatePct" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} type="monotone" />
                </AreaChart>
              </ChartContainer>
            </div>

            {/* Barra por hora */}
            <div className="rounded-xl bg-muted/20 p-4">
              <div className="text-[12px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                Hit-rate por hora
              </div>
              <ChartContainer
                config={{ hitRatePct: { label: "Hit-rate", color: "hsl(var(--primary))" } }}
                className="h-[200px] w-full aspect-auto"
              >
                <BarChart data={stats.data.porHora.map((d) => ({ ...d, hitRatePct: Math.round(d.hitRate * 100) }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hora" />
                  <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ReferenceLine y={25} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" />
                  <Bar dataKey="hitRatePct" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function ConfidencePill({ tier }: { tier: "alta" | "media" | "baja" }) {
  const map = {
    alta:  { label: "Alta",  cls: "bg-primary text-primary-foreground", icon: <Flame className="size-3" /> },
    media: { label: "Media", cls: "bg-primary/15 text-primary",          icon: null },
    baja:  { label: "Baja",  cls: "bg-muted text-muted-foreground",      icon: null },
  } as const;
  const m = map[tier];
  return (
    <span className={cn("inline-flex items-center gap-1 h-6 px-2 rounded-full text-[11px] font-bold", m.cls)}>
      {m.icon}{m.label}
    </span>
  );
}

function Kpi({
  icon, label, value, hint, tone = "neutral",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: "good" | "bad" | "neutral";
}) {
  return (
    <div className="rounded-xl bg-white border border-black/[0.04] p-4 shadow-sm">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-[11px] font-bold uppercase tracking-wider">{label}</span>
        <span className={cn(
          "size-7 rounded-lg grid place-items-center",
          tone === "good" ? "bg-primary/10 text-primary" :
          tone === "bad" ? "bg-destructive/10 text-destructive" :
          "bg-muted text-foreground",
        )}>{icon}</span>
      </div>
      <div className={cn(
        "mt-2 text-[22px] font-black tabular-nums tracking-tight",
        tone === "good" ? "text-primary" : tone === "bad" ? "text-destructive" : "text-foreground",
      )}>{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}
