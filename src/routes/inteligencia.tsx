import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Brain,
  Sparkles,
  Moon,
  Sun,
  Eye,
  Pickaxe,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Shield,
  ShieldAlert,
  ShieldX,
  Skull,
  CalendarClock,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────
interface Pattern {
  id: string;
  nombre: string;
  descripcion: string | null;
  estado: string;
  efectividad: number;
  ocurrencias: number;
  aciertos: number;
  source: string;
  hora: string | null;
  efectividad_mensual: Record<string, { ocurrencias: number; aciertos: number; efectividad: number }> | null;
  created_at: string;
}

interface LearningLog {
  ranAt: string;
  mes?: string;
  quarter?: string;
  promoted: number;
  hibernated: number;
  awoken: number;
  expired?: number;
  revived?: number;
  offSeason?: number;
  inSeason?: number;
  evaluated: number;
  log: Array<{ nombre: string; from: string; to: string; efectividad_mes?: number; source?: string; reason?: string; decay_trend?: string }>;
}

interface MiningLog {
  ranAt: string;
  drawsAnalyzed: number;
  totalDiscoveries: number;
  newInserted: number;
  elapsedMs: number;
  discoveries: Array<{ nombre: string; efectividad: number; ocurrencias: number }>;
}

interface AuditLog {
  ranAt: string;
  drawsAnalyzed: number;
  rulesEvaluated: number;
  vetoed: number;
  corrected: number;
  validated: number;
  elapsedMs: number;
  log: Array<{ nombre: string; action: string; declared_ef: number; real_ef: number; total_evaluated: number; reason: string }>;
}

// ─── Data hooks ──────────────────────────────────────────────────
function usePatterns() {
  return useQuery({
    queryKey: ["ai-patterns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patterns")
        .select("*")
        .order("efectividad", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Pattern[];
    },
    refetchInterval: 30_000,
  });
}

function useAILogs() {
  return useQuery({
    queryKey: ["ai-logs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("settings")
        .select("clave, valor")
        .in("clave", ["pattern_learning_last_run", "pattern_mining_last_run", "rule_audit_last_run"]);

      const learning = (data ?? []).find((r: any) => r.clave === "pattern_learning_last_run");
      const mining = (data ?? []).find((r: any) => r.clave === "pattern_mining_last_run");
      const audit = (data ?? []).find((r: any) => r.clave === "rule_audit_last_run");

      return {
        learning: learning?.valor as unknown as LearningLog | null,
        mining: mining?.valor as unknown as MiningLog | null,
        audit: audit?.valor as unknown as AuditLog | null,
      };
    },
    refetchInterval: 60_000,
  });
}

// ─── Helpers ─────────────────────────────────────────────────────
const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function estadoBadge(estado: string) {
  const map: Record<string, { bg: string; text: string; icon: typeof Sun }> = {
    activo: { bg: "bg-emerald-100", text: "text-emerald-700", icon: Sun },
    observacion: { bg: "bg-amber-100", text: "text-amber-700", icon: Eye },
    hibernando: { bg: "bg-blue-100", text: "text-blue-700", icon: Moon },
    descartado: { bg: "bg-rose-100", text: "text-rose-700", icon: AlertTriangle },
    caducado: { bg: "bg-slate-100", text: "text-slate-700", icon: Skull },
  };
  const style = map[estado] ?? map.observacion;
  const Icon = style.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-widest", style.bg, style.text)}>
      <Icon className="size-3" />
      {estado}
    </span>
  );
}

function sourceBadge(source: string) {
  if (source === "mined") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-purple-100 text-purple-700 px-2 py-0.5 text-[11px] font-bold uppercase tracking-widest">
        <Pickaxe className="size-3" />
        Auto-Descubierto
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-muted text-muted-foreground px-2 py-0.5 text-[11px] font-bold uppercase tracking-widest">
      Manual
    </span>
  );
}

// ─── Route ───────────────────────────────────────────────────────
export const Route = createFileRoute("/inteligencia")({
  head: () => ({
    meta: [
      { title: "Inteligencia IA — Ana Liza" },
      { name: "description", content: "Panel de control del cerebro de Ana Liza" },
    ],
  }),
  component: InteligenciaPage,
});

