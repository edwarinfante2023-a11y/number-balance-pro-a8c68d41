import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Briefcase, Sparkles, Target, TrendingUp, Loader2, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useGenerateCartera, useCarteraDelDia, useCarteraStats } from "@/hooks/useCartera";
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

export const Route = createFileRoute("/cartera")({
  component: CarteraPage,
});

function CarteraPage() {
  const { data: lotteryDraws } = useLotteryDraws();
  const horasDisponibles = useMemo(() => {
    const set = new Set<string>();
    (lotteryDraws ?? []).forEach((d: any) => set.add(d.hora));
    return Array.from(set).sort();
  }, [lotteryDraws]);

  const [hora, setHora] = useState<string | null>(null);
  const [windowDays, setWindowDays] = useState<30 | 60 | 90>(30);

  const generate = useGenerateCartera();
  const cartera = useCarteraDelDia(hora);
  const stats = useCarteraStats(windowDays);

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
          {cartera.data && (
            <div className="text-[12px] text-muted-foreground ml-auto">
              <span className="font-semibold text-foreground">{ctx.totalDrawsHora ?? 0}</span> sorteos en esta hora ·
              ALTO {ctx.pctAltos}% / BAJO {ctx.pctBajos}% · PAR {ctx.pctPares}% / IMPAR {ctx.pctImpares}% ·
              {" "}{ctx.reglasActivas} reglas · {ctx.patronesHora} patrones
            </div>
          )}
        </div>

        {/* Grid de números */}
        {cartera.data ? (
          <div className="mt-6">
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