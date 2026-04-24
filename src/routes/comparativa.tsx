import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Loader2,
  Activity,
  CheckCircle2,
  XCircle,
  AlertCircle,
  TrendingUp,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type AltoBajo,
  type ParImpar,
  type Sorteo,
} from "@shared/lottery";
import { AltoBajoBadge, ParImparBadge } from "@/components/ClassificationBadge";
import { useDraws } from "@/hooks/useDraws";
import { drawToSorteo } from "@/lib/drawAdapter";
import { getLotteryLogo } from "@/lib/lotteryLogos";

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
  hora: string;
  numero: number;
  loteria: string;
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
  const rngNorm = normStr(ma.rango);
  const parNorm = normStr(ma.paridad);
  const cuadNorm = normStr(ma.cuadrante);

  const predictedAB: AltoBajo | null =
    extractAB(escNorm) ?? extractAB(rngNorm) ?? extractAB(cuadNorm);

  const predictedPI: ParImpar | null =
    extractPI(escNorm) ?? extractPI(parNorm) ?? extractPI(cuadNorm);

  if (predictedAB === null) return null;

  const rawEsc = ma.escenario_probable;
  const rawRng = ma.rango;
  const rawPar = ma.paridad;
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
    hora: s.hora ?? "",
    numero: s.numero,
    loteria: s.loteria,
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

export const Route = createFileRoute("/comparativa")({
  head: () => ({
    meta: [
      { title: "Comparativa Manual vs Real — Cuadrante" },
      { name: "description", content: "Validación cruzada entre predicciones manuales y resultados reales." },
    ],
  }),
  component: ComparativaPage,
});

// ─── Componente principal ─────────────────────────────────────────────────────