function InteligenciaPage() {
  const { data: patterns, isLoading: loadingPatterns } = usePatterns();
  const { data: logs, isLoading: loadingLogs } = useAILogs();

  const activos = patterns?.filter((p) => p.estado === "activo") ?? [];
  const observacion = patterns?.filter((p) => p.estado === "observacion") ?? [];
  const hibernando = patterns?.filter((p) => p.estado === "hibernando") ?? [];
  const caducados = patterns?.filter((p) => p.estado === "caducado") ?? [];
  const mined = patterns?.filter((p) => p.source === "mined") ?? [];
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, "0");

  if (loadingPatterns || loadingLogs) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="size-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pt-2 pb-20">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[28px] lg:text-[32px] font-bold tracking-tight text-foreground flex items-center gap-3">
          <div className="size-10 rounded-xl bg-purple-100 border border-purple-200 grid place-items-center shadow-sm">
            <Brain className="size-5 text-purple-600" />
          </div>
          Inteligencia IA
        </h1>
        <p className="text-[15px] text-muted-foreground mt-2 max-w-2xl leading-relaxed">
          Observa el cerebro de Ana Liza en tiempo real: sus patrones activos, descubrimientos autónomos,
          y decisiones estacionales.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <SummaryCard icon={Sun} label="Activos" value={activos.length} color="emerald" />
        <SummaryCard icon={Eye} label="En Observación" value={observacion.length} color="amber" />
        <SummaryCard icon={Moon} label="Hibernando" value={hibernando.length} color="blue" />
        <SummaryCard icon={Skull} label="Caducados" value={caducados.length} color="slate" />
        <SummaryCard icon={Pickaxe} label="Auto-Descubiertos" value={mined.length} color="purple" />
        <SummaryCard icon={ShieldAlert} label="Vetadas por Robot" value={logs?.audit?.vetoed ?? 0} color="rose" />
      </div>

      {/* Robot Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Learning Robot */}
        <div className="rounded-[24px] bg-white border border-border overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-border bg-muted/5 flex items-center gap-2">
            <Clock className="size-4 text-indigo-600" />
            <h3 className="text-[14px] font-bold uppercase tracking-widest text-foreground">
              Robot de Aprendizaje (2:00 AM)
            </h3>
          </div>
          <div className="p-5 space-y-3">
            {logs?.learning ? (
              <>
                <div className="grid grid-cols-2 gap-3 text-[13px]">
                  <div>
                    <span className="text-muted-foreground">Última ejecución:</span>
                    <p className="font-bold text-foreground">{new Date(logs.learning.ranAt).toLocaleString("es-DO")}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Mes evaluado:</span>
                    <p className="font-bold text-foreground">{logs.learning.mes ? MONTH_NAMES[parseInt(logs.learning.mes) - 1] : "—"}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <MiniStat label="Promovidos" value={logs.learning.promoted} color="emerald" />
                  <MiniStat label="Hibernados" value={logs.learning.hibernated} color="blue" />
                  <MiniStat label="Despertados" value={logs.learning.awoken} color="amber" />
                </div>
                {logs.learning.log && logs.learning.log.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border space-y-1">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Cambios recientes</p>
                    {logs.learning.log.slice(0, 5).map((entry, i) => (
                      <div key={i} className="flex items-center gap-2 text-[12px] py-1">
                        <span className="font-mono font-bold text-foreground">{entry.nombre}</span>
                        <span className="text-muted-foreground">→</span>
                        {estadoBadge(entry.to)}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-[13px] text-muted-foreground py-4 text-center">
                Aún no se ha ejecutado. La primera ejecución será esta madrugada a las 2:00 AM.
              </p>
            )}
          </div>
        </div>

        {/* Mining Robot */}
        <div className="rounded-[24px] bg-white border border-border overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-border bg-muted/5 flex items-center gap-2">
            <Pickaxe className="size-4 text-purple-600" />
            <h3 className="text-[14px] font-bold uppercase tracking-widest text-foreground">
              Robot de Minería (Domingos 3:00 AM)
            </h3>
          </div>
          <div className="p-5 space-y-3">
            {logs?.mining ? (
              <>
                <div className="grid grid-cols-2 gap-3 text-[13px]">
                  <div>
                    <span className="text-muted-foreground">Última ejecución:</span>
                    <p className="font-bold text-foreground">{new Date(logs.mining.ranAt).toLocaleString("es-DO")}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Tiempo de análisis:</span>
                    <p className="font-bold text-foreground">{(logs.mining.elapsedMs / 1000).toFixed(1)}s</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <MiniStat label="Sorteos analizados" value={logs.mining.drawsAnalyzed} color="gray" />
                  <MiniStat label="Hallazgos" value={logs.mining.totalDiscoveries} color="purple" />
                  <MiniStat label="Nuevos insertados" value={logs.mining.newInserted} color="emerald" />
                </div>
                {logs.mining.discoveries && logs.mining.discoveries.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border space-y-1">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Descubrimientos</p>
                    {logs.mining.discoveries.slice(0, 5).map((d, i) => (
                      <div key={i} className="flex items-center justify-between text-[12px] py-1">
                        <span className="font-mono font-bold text-foreground">{d.nombre}</span>
                        <span className={cn("font-bold", d.efectividad >= 60 ? "text-emerald-600" : "text-rose-600")}>
                          {d.efectividad}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-[13px] text-muted-foreground py-4 text-center">
                Aún no se ha ejecutado. La primera ejecución será el próximo Domingo a las 3:00 AM.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Robot Audit Section */}
      <div className="rounded-[24px] bg-slate-950 border border-slate-800 overflow-hidden shadow-lg relative">
        <div className="absolute right-0 top-0 translate-x-1/4 -translate-y-1/4 size-40 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-2 relative z-10">
          <Shield className="size-4 text-red-400" />
          <h3 className="text-[14px] font-bold uppercase tracking-widest text-slate-200">
            🤖 Auditoría del Robot Jefe
          </h3>
        </div>
        <div className="p-5 space-y-4 relative z-10">
          {logs?.audit ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl bg-slate-900 border border-slate-800 p-3 text-center">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Reglas Evaluadas</div>
                  <div className="text-xl font-extrabold text-white tabular-nums">{logs.audit.rulesEvaluated}</div>
                </div>
                <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-center">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-red-400 mb-1 flex items-center justify-center gap-1"><ShieldX className="size-3" /> Vetadas</div>
                  <div className="text-xl font-extrabold text-red-400 tabular-nums">{logs.audit.vetoed}</div>
                </div>
                <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-center">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-amber-400 mb-1 flex items-center justify-center gap-1"><Wrench className="size-3" /> Corregidas</div>
                  <div className="text-xl font-extrabold text-amber-400 tabular-nums">{logs.audit.corrected}</div>
                </div>
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-center">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 mb-1 flex items-center justify-center gap-1"><CheckCircle2 className="size-3" /> Validadas</div>
                  <div className="text-xl font-extrabold text-emerald-400 tabular-nums">{logs.audit.validated}</div>
                </div>
              </div>

              <div className="text-[11px] text-slate-500">
                Última auditoría: {new Date(logs.audit.ranAt).toLocaleString("es-DO")} · {logs.audit.drawsAnalyzed.toLocaleString()} sorteos analizados en {(logs.audit.elapsedMs / 1000).toFixed(1)}s
              </div>

              {logs.audit.log && logs.audit.log.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Decisiones del Robot</p>
                  {logs.audit.log.map((entry, i) => (
                    <div key={i} className={cn(
                      "rounded-xl p-3 text-[12px] border",
                      entry.action === "vetoed" ? "bg-red-500/5 border-red-500/20" :
                      entry.action === "corrected" ? "bg-amber-500/5 border-amber-500/20" :
                      "bg-emerald-500/5 border-emerald-500/20",
                    )}>
                      <div className="flex items-center gap-2 mb-1">
                        {entry.action === "vetoed" && <ShieldX className="size-4 text-red-400" />}
                        {entry.action === "corrected" && <Wrench className="size-4 text-amber-400" />}
                        {entry.action === "validated" && <CheckCircle2 className="size-4 text-emerald-400" />}
                        <span className="font-bold text-white">{entry.nombre}</span>
                        <span className={cn(
                          "ml-auto px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest",
                          entry.action === "vetoed" ? "bg-red-500/20 text-red-400" :
                          entry.action === "corrected" ? "bg-amber-500/20 text-amber-400" :
                          "bg-emerald-500/20 text-emerald-400",
                        )}>
                          {entry.action === "vetoed" ? "VETADA" : entry.action === "corrected" ? "CORREGIDA" : "OK"}
                        </span>
                      </div>
                      <p className="text-slate-400">{entry.reason}</p>
                      {entry.declared_ef !== entry.real_ef && (
                        <div className="flex items-center gap-2 mt-1 text-[11px]">
                          <span className="text-slate-500">Declarada: <span className="text-white font-bold">{entry.declared_ef}%</span></span>
                          <span className="text-slate-600">→</span>
                          <span className="text-slate-500">Real: <span className={cn("font-bold", entry.real_ef >= 50 ? "text-emerald-400" : "text-red-400")}>{entry.real_ef}%</span></span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-[13px] text-slate-500 py-4 text-center">
              El Robot Jefe aún no ha ejecutado su primera auditoría. Se ejecutará el próximo Lunes a las 4:00 AM.
            </p>
          )}
        </div>
      </div>

      {/* Time-Decay Alerts */}
      {logs?.learning?.log && logs.learning.log.some((e: any) => e.decay_trend === "dead" || e.decay_trend === "declining" || e.reason === "algorithm_shift" || e.reason === "off_season") && (
        <div className="rounded-[24px] bg-white border border-border overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-border bg-muted/5 flex items-center gap-2">
            <CalendarClock className="size-4 text-amber-600" />
            <h3 className="text-[14px] font-bold uppercase tracking-widest text-foreground">
              Alertas de Cambio de Algoritmo
            </h3>
          </div>
          <div className="p-5 space-y-2">
            {logs.learning.log
              .filter((e: any) => e.reason === "algorithm_shift" || e.reason === "off_season" || e.decay_trend === "declining")
              .map((entry: any, i: number) => (
                <div key={i} className={cn(
                  "rounded-xl p-3 border flex items-center gap-3",
                  entry.reason === "algorithm_shift" ? "bg-rose-50 border-rose-200" : "bg-amber-50 border-amber-200",
                )}>
                  {entry.reason === "algorithm_shift" ? (
                    <Skull className="size-5 text-rose-600 shrink-0" />
                  ) : (
                    <CalendarClock className="size-5 text-amber-600 shrink-0" />
                  )}
                  <div>
                    <span className="text-[13px] font-bold text-foreground">{entry.nombre}</span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {entry.reason === "algorithm_shift"
                        ? `Caducado: efectividad en declive sostenido por ${entry.quarters?.length ?? "varios"} trimestres.`
                        : entry.reason === "off_season"
                          ? "Fuera de temporada activa. Se reactivará cuando entre en su ventana de meses."
                          : `Tendencia en declive (${entry.decay_trend}). Bajo vigilancia del robot.`
                      }
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Patterns Table */}
      <div className="rounded-[24px] bg-white border border-border overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-border bg-muted/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-indigo-600" />
            <h3 className="text-[14px] font-bold uppercase tracking-widest text-foreground">
              Todos los Patrones
            </h3>
          </div>
          <span className="text-[11px] font-bold text-muted-foreground tracking-widest uppercase">
            {patterns?.length ?? 0} patrones
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-muted/10 text-[11px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border">
              <tr>
                <th className="px-5 py-3">Nombre</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3">Origen</th>
                <th className="px-5 py-3 text-center">Efectividad</th>
                <th className="px-5 py-3 text-center">Mes Actual</th>
                <th className="px-5 py-3 text-center">Ocurrencias</th>
                <th className="px-5 py-3">Hora</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {(patterns ?? []).map((p) => {
                const mesData = p.efectividad_mensual?.[currentMonth];
                return (
                  <tr key={p.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-5 py-3">
                      <div>
                        <span className="text-[13px] font-bold text-foreground">{p.nombre}</span>
                        {p.descripcion && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 max-w-xs truncate">
                            {p.descripcion}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">{estadoBadge(p.estado)}</td>
                    <td className="px-5 py-3">{sourceBadge(p.source)}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={cn(
                        "text-[14px] font-extrabold tabular-nums",
                        p.efectividad >= 60 ? "text-emerald-600" : p.efectividad >= 40 ? "text-amber-600" : "text-rose-600",
                      )}>
                        {p.efectividad}%
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      {mesData ? (
                        <span className={cn(
                          "text-[13px] font-bold tabular-nums",
                          mesData.efectividad >= 60 ? "text-emerald-600" : mesData.efectividad >= 40 ? "text-amber-600" : "text-rose-600",
                        )}>
                          {mesData.efectividad}% <span className="text-[10px] text-muted-foreground">({mesData.ocurrencias})</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">Sin datos</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-center text-[13px] font-semibold tabular-nums text-foreground">
                      {p.ocurrencias}
                    </td>
                    <td className="px-5 py-3 text-[13px] font-mono font-bold text-foreground">
                      {p.hora ?? "Global"}
                    </td>
                  </tr>
                );
              })}
              {(!patterns || patterns.length === 0) && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[13px] text-muted-foreground">
                    No hay patrones registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Seasonal Grid */}
      {mined.length > 0 && (
        <div className="rounded-[24px] bg-white border border-border overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-border bg-muted/5 flex items-center gap-2">
            <TrendingUp className="size-4 text-indigo-600" />
            <h3 className="text-[14px] font-bold uppercase tracking-widest text-foreground">
              Mapa Estacional (Auto-Descubiertos)
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-muted/10 text-[11px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border">
                <tr>
                  <th className="px-4 py-3 sticky left-0 bg-muted/10">Patrón</th>
                  {MONTH_NAMES.map((m, i) => (
                    <th
                      key={m}
                      className={cn(
                        "px-3 py-3 text-center",
                        String(i + 1).padStart(2, "0") === currentMonth && "bg-indigo-50 text-indigo-700",
                      )}
                    >
                      {m}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {mined.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3 text-[12px] font-bold text-foreground sticky left-0 bg-white whitespace-nowrap">
                      {p.nombre}
                    </td>
                    {MONTH_NAMES.map((_, i) => {
                      const mesKey = String(i + 1).padStart(2, "0");
                      const d = p.efectividad_mensual?.[mesKey];
                      const isCurrent = mesKey === currentMonth;
                      return (
                        <td
                          key={mesKey}
                          className={cn(
                            "px-3 py-3 text-center text-[12px] font-bold tabular-nums",
                            isCurrent && "bg-indigo-50/50",
                          )}
                        >
                          {d ? (
                            <span className={cn(
                              d.efectividad >= 60 ? "text-emerald-600" : d.efectividad >= 40 ? "text-amber-600" : "text-rose-600",
                            )}>
                              {d.efectividad}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground/30">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────
function SummaryCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Sun;
  label: string;
  value: number;
  color: string;
}) {
  const colors: Record<string, string> = {
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    purple: "bg-purple-50 border-purple-200 text-purple-700",
    slate: "bg-slate-50 border-slate-200 text-slate-700",
    rose: "bg-rose-50 border-rose-200 text-rose-700",
  };
  const iconColors: Record<string, string> = {
    emerald: "text-emerald-600",
    amber: "text-amber-600",
    blue: "text-blue-600",
    purple: "text-purple-600",
    slate: "text-slate-600",
    rose: "text-rose-600",
  };
  return (
    <div className={cn("rounded-[20px] border p-5 shadow-sm", colors[color])}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn("size-4", iconColors[color])} />
        <span className="text-[11px] font-bold uppercase tracking-widest opacity-80">{label}</span>
      </div>
      <div className="text-[32px] font-black tabular-nums">{value}</div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    emerald: "text-emerald-600",
    blue: "text-blue-600",
    amber: "text-amber-600",
    purple: "text-purple-600",
    gray: "text-foreground",
  };
  return (
    <div className="rounded-xl bg-muted/20 border border-border px-3 py-2 text-center">
      <div className={cn("text-[18px] font-black tabular-nums", colorMap[color])}>{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">
        {label}
      </div>
    </div>
  );
}
