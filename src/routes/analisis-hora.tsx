import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Loader2, Activity, Zap, CheckCircle2, XCircle, AlertCircle, Clock as ClockIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import {
  computeBalance,
  subcuadranteLabel,
  type Subcuadrante,
  type AltoBajo,
  type ParImpar,
  type Sorteo,
} from "@/lib/lottery";
import { BalanceBar } from "@/components/BalanceBar";
import {
  AltoBajoBadge,
  ParImparBadge,
} from "@/components/ClassificationBadge";
import { useDraws } from "@/hooks/useDraws";
import { drawToSorteo } from "@/lib/drawAdapter";

const HORAS = [
  "09:00", "10:00", "11:00", "12:00", "13:00", "14:00",
  "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00"
];

// ─── Helpers para comparación manual vs real ─────────────────────────────────

function normStr(v: unknown): string {
  if (v == null) return "";
  return String(v)
    .trim()
    .toUpperCase()
    .replace(/[_\-+&·]/g, " ")
    .replace(/\s+/g, " ");
}

function extractAB(s: string): AltoBajo | null {
  if (s.includes("ALTO")) return "ALTO";
  if (s.includes("BAJO")) return "BAJO";
  return null;
}

function extractPI(s: string): ParImpar | null {
  if (s.includes("IMPAR")) return "IMPAR";
  if (s.includes("PAR")) return "PAR";
  return null;
}

interface CompRow {
  id: string;
  fecha: string;
  numero: number;
  escenarioLabel: string;
  predictedAB: AltoBajo | null;
  predictedPI: ParImpar | null;
  actualAB: AltoBajo;
  actualPI: ParImpar;
  abMatch: boolean;
  piMatch: boolean | null;
}