function ComparativaPage() {
  const { data: draws = [], isLoading } = useDraws({ limit: 5000 });
  const all = useMemo(() => draws.map(drawToSorteo), [draws]);

  const globalComp = useMemo(() => {
    const rows: CompRow[] = [];
    for (const s of all) {
      const row = buildCompRow(s);
      if (row) rows.push(row);
    }
    rows.sort((a, b) => b.fecha.localeCompare(a.fecha));
    const total = rows.length;
    const aciertos = rows.filter((r) => r.abMatch).length;
    const fallos = total - aciertos;
    const pct = total > 0 ? (aciertos / total) * 100 : 0;
    return { rows: rows.slice(0, 200), total, aciertos, fallos, pct, hasData: total > 0 };
  }, [all]);

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
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[28px] lg:text-[32px] font-bold tracking-tight text-foreground flex items-center gap-3">
          <div className="size-10 rounded-xl bg-emerald-100 border border-emerald-200 grid place-items-center shadow-sm">
            <TrendingUp className="size-5 text-emerald-600" />
          </div>
          Análisis Manual vs Resultado Real
        </h1>
        <p className="text-[15px] text-muted-foreground mt-2 max-w-2xl leading-relaxed">
          Validación cruzada global entre las predicciones del operador importadas vía Excel
          y los eventos resolutivos registrados por el sistema. Este es el núcleo de valor del producto.
        </p>
      </div>

      {globalComp.hasData ? (
        <div className="space-y-6 animate-fade-up">
          {/* Badge total */}
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-full px-4 py-2 w-fit">
            <BarChart3 className="size-4 text-emerald-600" />
            <span className="text-[12px] font-bold text-emerald-700 uppercase tracking-widest">
              {globalComp.total} draws evaluados
            </span>
          </div>

          {/* 4 Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 lg:gap-6">
            <CompStat
              label="Muestra Total"
              value={globalComp.total.toString()}
              hint="Draws evaluados"
            />
            <CompStat
              label="Aciertos"
              value={globalComp.aciertos.toString()}
              tone="success"
              hint="Rango convergente"
            />
            <CompStat
              label="Fallos"
              value={globalComp.fallos.toString()}
              tone="error"
              hint="Rango divergente"
            />
            <CompStat
              label="Efectividad"
              value={`${globalComp.pct.toFixed(1)}%`}
              tone={globalComp.pct >= 60 ? "success" : globalComp.pct >= 40 ? "warning" : "error"}
              hint="Porcentaje global"
            />
          </div>

          {/* Effectiveness Bar */}
          <div className="bg-white rounded-[24px] lg:rounded-[32px] border border-border shadow-sm p-5 sm:p-8 relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-5 gap-3 relative z-10">
              <div>
                <span className="text-[14px] font-bold uppercase tracking-[0.1em] text-foreground">
                  Rendimiento Global del Operador
                </span>
                <p className="mt-1.5 text-[13px] text-muted-foreground leading-relaxed max-w-2xl font-medium">
                  Porcentaje de acierto entre la predicción manual (Escenario Probable) y el resultado real (Alto/Bajo).
                </p>
              </div>
              <div className="flex items-baseline gap-2 shrink-0 bg-muted/50 px-4 py-2 rounded-xl border border-border">
                <span className="text-[11px] font-bold text-muted-foreground uppercase">Score</span>
                <span className="text-2xl font-extrabold tabular-nums text-foreground">
                  {globalComp.aciertos}
                </span>
                <span className="text-[13px] text-muted-foreground font-bold">
                  / {globalComp.total}
                </span>
              </div>
            </div>
            <div className="h-4 rounded-full bg-muted border border-border overflow-hidden relative z-10">
              <div
                className={`h-full relative transition-all duration-1000 rounded-full ${
                  globalComp.pct >= 60
                    ? "bg-emerald-500"
                    : globalComp.pct >= 40
                      ? "bg-orange-500"
                      : "bg-red-500"
                }`}
                style={{ width: `${globalComp.pct}%` }}
              />
            </div>
          </div>

          {/* Comparison Table / Mobile Cards */}
          <div className="bg-white rounded-[24px] lg:rounded-[32px] border border-border shadow-sm overflow-hidden">
            <div className="px-5 lg:px-8 py-5 lg:py-6 border-b border-border bg-muted/10 flex items-center justify-between">
              <div>
                <h4 className="text-[15px] font-bold uppercase tracking-[0.1em] text-foreground">
                  Registro de Comparaciones
                </h4>
                <p className="text-[12px] text-muted-foreground mt-1 font-bold">
                  {globalComp.rows.length < globalComp.total
                    ? `[ LIMIT ${globalComp.rows.length} / ${globalComp.total} ] DESC`
                    : `[ FULL DUMP ${globalComp.total} ] DESC`}
                </p>
              </div>
            </div>

            <div className="w-full">
              {/* Mobile Card List */}
              <div className="lg:hidden flex flex-col divide-y divide-border bg-white w-full">
                {globalComp.rows.map((row) => (
                  <div key={row.id} className="p-5 flex flex-col gap-4 bg-white hover:bg-muted/20 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[12px] font-mono font-bold text-muted-foreground uppercase tracking-widest">{row.fecha} · {row.hora}</span>
                        <div className="flex items-center gap-2 mt-1">
                          {getLotteryLogo(row.loteria) && (
                            <img 
                              src={getLotteryLogo(row.loteria)} 
                              alt={row.loteria} 
                              className="size-5 object-contain opacity-90"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          )}
                          <span className="font-bold text-foreground text-[14px]">{row.loteria}</span>
                        </div>
                        <span className="text-[13px] text-muted-foreground mt-0.5" title={row.escenarioLabel}>
                          {row.escenarioLabel.length > 30 ? row.escenarioLabel.substring(0, 30) + '...' : row.escenarioLabel}
                        </span>
                      </div>
                      <div className="size-12 rounded-xl bg-muted/40 border border-border flex items-center justify-center shadow-sm shrink-0">
                        <span className="font-mono text-[22px] font-extrabold text-foreground">
                          {row.numero.toString().padStart(2, "0")}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between bg-muted/10 rounded-xl p-3 border border-border/50">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Manual</span>
                        <div className="flex gap-2 flex-wrap">
                          {row.predictedAB && (
                            <span className="inline-block rounded-md border border-border bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest tabular-nums text-foreground shadow-sm">
                              {row.predictedAB}
                            </span>
                          )}
                          {row.predictedPI && (
                            <span className="inline-block rounded-md border border-border bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest tabular-nums text-foreground shadow-sm">
                              {row.predictedPI}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5 border-l border-border/50 pl-4 items-end">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Real</span>
                        <div className="flex gap-2 flex-wrap justify-end">
                          <div className="scale-90 origin-right"><AltoBajoBadge value={row.actualAB} soft={false} /></div>
                          <div className="scale-90 origin-right"><ParImparBadge value={row.actualPI} soft={false} /></div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-end">
                      <EvaluacionBadge abMatch={row.abMatch} piMatch={row.piMatch} hasPi={row.predictedPI !== null} />
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
                      <th className="px-6 py-4 whitespace-nowrap">Hora</th>
                      <th className="px-6 py-4 whitespace-nowrap">Matriz</th>
                      <th className="px-6 py-4 whitespace-nowrap">Número</th>
                      <th className="px-6 py-4 whitespace-nowrap">Escenario Manual</th>
                      <th className="px-6 py-4 whitespace-nowrap">Resultado Real</th>
                      <th className="px-6 py-4 whitespace-nowrap">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {globalComp.rows.map((row) => (
                      <tr key={row.id} className="group hover:bg-muted/20 transition-colors">
                        <td className="px-6 py-4 tabular-nums text-[13px] font-mono font-medium text-muted-foreground whitespace-nowrap">
                          {row.fecha}
                        </td>
                        <td className="px-6 py-4 text-[13px] font-bold text-foreground whitespace-nowrap">
                          {row.hora}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {getLotteryLogo(row.loteria) && (
                              <img 
                                src={getLotteryLogo(row.loteria)} 
                                alt={row.loteria} 
                                className="size-5 object-contain opacity-90"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                            )}
                            <span className="text-[12px] font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">{row.loteria}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-mono text-[16px] font-extrabold text-foreground tabular-nums">
                          {row.numero.toString().padStart(2, "0")}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-2">
                            <span className="text-[13px] font-bold text-muted-foreground truncate max-w-[200px]" title={row.escenarioLabel}>
                              {row.escenarioLabel}
                            </span>
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
                        <td className="px-6 py-4">
                          <div className="flex gap-2 flex-wrap">
                            <AltoBajoBadge value={row.actualAB} soft={false} />
                            <ParImparBadge value={row.actualPI} soft={false} />
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <EvaluacionBadge abMatch={row.abMatch} piMatch={row.piMatch} hasPi={row.predictedPI !== null} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Estado vacío */
        <div className="rounded-[24px] lg:rounded-[32px] border border-dashed border-border/70 bg-white p-8 lg:p-12 text-center relative overflow-hidden group">
          <div className="mx-auto flex size-16 items-center justify-center rounded-[20px] bg-muted border border-border mb-6 shadow-sm">
            <AlertCircle className="size-6 text-muted-foreground group-hover:text-primary transition-colors duration-500" />
          </div>
          <p className="text-[16px] font-bold text-foreground tracking-tight">
            Sin datos de análisis manual
          </p>
          <p className="text-[14px] text-muted-foreground mt-3 max-w-xl mx-auto leading-relaxed">
            El sistema de comparación requiere que importes un Excel con las columnas de análisis manual
            (Escenario Probable, Rango, Paridad). Navega a <strong>Ingestión de Datos</strong> para cargar tu archivo.
          </p>
        </div>
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
    <div
      className={cn(
        "relative rounded-[20px] lg:rounded-[24px] p-5 lg:p-6 shadow-sm overflow-hidden border",
        isSuccess
          ? "bg-emerald-50 border-emerald-100"
          : isError
            ? "bg-red-50 border-red-100"
            : isWarning
              ? "bg-orange-50 border-orange-100"
              : "bg-white border-border",
      )}
    >
      <div
        className={cn(
          "text-[11px] font-bold uppercase tracking-[0.1em] mb-3 relative z-10",
          isSuccess
            ? "text-emerald-800"
            : isError
              ? "text-red-800"
              : isWarning
                ? "text-orange-800"
                : "text-muted-foreground",
        )}
      >
        {label}
      </div>
      <div
        className={`text-3xl lg:text-4xl font-extrabold tabular-nums relative z-10 ${
          isSuccess
            ? "text-emerald-600"
            : isError
              ? "text-red-600"
              : isWarning
                ? "text-orange-600"
                : "text-foreground"
        }`}
      >
        {value}
      </div>
      {hint && (
        <div
          className={cn(
            "mt-3 text-[10px] font-bold tracking-widest uppercase relative z-10",
            isSuccess
              ? "text-emerald-700/60"
              : isError
                ? "text-red-700/60"
                : isWarning
                  ? "text-orange-700/60"
                  : "text-muted-foreground/60",
          )}
        >
          {hint}
        </div>
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
