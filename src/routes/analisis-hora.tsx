import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Loader2,
  Activity,
  Zap,
  Clock as ClockIcon,
  Repeat,
  Target,
  TrendingUp,
  Hash,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import {
  computeBalance,
  computeRachas,
  computeEscenarioProbablePorHora,
  subcuadranteLabel,
  type Subcuadrante,
  type AltoBajo,
  type ParImpar,
  type Sorteo,
} from "@/lib/lottery";
import { BalanceBar } from "@/components/BalanceBar";
import { AltoBajoBadge, ParImparBadge, SubcuadranteBadge } from "@/components/ClassificationBadge";
import { useDraws } from "@/hooks/useDraws";
import { useRules } from "@/hooks/useRules";
import { drawToSorteo } from "@/lib/drawAdapter";
import { getActiveRulesForSubset } from "@/lib/rulesEngine";

const HORAS = [
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
  "21:00",
  "22:00",
];


// ─── Route ───────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/analisis-hora")({
  head: () => ({
    meta: [
      { title: "Análisis por hora — Cuadrante" },
      { name: "description", content: "Comportamiento histórico de cada hora del día." },
    ],
  }),
  component: AnalisisHora,
});

// ─── Componente principal ─────────────────────────────────────────────────────

function AnalisisHora() {
  const { data: draws = [], isLoading } = useDraws({ limit: 5000 });
  const all = useMemo(() => draws.map(drawToSorteo), [draws]);

  const horasDisponibles = useMemo(() => {
    const set = new Set(all.map((s) => s.hora));
    const found = Array.from(set).sort();
    return found.length > 0 ? found : HORAS;
  }, [all]);

  const [hora, setHora] = useState<string>(() => "13:00");
  const horaActiva = horasDisponibles.includes(hora) ? hora : (horasDisponibles[0] ?? "13:00");

  const subset = useMemo(() => all.filter((s) => s.hora === horaActiva), [all, horaActiva]);

  const balance = useMemo(() => computeBalance(subset), [subset]);

  const distribucion = useMemo(() => {
    const map: Record<Subcuadrante, number> = {
      ALTO_PAR: 0,
      ALTO_IMPAR: 0,
      BAJO_PAR: 0,
      BAJO_IMPAR: 0,
    };
    for (const s of subset) map[s.subcuadrante]++;
    return map;
  }, [subset]);


  // ─── Rachas activas para la hora seleccionada ────────────────────────────
  const rachas = useMemo(() => computeRachas(subset), [subset]);

  // ─── Tendencia dominante ───────────────────────────────────────────
  const tendencia = useMemo(() => {
    const rangoDom: AltoBajo = balance.pctAltos >= balance.pctBajos ? "ALTO" : "BAJO";
    const paridadDom: ParImpar = balance.pctPares >= balance.pctImpares ? "PAR" : "IMPAR";
    const cuadEntries = Object.entries(distribucion) as [Subcuadrante, number][];
    const cuadDom = cuadEntries.reduce((a, b) => (b[1] > a[1] ? b : a), cuadEntries[0]);
    return {
      rango: rangoDom,
      rangoPct: Math.max(balance.pctAltos, balance.pctBajos),
      paridad: paridadDom,
      paridadPct: Math.max(balance.pctPares, balance.pctImpares),
      cuadrante: cuadDom[0],
      cuadranteCount: cuadDom[1],
      cuadrantePct: subset.length > 0 ? (cuadDom[1] / subset.length) * 100 : 0,
    };
  }, [balance, distribucion, subset.length]);

  // ─── Historial reciente (últimos 30) ───────────────────────────────
  const recientes = useMemo(() => {
    return [...subset]
      .sort((a, b) => `${b.fecha} ${b.hora}`.localeCompare(`${a.fecha} ${a.hora}`))
      .slice(0, 30);
  }, [subset]);

  // ─── Escenario Probable (Level 3) ──────────────────────────────────
  const escenarioProbable = useMemo(() => {
    return computeEscenarioProbablePorHora(subset, balance, rachas, distribucion, tendencia);
  }, [subset, balance, rachas, distribucion, tendencia]);

  // ─── Alertas Tempranas (Level 4A) ──────────────────────────────────
  const { rules } = useRules();
  const activeAlerts = useMemo(() => {
     return getActiveRulesForSubset(rules, subset);
  }, [rules, subset]);


  if (isLoading) {
    return (
      <div className="grid place-items-center py-32 text-muted-foreground animate-pulse-subtle">
        <div className="size-14 rounded-[16px] bg-white border border-border grid place-items-center shadow-sm">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pt-2 pb-10">
      <div className="mb-8 flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-bold tracking-tight text-foreground">Análisis por hora</h1>
          <p className="text-[15px] text-muted-foreground mt-1 max-w-2xl">
            Rueda horizontal de comportamiento: análisis de varianza y proyecciones divididas por
            bloques temporales.
          </p>
        </div>
        <Link
          to="/comparativa"
          className="inline-flex items-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-4 py-2.5 rounded-[16px] font-bold text-[13px] transition-colors shadow-sm"
        >
          <TrendingUp className="size-4" />
          Ir a Comparativa Global
        </Link>
      </div>

      {/* Selector de hora — Hardware Pill Style */}
      <div className="bg-white rounded-[32px] border border-border p-6 shadow-sm relative overflow-hidden group">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-[12px] bg-muted/50 border border-border shadow-sm grid place-items-center shrink-0">
              <ClockIcon className="size-5 text-muted-foreground" />
            </div>
            <div className="text-[12px] font-bold uppercase tracking-[0.1em] text-muted-foreground whitespace-nowrap">
              Seleccionar Bloque Temporal
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5 md:flex-1">
            {horasDisponibles.map((h) => {
              const active = h === horaActiva;
              return (
                <button
                  key={h}
                  onClick={() => setHora(h)}
                  className={`relative px-5 h-10 rounded-[12px] text-[13px] font-bold tracking-widest transition-all duration-300 outline-none ${
                    active
                      ? "text-primary border-primary bg-primary/5 shadow-sm border"
                      : "bg-muted/30 border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {h}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ══ Escenario Probable Hero (Level 3) ══ */}
      {subset.length > 0 && (
        <div className="bg-primary text-primary-foreground rounded-[32px] p-6 lg:p-10 shadow-lg relative overflow-hidden group">
          {/* Background decoration */}
          <div className="absolute right-0 top-0 translate-x-1/3 -translate-y-1/3 size-64 bg-primary-foreground/10 rounded-full blur-3xl group-hover:bg-primary-foreground/20 transition-colors duration-700" />
          
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-5 flex flex-col justify-center border-b lg:border-b-0 lg:border-r border-primary-foreground/20 pb-6 lg:pb-0 lg:pr-8">
              <div className="flex items-center gap-3 text-primary-foreground/80 mb-4">
                <Target className="size-5" />
                <span className="text-[12px] font-bold uppercase tracking-[0.2em] shadow-sm">
                  Escenario Probable
                </span>
              </div>
              <div className="text-4xl lg:text-5xl font-extrabold tracking-tight">
                {escenarioProbable.escenario}
              </div>
              
              <div className="mt-8">
                <div className="flex items-center justify-between text-[13px] font-bold uppercase tracking-widest mb-3">
                  <span>Confianza del Modelo</span>
                  <span className="text-2xl">{escenarioProbable.confianza}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-primary-foreground/20 overflow-hidden relative shadow-inner">
                  <div 
                    className="h-full bg-white rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                    style={{ width: `${escenarioProbable.confianza}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 flex flex-col justify-center">
              <h4 className="text-[12px] font-bold uppercase tracking-[0.2em] text-primary-foreground/80 mb-4">
                Factores de Soporte
              </h4>
              <div className="space-y-3">
                {escenarioProbable.razones.map((razon, idx) => (
                  <div key={idx} className="flex items-start gap-4 bg-primary-foreground/5 bg-opacity-50 p-4 rounded-xl border border-primary-foreground/10 hover:bg-primary-foreground/10 transition-colors">
                     <span className="mt-0.5 size-5 rounded-full bg-primary-foreground/20 flex items-center justify-center shrink-0 text-[10px] font-bold">
                       {idx + 1}
                     </span>
                     <p className="text-[14px] leading-relaxed font-medium">
                       {razon}
                     </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ Alertas Tempranas (Level 4A) ══ */}
      {activeAlerts.length > 0 && (
        <div className="bg-slate-900 text-white rounded-[32px] p-6 lg:p-8 shadow-md relative overflow-hidden group border border-slate-800">
           <div className="absolute right-0 top-0 translate-x-1/4 -translate-y-1/4 size-48 bg-emerald-500/10 rounded-full blur-3xl" />
           <div className="relative z-10">
             <div className="flex items-center gap-3 mb-6">
                <span className="relative flex size-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full size-3 bg-emerald-500"></span>
                </span>
                <span className="text-[13px] font-bold uppercase tracking-[0.2em] shadow-sm text-slate-200">
                  Señales de Análisis — Oportunidades Detectadas
                </span>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeAlerts.map((alert, i) => (
                   <div key={i} className="bg-slate-800/50 backdrop-blur-sm p-5 rounded-[20px] border border-slate-700/50">
                      <div className="flex justify-between items-start mb-3">
                         <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300 bg-slate-700/50 px-2 py-1 rounded-md">
                           {alert.rule.tipo}
                         </span>
                         <span className="text-[12px] font-extrabold tabular-nums bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-full border border-emerald-500/30">
                           {alert.rule.ocurrencias > 0 ? ((alert.rule.aciertos / alert.rule.ocurrencias) * 100).toFixed(0) : "0"}% WINRATE
                         </span>
                      </div>
                      <h4 className="text-[16px] font-bold leading-tight mb-2 text-white">
                        {alert.rule.nombre}
                      </h4>
                      <p className="text-[13px] text-slate-300 font-medium leading-relaxed mb-4">
                        {alert.mensaje}
                      </p>
                      
                      <div className="border-t border-slate-700/50 pt-3">
                        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400 block mb-1">
                          Escenario Sugerido
                        </span>
                        <span className="text-[14px] font-extrabold uppercase tracking-widest text-white">
                          {alert.rule.resultado_esperado || "N/A"}
                        </span>
                      </div>
                   </div>
                ))}
             </div>
           </div>
        </div>
      )}

      {/* ══ 4 Summary Cards ══ */}
      {subset.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 lg:gap-6">
          <div className="relative rounded-[20px] lg:rounded-[24px] p-5 lg:p-6 shadow-sm overflow-hidden border bg-white border-border">
            <div className="text-[11px] font-bold uppercase tracking-[0.1em] mb-3 text-muted-foreground">Total Sorteos</div>
            <div className="text-3xl lg:text-4xl font-extrabold tabular-nums text-foreground">{subset.length}</div>
            <div className="mt-3 text-[10px] font-bold tracking-widest uppercase text-muted-foreground/60">Bloque {horaActiva}</div>
          </div>
          <div className="relative rounded-[20px] lg:rounded-[24px] p-5 lg:p-6 shadow-sm overflow-hidden border bg-white border-border">
            <div className="text-[11px] font-bold uppercase tracking-[0.1em] mb-3 text-muted-foreground">Rango Dominante</div>
            <div className={`text-3xl lg:text-4xl font-extrabold tabular-nums ${tendencia.rango === "ALTO" ? "text-blue-600" : "text-amber-600"}`}>{tendencia.rango}</div>
            <div className="mt-3 text-[10px] font-bold tracking-widest uppercase text-muted-foreground/60">{tendencia.rangoPct.toFixed(0)}% del historial</div>
          </div>
          <div className="relative rounded-[20px] lg:rounded-[24px] p-5 lg:p-6 shadow-sm overflow-hidden border bg-white border-border">
            <div className="text-[11px] font-bold uppercase tracking-[0.1em] mb-3 text-muted-foreground">Paridad Dominante</div>
            <div className={`text-3xl lg:text-4xl font-extrabold tabular-nums ${tendencia.paridad === "PAR" ? "text-emerald-600" : "text-violet-600"}`}>{tendencia.paridad}</div>
            <div className="mt-3 text-[10px] font-bold tracking-widest uppercase text-muted-foreground/60">{tendencia.paridadPct.toFixed(0)}% del historial</div>
          </div>
          <div className="relative rounded-[20px] lg:rounded-[24px] p-5 lg:p-6 shadow-sm overflow-hidden border bg-emerald-50 border-emerald-100">
            <div className="text-[11px] font-bold uppercase tracking-[0.1em] mb-3 text-emerald-800">Cuadrante Top</div>
            <div className="text-2xl lg:text-3xl font-extrabold tabular-nums text-emerald-600">{subcuadranteLabel[tendencia.cuadrante]}</div>
            <div className="mt-3 text-[10px] font-bold tracking-widest uppercase text-emerald-700/60">{tendencia.cuadrantePct.toFixed(0)}% — {tendencia.cuadranteCount} veces</div>
          </div>
        </div>
      )}

      {/* ══ Balance Histórico + Rachas ══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Balance */}
        <div className="bg-white rounded-[24px] lg:rounded-[32px] border border-border p-5 lg:p-8 shadow-sm relative overflow-hidden">
          <h3 className="text-[14px] font-bold uppercase tracking-[0.1em] text-foreground mb-6 lg:mb-8 flex items-center gap-3">
            <Activity className="size-5 text-muted-foreground/60" /> Balance histórico —{" "}
            {horaActiva}
          </h3>
          {subset.length === 0 ? (
            <div className="py-16 text-center bg-muted/10 rounded-[20px] border border-dashed border-border/50">
              <p className="text-[13px] font-bold text-muted-foreground tracking-widest uppercase">
                SIN DATOS PARA RENDERIZAR
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-8">
                <BalanceBar
                  leftLabel="ALTO"
                  rightLabel="BAJO"
                  leftValue={balance.altos}
                  rightValue={balance.bajos}
                  leftClass="bg-alto"
                  rightClass="bg-bajo"
                />
                <BalanceBar
                  leftLabel="PAR"
                  rightLabel="IMPAR"
                  leftValue={balance.pares}
                  rightValue={balance.impares}
                  leftClass="bg-par"
                  rightClass="bg-impar"
                />
              </div>
              <div className="mt-10 pt-5 border-t border-border flex items-center gap-3">
                <span className="size-2 rounded-full bg-border" />
                <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                  Muestra: <span className="text-foreground">{subset.length}</span> eventos
                  históricos
                </span>
              </div>
            </>
          )}
        </div>

        {/* Rachas Activas */}
        <div className="bg-white rounded-[24px] lg:rounded-[32px] border border-border p-5 lg:p-8 shadow-sm relative overflow-hidden flex flex-col">
          <h3 className="text-[14px] font-bold uppercase tracking-[0.1em] text-foreground mb-6 lg:mb-8 flex items-center gap-3">
            <Repeat className="size-5 text-primary" /> Rachas Activas
          </h3>
          {rachas.length === 0 ? (
            <div className="flex-1 flex items-center justify-center bg-muted/10 rounded-[20px] border border-dashed border-border/50 p-8">
              <p className="text-[13px] font-bold text-muted-foreground tracking-widest uppercase text-center">
                Sin rachas detectadas (≥2 consecutivos)
              </p>
            </div>
          ) : (
            <div className="space-y-4 flex-1">
              {rachas.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-[16px] bg-muted/20 border border-border px-5 py-4 hover:bg-muted/40 transition-colors group"
                >
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{r.tipo}</span>
                    <span className="text-[16px] font-extrabold text-foreground mt-1">{r.valor}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[28px] font-extrabold tabular-nums text-primary group-hover:scale-110 transition-transform">{r.longitud}</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">seguidos</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ══ Distribución Sectorial + Tendencia Dominante ══ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Distribución por cuadrantes */}
        <div className="lg:col-span-7 bg-white rounded-[24px] lg:rounded-[32px] border border-border p-5 lg:p-8 shadow-sm relative overflow-hidden">
          <h3 className="text-[14px] font-bold uppercase tracking-[0.1em] text-foreground mb-6 lg:mb-8 flex items-center gap-3">
            <Target className="size-5 text-muted-foreground/60" /> Densidad Sectorial
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {(Object.keys(distribucion) as Subcuadrante[]).map((k) => {
              const total = subset.length || 1;
              const pct = (distribucion[k] / total) * 100;
              const isDominant = k === tendencia.cuadrante;
              return (
                <div
                  key={k}
                  className={cn(
                    "relative rounded-[20px] border p-5 overflow-hidden group hover:border-primary/20 transition-colors",
                    isDominant ? "bg-primary/5 border-primary/20" : "bg-muted/20 border-border",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                      {subcuadranteLabel[k]}
                    </div>
                    {isDominant && (
                      <span className="text-[9px] font-bold uppercase tracking-widest bg-primary text-white px-1.5 py-0.5 rounded-md">TOP</span>
                    )}
                  </div>
                  <div className="mt-2 text-4xl font-extrabold tabular-nums text-foreground group-hover:scale-105 transition-transform duration-300 origin-left">
                    {distribucion[k]}
                  </div>
                  <div className="mt-5 h-[6px] rounded-full bg-border shadow-inner overflow-hidden relative">
                    <div
                      className={cn(
                        "h-full rounded-full transition-colors duration-500",
                        isDominant ? "bg-primary" : "bg-muted-foreground/30 group-hover:bg-primary",
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-2 text-[11px] font-bold tracking-widest text-muted-foreground tabular-nums text-right">
                    {pct.toFixed(1)}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tendencia Dominante */}
        <div className="lg:col-span-5 bg-white rounded-[24px] lg:rounded-[32px] border border-border p-5 lg:p-8 shadow-sm relative overflow-hidden flex flex-col">
          <h3 className="text-[14px] font-bold uppercase tracking-[0.1em] text-foreground mb-6 lg:mb-8 flex items-center gap-3">
            <TrendingUp className="size-5 text-primary" /> Tendencia Dominante
          </h3>
          {subset.length === 0 ? (
            <div className="flex-1 flex items-center justify-center bg-muted/10 rounded-[20px] border border-dashed border-border/50 p-8">
              <p className="text-[13px] font-bold text-muted-foreground tracking-widest uppercase text-center">
                Sin datos
              </p>
            </div>
          ) : (
            <div className="space-y-4 flex-1">
              <div className="rounded-[16px] bg-muted/20 border border-border px-5 py-4">
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Rango</span>
                <div className="flex items-center justify-between mt-2">
                  <span className={`text-[20px] font-extrabold ${tendencia.rango === "ALTO" ? "text-blue-600" : "text-amber-600"}`}>{tendencia.rango}</span>
                  <span className="text-[18px] font-extrabold tabular-nums text-primary">{tendencia.rangoPct.toFixed(0)}%</span>
                </div>
              </div>
              <div className="rounded-[16px] bg-muted/20 border border-border px-5 py-4">
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Paridad</span>
                <div className="flex items-center justify-between mt-2">
                  <span className={`text-[20px] font-extrabold ${tendencia.paridad === "PAR" ? "text-emerald-600" : "text-violet-600"}`}>{tendencia.paridad}</span>
                  <span className="text-[18px] font-extrabold tabular-nums text-primary">{tendencia.paridadPct.toFixed(0)}%</span>
                </div>
              </div>
              <div className="rounded-[16px] bg-primary/5 border border-primary/20 px-5 py-4">
                <span className="text-[11px] font-bold uppercase tracking-widest text-primary">Cuadrante Dominante</span>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[20px] font-extrabold text-foreground">{subcuadranteLabel[tendencia.cuadrante]}</span>
                  <span className="text-[18px] font-extrabold tabular-nums text-primary">{tendencia.cuadrantePct.toFixed(0)}%</span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-[12px] text-muted-foreground font-medium leading-relaxed">
                  Basado en <span className="font-bold text-foreground">{subset.length}</span> sorteos históricos del bloque <span className="font-bold text-foreground">{horaActiva}</span>.
                  El escenario estadísticamente más probable es: <span className="font-bold text-primary">{subcuadranteLabel[tendencia.cuadrante]}</span>.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══ Historial Reciente de la Hora ══ */}
      {recientes.length > 0 && (
        <div className="bg-white rounded-[24px] lg:rounded-[32px] border border-border shadow-sm overflow-hidden">
          <div className="px-5 lg:px-8 py-5 lg:py-6 border-b border-border bg-muted/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Hash className="size-5 text-muted-foreground" />
              <div>
                <h4 className="text-[15px] font-bold uppercase tracking-[0.1em] text-foreground">
                  Historial Reciente — {horaActiva}
                </h4>
                <p className="text-[12px] text-muted-foreground mt-1 font-bold">
                  [ Últimos {recientes.length} sorteos ] DESC
                </p>
              </div>
            </div>
          </div>

          <div className="w-full">
            {/* Mobile Card List */}
            <div className="lg:hidden flex flex-col divide-y divide-border bg-white w-full">
              {recientes.map((s) => (
                <div key={s.id} className="p-5 flex flex-col gap-3 bg-white hover:bg-muted/20 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[12px] font-mono font-bold text-muted-foreground uppercase tracking-widest">{s.fecha}</span>
                      <span className="font-bold text-foreground text-[14px] mt-1">{s.loteria}</span>
                    </div>
                    <div className="size-12 rounded-xl bg-muted/40 border border-border flex items-center justify-center shadow-sm shrink-0">
                      <span className="font-mono text-[22px] font-extrabold text-foreground">
                        {s.numero.toString().padStart(2, "0")}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <AltoBajoBadge value={s.altoBajo} soft={false} />
                    <ParImparBadge value={s.parImpar} soft={false} />
                    <SubcuadranteBadge value={s.subcuadrante} />
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-muted/5 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground border-b border-border">
                  <tr>
                    <th className="px-6 py-4 whitespace-nowrap">Fecha</th>
                    <th className="px-6 py-4 whitespace-nowrap">Matriz</th>
                    <th className="px-6 py-4 whitespace-nowrap">Número</th>
                    <th className="px-6 py-4 whitespace-nowrap">Alto/Bajo</th>
                    <th className="px-6 py-4 whitespace-nowrap">Par/Impar</th>
                    <th className="px-6 py-4 whitespace-nowrap">Cuadrante</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {recientes.map((s) => (
                    <tr key={s.id} className="group hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-4 tabular-nums text-[13px] font-mono font-medium text-muted-foreground whitespace-nowrap">
                        {s.fecha}
                      </td>
                      <td className="px-6 py-4 text-[13px] font-bold text-foreground">
                        {s.loteria}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-[18px] font-extrabold text-foreground bg-muted px-3 py-1 rounded-[8px] border border-border shadow-sm">
                          {s.numero.toString().padStart(2, "0")}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <AltoBajoBadge value={s.altoBajo} soft={false} />
                      </td>
                      <td className="px-6 py-4">
                        <ParImparBadge value={s.parImpar} soft={false} />
                      </td>
                      <td className="px-6 py-4">
                        <SubcuadranteBadge value={s.subcuadrante} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}