function buildCompRow(s: Sorteo): CompRow | null {
  const ma = s.extra?.manual_analysis;
  if (!ma) return null;

  const escNorm = normStr(ma.escenario_probable);
  const rngNorm  = normStr(ma.rango);
  const parNorm  = normStr(ma.paridad);
  const cuadNorm = normStr(ma.cuadrante);

  const predictedAB: AltoBajo | null =
    extractAB(escNorm) ?? extractAB(rngNorm) ?? extractAB(cuadNorm);

  const predictedPI: ParImpar | null =
    extractPI(escNorm) ?? extractPI(parNorm) ?? extractPI(cuadNorm);

  if (predictedAB === null) return null;

  const rawEsc  = ma.escenario_probable;
  const rawRng  = ma.rango;
  const rawPar  = ma.paridad;
  const rawCuad = ma.cuadrante;

  let escenarioLabel: string;
  if (rawEsc != null && String(rawEsc).trim() !== "") {
    escenarioLabel = String(rawEsc);
  } else if (rawRng != null || rawPar != null) {
    escenarioLabel = [rawRng, rawPar]
      .filter((x) => x != null && String(x).trim() !== "")
      .map(String)
      .join(" + ");
  } else if (rawCuad != null && String(rawCuad).trim() !== "") {
    escenarioLabel = String(rawCuad);
  } else {
    escenarioLabel = "—";
  }

  const abMatch = predictedAB === s.altoBajo;
  const piMatch = predictedPI !== null ? predictedPI === s.parImpar : null;

  return {
    id: s.id,
    fecha: s.fecha,
    numero: s.numero,
    escenarioLabel,
    predictedAB,
    predictedPI,
    actualAB: s.altoBajo,
    actualPI: s.parImpar,
    abMatch,
    piMatch,
  };
}

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
  const horaActiva = horasDisponibles.includes(hora)
    ? hora
    : (horasDisponibles[0] ?? "13:00");

  const subset = useMemo(
    () => all.filter((s) => s.hora === horaActiva),
    [all, horaActiva],
  );

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

  // ─── Datos de comparación manual vs real ─────────────────────────────────
  const compData = useMemo(() => {
    const rows: CompRow[] = [];
    for (const s of subset) {
      const row = buildCompRow(s);
      if (row) rows.push(row);
    }

    rows.sort((a, b) => b.fecha.localeCompare(a.fecha));

    const total    = rows.length;
    const aciertos = rows.filter((r) => r.abMatch).length;
    const fallos   = total - aciertos;
    const pct      = total > 0 ? (aciertos / total) * 100 : 0;

    return {
      rows: rows.slice(0, 100),
      total,
      aciertos,
      fallos,
      pct,
      hasData: total > 0,
    };
  }, [subset]);

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
    <div className="space-y-6 pt-2">
      <div className="mb-8">
         <h1 className="text-[32px] font-bold tracking-tight text-foreground">Análisis por hora</h1>
         <p className="text-[15px] text-muted-foreground mt-1 max-w-2xl">Rueda horizontal de comportamiento: análisis de varianza y proyecciones divididas por bloques temporales.</p>
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

      {/* Balance histórico + Distribución subcuadrante */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-[32px] border border-border p-8 shadow-sm relative overflow-hidden">
          <h3 className="text-[14px] font-bold uppercase tracking-[0.1em] text-foreground mb-8 flex items-center gap-3">
             <Activity className="size-5 text-muted-foreground/60" /> Balance histórico — {horaActiva}
          </h3>
          {subset.length === 0 ? (
            <div className="py-16 text-center bg-muted/10 rounded-[20px] border border-dashed border-border/50">
              <p className="text-[13px] font-bold text-muted-foreground tracking-widest uppercase">SIN DATOS PARA RENDERIZAR</p>
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
                   Muestra: <span className="text-foreground">{subset.length}</span> eventos históricos
                 </span>
              </div>
            </>
          )}
        </div>

        <div className="bg-white rounded-[32px] border border-border p-8 shadow-sm relative overflow-hidden flex flex-col">
          <h3 className="text-[14px] font-bold uppercase tracking-[0.1em] text-foreground mb-8 flex items-center gap-3">
             Densidad Sectorial
          </h3>
          <div className="grid grid-cols-2 gap-4 flex-1">
            {(Object.keys(distribucion) as Subcuadrante[]).map((k) => {
              const total = subset.length || 1;
              const pct = (distribucion[k] / total) * 100;
              return (
                <div key={k} className="relative rounded-[20px] bg-muted/20 border border-border p-5 overflow-hidden group hover:bg-muted/40 hover:border-primary/20 transition-colors">
                  <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">{subcuadranteLabel[k]}</div>
                  <div className="mt-2 text-4xl font-extrabold tabular-nums text-foreground group-hover:scale-105 transition-transform duration-300 origin-left">
                    {distribucion[k]}
                  </div>
                  <div className="mt-5 h-[6px] rounded-full bg-border shadow-inner overflow-hidden relative">
                    <div className="h-full bg-muted-foreground/30 rounded-full group-hover:bg-primary transition-colors duration-500" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-2 text-[11px] font-bold tracking-widest text-muted-foreground tabular-nums text-right">
                    {pct.toFixed(1)}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Patrones más comunes */}
      {subset.length > 0 && (
        <div className="bg-white rounded-[32px] border border-border p-8 shadow-sm relative overflow-hidden">
          <h3 className="text-[14px] font-bold uppercase tracking-[0.1em] text-foreground mb-6 flex items-center gap-3">
             <Zap className="size-5 text-primary" /> Fricción Constante
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-[20px] bg-muted/40 border border-border px-6 py-4 transition-colors">
              <span className="text-[13px] font-bold text-muted-foreground">
                Vector dominante:{" "}
                <span className="font-extrabold text-foreground ml-1">{balance.pctAltos > balance.pctBajos ? "ALTO" : "BAJO"}</span>
              </span>
              <span className="text-[18px] font-extrabold tabular-nums text-primary">
                {Math.max(balance.pctAltos, balance.pctBajos).toFixed(0)}%
              </span>
            </div>
            <div className="flex items-center justify-between rounded-[20px] bg-muted/40 border border-border px-6 py-4 transition-colors">
              <span className="text-[13px] font-bold text-muted-foreground">
                Polaridad:{" "}
                <span className="font-extrabold text-foreground ml-1">{balance.pctPares > balance.pctImpares ? "PAR" : "IMPAR"}</span>
              </span>
              <span className="text-[18px] font-extrabold tabular-nums text-primary">
                {Math.max(balance.pctPares, balance.pctImpares).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/*  SECCIÓN: Análisis manual vs resultado real                       */}
      {/* ══════════════════════════════════════════════════════════════════ */}

      {compData.hasData ? (
        <div className="mt-16 space-y-6">
          {/* Encabezado de sección */}
          <div className="border-t border-border pt-10 mb-8">
            <h3 className="text-[20px] font-bold tracking-tight text-foreground flex items-center gap-3">
               Auditoría Humana vs IA
               <div className="px-2 py-0.5 rounded-[6px] text-[10px] font-bold bg-muted text-muted-foreground border border-border">BETA</div>
            </h3>
            <p className="text-[14px] text-muted-foreground mt-2 max-w-3xl leading-relaxed">
              Validación cruzada entre predicciones del operador (batch manual) y los eventos resolutivos registrados en la ventana [ <span className="font-bold text-foreground">{horaActiva}</span> ].
            </p>
          </div>

          {/* Tarjetas resumen */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            <CompStat
              label="Muestra Evaluada"
              value={compData.total.toString()}
              hint="Eventos traceados"
            />
            <CompStat
              label="Hits (Aciertos)"
              value={compData.aciertos.toString()}
              tone="success"
              hint="Rango convergente"
            />
            <CompStat
              label="Miss (Fallos)"
              value={compData.fallos.toString()}
              tone="error"
              hint="Rango divergente"
            />
            <CompStat
              label="Ratio (Winrate)"
              value={`${compData.pct.toFixed(0)}%`}
              tone={
                compData.pct >= 60
                  ? "success"
                  : compData.pct >= 40
                    ? "warning"
                    : "error"
              }
              hint="Efectividad total"
            />
          </div>

          {/* Barra de efectividad */}
          <div className="bg-white rounded-[32px] border border-border shadow-sm p-8 relative overflow-hidden">
            
            <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 gap-4 relative z-10">
              <div>
                 <span className="text-[15px] font-bold uppercase tracking-[0.1em] text-foreground">
                   Desempeño de Vector Principal (A/B)
                 </span>
                 <p className="mt-2 text-[13px] text-muted-foreground leading-relaxed max-w-2xl font-medium">
                   El sistema de scoring principal valora la aserción de rango. Si existe paridad, se documenta como hiper-convergencia paralela ("Acierto completo").
                 </p>
              </div>
              <div className="flex items-baseline gap-2 shrink-0 bg-muted/50 px-4 py-2 rounded-xl border border-border">
                <span className="text-[11px] font-bold text-muted-foreground uppercase">Score</span>
                <span className="text-2xl font-extrabold tabular-nums text-foreground">
                  {compData.aciertos}
                </span>
                <span className="text-[13px] text-muted-foreground font-bold">/ {compData.total}</span>
              </div>
            </div>
            <div className="h-4 rounded-full bg-muted border border-border overflow-hidden relative z-10">
              <div
                className={`h-full relative transition-all duration-1000 ${
                  compData.pct >= 60
                    ? "bg-emerald-500"
                    : compData.pct >= 40
                      ? "bg-orange-500"
                      : "bg-red-500"
                }`}
                style={{ width: `${compData.pct}%` }}
              >
              </div>
            </div>
          </div>

          {/* Tabla detallada - Terminal UI */}
          <div className="bg-white rounded-[32px] border border-border shadow-sm overflow-hidden">
            <div className="px-8 py-6 border-b border-border bg-muted/10 flex items-center justify-between">
              <div>
                <h4 className="text-[15px] font-bold uppercase tracking-[0.1em] text-foreground">Trace Log</h4>
                <p className="text-[12px] text-muted-foreground mt-1 font-bold">
                  {compData.rows.length < compData.total
                    ? `[ LIMIT ${compData.rows.length} / ${compData.total} ] DESC`
                    : `[ FULL DUMP ${compData.total} ] DESC`}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-muted/5 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground border-b border-border">
                  <tr>
                    <th className="px-8 py-4 whitespace-nowrap">Timestamp</th>
                    <th className="px-8 py-4 whitespace-nowrap">Matriz</th>
                    <th className="px-8 py-4 whitespace-nowrap">Input Manual</th>
                    <th className="px-8 py-4 whitespace-nowrap">Event Output</th>
                    <th className="px-8 py-4 whitespace-nowrap">State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {compData.rows.map((row) => (
                    <tr
                      key={row.id}
                      className="group hover:bg-muted/20 transition-colors"
                    >
                      <td className="px-8 py-4 tabular-nums text-[13px] font-mono font-medium text-muted-foreground whitespace-nowrap">
                        {row.fecha}
                      </td>
                      <td className="px-8 py-4 font-mono text-[16px] font-extrabold text-foreground tabular-nums">
                        {row.numero.toString().padStart(2, "0")}
                      </td>
                      <td className="px-8 py-4">
                        <div className="flex flex-col gap-2">
                          <span
                            className="text-[13px] font-bold text-muted-foreground truncate max-w-[200px]"
                            title={row.escenarioLabel}
                          >
                            {row.escenarioLabel}
                          </span>
                          {/* Predicción parseada*/}
                          {row.predictedAB && (
                            <div className="flex gap-2 flex-wrap">
                              <span className="inline-block rounded-md border border-border bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest tabular-nums text-foreground shadow-sm">
                                {row.predictedAB}
                              </span>
                              {row.predictedPI && (
                                <span className="inline-block rounded-md border border-border bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest tabular-nums text-foreground shadow-sm">
                                  {row.predictedPI}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-4">
                        <div className="flex gap-2 flex-wrap">
                          <AltoBajoBadge value={row.actualAB} soft={false} />
                          <ParImparBadge value={row.actualPI} soft={false} />
                        </div>
                      </td>
                      <td className="px-8 py-4">
                        <EvaluacionBadge
                          abMatch={row.abMatch}
                          piMatch={row.piMatch}
                          hasPi={row.predictedPI !== null}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Estado vacío */
        subset.length > 0 && (
          <div className="mt-10 rounded-[32px] border border-dashed border-border/70 bg-white p-12 text-center relative overflow-hidden group">
            
            <div className="mx-auto flex size-16 items-center justify-center rounded-[20px] bg-muted border border-border mb-6 shadow-sm">
               <AlertCircle className="size-6 text-muted-foreground group-hover:text-primary transition-colors duration-500" />
            </div>
            <p className="text-[16px] font-bold text-foreground tracking-tight">
              Sin auditoría operaria en <span className="font-extrabold ml-1">{horaActiva}</span>
            </p>
            <p className="text-[14px] text-muted-foreground mt-3 max-w-xl mx-auto leading-relaxed">
              El subsistema de validación cruzada requiere que el batch de datos inyectados vía Excel posea las columnas 'Escenario probable', 'Rango' o 'Paridad'.
            </p>
          </div>
        )
      )}
    </div>
  );
}

// ─── Sub-componentes de UI ────────────────────────────────────────────────────

function CompStat({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone?: "success" | "error" | "warning";
  hint?: string;
}) {
  const isSuccess = tone === "success";
  const isError = tone === "error";
  const isWarning = tone === "warning";

  return (
    <div className={cn(
      "relative rounded-[24px] p-6 shadow-sm overflow-hidden border",
      isSuccess ? "bg-emerald-50 border-emerald-100" :
      isError ? "bg-red-50 border-red-100" :
      isWarning ? "bg-orange-50 border-orange-100" :
      "bg-white border-border"
    )}>
      <div className={cn(
        "text-[11px] font-bold uppercase tracking-[0.1em] mb-3 relative z-10",
        isSuccess ? "text-emerald-800" :
        isError ? "text-red-800" :
        isWarning ? "text-orange-800" :
        "text-muted-foreground"
      )}>{label}</div>
      <div className={`text-4xl font-extrabold tabular-nums relative z-10 ${
        isSuccess ? "text-emerald-600" : isError ? "text-red-600" : isWarning ? "text-orange-600" : "text-foreground"
      }`}>
        {value}
      </div>
      {hint && (
        <div className={cn(
           "mt-3 text-[10px] font-bold tracking-widest uppercase relative z-10",
           isSuccess ? "text-emerald-700/60" :
           isError ? "text-red-700/60" :
           isWarning ? "text-orange-700/60" :
           "text-muted-foreground/60"
        )}>{hint}</div>
      )}
    </div>
  );
}

function EvaluacionBadge({
  abMatch,
  piMatch,
  hasPi,
}: {
  abMatch: boolean;
  piMatch: boolean | null;
  hasPi: boolean;
}) {
  if (abMatch && hasPi && piMatch === true) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-[8px] bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[11px] font-bold text-emerald-700 whitespace-nowrap shadow-sm">
        <CheckCircle2 className="size-3.5" /> Acierto Comp.
      </span>
    );
  }
  if (abMatch) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-[8px] bg-emerald-50/50 border border-emerald-200/50 px-2.5 py-1 text-[11px] font-bold text-emerald-600 whitespace-nowrap">
        <CheckCircle2 className="size-3.5 opacity-70" /> Acierto
      </span>
    );
  }
  if (!abMatch && piMatch === true) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-[8px] bg-orange-50 border border-orange-200 px-2.5 py-1 text-[11px] font-bold text-orange-700 whitespace-nowrap">
        <Activity className="size-3.5 opacity-70" /> Parcial
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-[8px] bg-red-50 border border-red-200 px-2.5 py-1 text-[11px] font-bold text-red-700 whitespace-nowrap">
      <XCircle className="size-3.5" /> Fallo
    </span>
  );
}
