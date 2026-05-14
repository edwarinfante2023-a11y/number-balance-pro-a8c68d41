import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  ArrowUpRight,
  Activity,
  Sparkles,
  Flame,
  Snowflake,
  AlertTriangle,
  TrendingUp,
  Clock as ClockIcon,
  Loader2,
  Database,
  Zap,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { StatCard } from "@/components/StatCard";
import { BalanceBar } from "@/components/BalanceBar";
import { AltoBajoBadge, ParImparBadge, SubcuadranteBadge } from "@/components/ClassificationBadge";
import { formatDateInTimeZone } from "@/lib/timezone";
import {
  computeBalance,
  computeRachas,
  computeFrecuencias,
  computeEscenarioProbable,
  subcuadranteLabel,
  type Sorteo,
} from "@shared/lottery";
import { useDraws } from "@/hooks/useDraws";
import { drawToSorteo } from "@/lib/drawAdapter";
import { cn } from "@/lib/utils";
import { getLotteryLogo } from "@/lib/lotteryLogos";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [{ title: "Dashboard — Cuadrante" }],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data: draws = [], isLoading } = useDraws({ limit: 1000 });
  const sorteos = useMemo(() => draws.map(drawToSorteo), [draws]);

  if (isLoading) {
    return (
      <div className="grid place-items-center py-32">
        <div className="flex flex-col items-center gap-4">
          <div className="size-16 rounded-[24px] surface-elevated grid place-items-center shadow-md">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
          <span className="text-[13px] font-bold text-muted-foreground mr-1">Booting Analytics Engine...</span>
        </div>
      </div>
    );
  }

  if (sorteos.length === 0) {
    return <EmptyState />;
  }

  return <DashboardContent sorteos={sorteos} />;
}

function EmptyState() {
  return (
    <div className="pt-2 relative z-10">
      <div className="mb-8">
        <h1 className="text-[32px] font-black tracking-tighter text-foreground">SYSTEM DASHBOARD</h1>
        <p className="text-[15px] text-muted-foreground">
          Analizador predictivo de matrices numéricas.
        </p>
      </div>

      <div className="surface-elevated rounded-[32px] p-16 text-center max-w-2xl mx-auto mt-12 relative overflow-hidden border-black/[0.04]">
        <div className="mx-auto flex size-20 items-center justify-center rounded-[24px] bg-primary/10 border border-primary/20 mb-6">
          <Database className="size-8 text-primary" />
        </div>
        <h3 className="text-2xl font-bold tracking-tight text-foreground mb-3">Workspace Vacío</h3>
        <p className="text-[15px] text-muted-foreground leading-relaxed max-w-md mx-auto mb-10">
          Inyecta datos históricos o inicia capturas manuales para que el motor algorítmico evalúe el balance.
        </p>
        <div className="flex justify-center gap-4">
          <Link
            to="/importar"
            className="inline-flex items-center justify-center gap-2 h-14 px-8 rounded-full bg-primary text-primary-foreground text-[15px] font-bold tracking-wide shadow-[0_8px_20px_-4px_var(--color-primary)] hover:shadow-[0_12px_24px_-4px_var(--color-primary)] transition-all transform hover:-translate-y-1"
          >
            Importar Excel
          </Link>
          <Link
            to="/captura"
            className="inline-flex items-center justify-center gap-2 h-14 px-8 rounded-full bg-black/5 border border-black/[0.04] text-foreground text-[15px] font-bold hover:bg-black/10 transition-all hover:-translate-y-0.5"
          >
            Captura manual
          </Link>
        </div>
      </div>
    </div>
  );
}

function DashboardContent({ sorteos }: { sorteos: Sorteo[] }) {
  const ordered = useMemo(
    () => [...sorteos].sort((a, b) => `${b.fecha} ${b.hora}`.localeCompare(`${a.fecha} ${a.hora}`)),
    [sorteos],
  );
  
  const ultimo = ordered[0];
  
  // Forzamos "today" a ser el día actual en la vida real, no de la DB.
  const today = useMemo(() => formatDateInTimeZone(), []);

  const todaySorteos = useMemo(() => sorteos.filter((s) => s.fecha === today), [sorteos, today]);
  const balance = useMemo(() => computeBalance(sorteos.slice(-20)), [sorteos]);
  const rachas = useMemo(() => computeRachas(sorteos), [sorteos]);
  const escenario = useMemo(() => computeEscenarioProbable(sorteos), [sorteos]);

  const frecuencias = useMemo(() => computeFrecuencias(sorteos), [sorteos]);
  const calientes = useMemo(
    () =>
      [...frecuencias]
        .filter((f) => f.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 6),
    [frecuencias],
  );
  const frios = useMemo(
    () => [...frecuencias].sort((a, b) => a.count - b.count).slice(0, 6),
    [frecuencias],
  );

  const ruedaDia = useMemo(
    () => [...todaySorteos].sort((a, b) => a.hora.localeCompare(b.hora)),
    [todaySorteos],
  );

  return (
    <div className="space-y-6 pt-2 relative z-10">
      {/* Header Match Donezo */}
      <div className="mb-8">
        <h1 className="text-[32px] font-black tracking-tighter text-foreground uppercase">ANALYTICS DASHBOARD</h1>
        <p className="text-[15px] text-muted-foreground mt-1">
          Motor algorítmico de clasificación, balances estocásticos y escenarios.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* HERO GREEN CARD - Escenario Probable (Replaces Top Left Dark Card) */}
        <div className="col-span-1 lg:col-span-5 relative group transform transition-all duration-300 hover:-translate-y-1 stagger-1 animate-fade-up">
          <div className="surface-hero-green h-full rounded-[24px] lg:rounded-[32px] p-6 lg:p-8 overflow-hidden flex flex-col justify-between shadow-[0_12px_30px_oklch(0.42_0.09_155/0.25)] border-none">
            {/* Decoration Circles */}
            <div className="absolute -top-20 -right-20 size-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 size-40 bg-white/5 rounded-full blur-xl pointer-events-none" />

            <div className="relative z-10 flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <div className="flex flex-col">
                  <span className="text-[15px] font-medium text-white/90">Escenario Probable</span>
                  <span className="text-[12px] font-semibold text-white/60 uppercase tracking-widest mt-1">
                    MOTOR DE PREDICCIÓN
                  </span>
                </div>
                <div className="size-10 rounded-full bg-white/20 backdrop-blur-md grid place-items-center shadow-inner border border-white/20 group-hover:bg-white/30 transition-colors cursor-pointer">
                  <ArrowUpRight className="size-5 text-white" />
                </div>
              </div>

              {/* Main value */}
              <div className="flex flex-col gap-1 mb-6 mt-auto">
                <div className="flex flex-col gap-y-3">
                  <span className="text-[56px] font-extrabold tracking-tighter text-white leading-none drop-shadow-sm">
                    {escenario.escenario}
                  </span>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="bg-white px-3 py-1.5 rounded-[8px] shadow-sm flex items-center gap-1.5 w-max">
                      <div className="size-2 rounded-full bg-primary" />
                      <span className="text-[13px] font-bold text-primary tabular-nums">
                        Confianza {escenario.porcentaje}%
                      </span>
                    </div>
                    <span className="text-[12px] text-white/80 font-medium ml-2">Tendencia alta.</span>
                  </div>
                </div>
              </div>

              {/* Reasons */}
              <div className="mt-4 pt-4 border-t border-white/20 space-y-2">
                {escenario.razones.slice(0, 2).map((r, i) => (
                  <div
                    key={i}
                    className="flex gap-2 text-[12px] font-medium text-white/90 items-center"
                  >
                    <div className="size-1 rounded-full bg-white/60" />
                    <span className="truncate">{r}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* TOP STATS CLUSTER (Remaining 7 columns) */}
        <div className="col-span-1 lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="stagger-2 animate-fade-up">
            <StatCard
              label="Última lectura"
              value={ultimo?.numero.toString().padStart(2, "0") ?? "—"}
              hint={ultimo ? `Varianza actual` : "Sin datos"}
              accent={ultimo?.altoBajo === "ALTO" ? "alto" : "bajo"}
              icon={<Activity className="size-5 text-foreground" />}
            />
          </div>
          <div className="stagger-3 animate-fade-up">
            <StatCard
              label="Vector dominante"
              value={rachas.length > 0 ? rachas[0].valor : "—"}
              hint={rachas.length > 0 ? `Se repitió ${rachas[0].longitud} veces` : "Vector neutro"}
              accent={
                rachas[0]?.valor === "ALTO"
                  ? "alto"
                  : rachas[0]?.valor === "BAJO"
                    ? "bajo"
                    : rachas[0]?.valor === "PAR"
                      ? "par"
                      : "impar"
              }
              icon={<TrendingUp className="size-5 text-foreground" />}
            />
          </div>
          <div className="stagger-4 animate-fade-up">
            <StatCard
              label="Volumen total"
              value={sorteos.length.toLocaleString("es")}
              hint={`${todaySorteos.length} deltas hoy`}
              icon={<ClockIcon className="size-5 text-foreground" />}
            />
          </div>

          {/* Second row of stats inside the cluster */}
          <div className="col-span-1 sm:col-span-3 surface-elevated rounded-[24px] p-6 lg:p-8 flex flex-col justify-between stagger-5 animate-fade-up border-black/[0.04]">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-[16px] font-bold text-foreground">Balance Analítico</h2>
                <p className="text-[13px] text-muted-foreground mt-1">
                  Oscilación de cuadrantes (Últimos {balance.total} impactos)
                </p>
              </div>
            </div>
            <div className="space-y-6">
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
          </div>
        </div>
      </div>

      {/* ─── Línea del día + Sidebar: Rachas + Alertas ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* Stream */}
        <div className="col-span-1 lg:col-span-2 surface-elevated rounded-[24px] lg:rounded-[32px] p-6 lg:p-8 overflow-hidden stagger-5 animate-fade-up border-black/[0.04]">
          <div className="flex items-center justify-between mb-6 lg:mb-8">
            <div>
              <h2 className="text-[18px] font-bold text-foreground">Timeline en vivo</h2>
              <p className="text-[13px] text-muted-foreground mt-1 font-medium">{today}</p>
            </div>
            {ruedaDia.length > 0 && (
              <div className="flex items-center gap-2 bg-black/5 border border-black/[0.04] px-4 py-1.5 rounded-full">
                <span className="size-2 rounded-full bg-primary" />
                <span className="text-[11px] font-bold text-foreground uppercase tracking-wider">
                  {ruedaDia.length} Eventos
                </span>
              </div>
            )}
          </div>
          {ruedaDia.length === 0 ? (
            <div className="text-[14px] text-muted-foreground py-10 text-center bg-black/5 rounded-[20px] border border-dashed border-black/[0.04] flex flex-col items-center">
              <ClockIcon className="size-6 text-muted-foreground/30 mb-3" />
              Esperando señales...
            </div>
          ) : (
            <div className="space-y-2">
              {ruedaDia.map((s) => (
                <RowDia key={s.id} s={s} />
              ))}
            </div>
          )}
        </div>

        {/* Anomalies */}
        <div className="col-span-1 space-y-6">
          <div className="surface-elevated rounded-[24px] lg:rounded-[32px] p-6 lg:p-8 stagger-6 animate-fade-up h-full relative overflow-hidden border-black/[0.04]">
            <h2 className="text-[16px] font-bold text-foreground mb-6">Anomalías Activas</h2>
            {rachas.length === 0 ? (
              <div className="text-[13px] text-primary/80 text-center py-6 bg-primary/10 rounded-[16px] font-medium border border-primary/20">
                Entropía estable
              </div>
            ) : (
              <div className="space-y-3">
                {rachas.map((r, i) => {
                  const isPrimary = i === 0;
                  const color =
                    r.valor === "ALTO"
                      ? "bg-alto"
                      : r.valor === "BAJO"
                        ? "bg-bajo"
                        : r.valor === "PAR"
                          ? "bg-par"
                          : "bg-impar";
                  return (
                    <div
                      key={i}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-[16px] px-4 py-3 transition-all cursor-default border",
                        isPrimary
                          ? "bg-white border-black/[0.04] shadow-[0_4px_20px_-5px_rgba(0,0,0,0.05)]"
                          : "bg-black/[0.02] border-transparent",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`size-3 rounded-full ${color} shadow-sm`} />
                        <div>
                          <div className="text-[14px] font-bold text-foreground">{r.valor}</div>
                          <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide">
                            {r.tipo}
                          </div>
                        </div>
                      </div>
                      <div
                        className={cn(
                          "text-[12px] font-bold tabular-nums px-2.5 py-1 rounded-lg",
                          isPrimary
                            ? "bg-primary/10 text-primary border border-primary/20"
                            : "bg-black/5 text-muted-foreground border border-black/5",
                        )}
                      >
                        ×{r.longitud}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="absolute inset-x-0 bottom-0 p-8 pt-0 mt-8 bg-gradient-to-t from-white via-white to-transparent">
              <button className="w-full py-3 rounded-[12px] bg-foreground text-background text-[13px] font-bold shadow-md hover:bg-foreground/90 transition-colors">
                Purge Cache
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Sub-components ──────────────────────────────────────────────────────── */

function RowDia({ s }: { s: Sorteo }) {
  return (
    <div className="flex items-center gap-4 py-3 px-4 rounded-[16px] group border-b border-black/[0.04] mb-0 hover:bg-black/[0.02] transition-colors">
      <div className="flex items-center gap-3 w-32 shrink-0">
        <div className="size-6 rounded-md bg-black/5 flex items-center justify-center text-[10px] font-bold text-muted-foreground/50 group-hover:bg-primary/10 group-hover:text-primary transition-colors border border-black/[0.04]">
          {">"}
        </div>
        <span className="text-[13px] font-semibold text-foreground tabular-nums">{s.hora}</span>
      </div>

      <span className="font-mono text-xl font-bold tabular-nums w-12 shrink-0 text-foreground text-center">
        {s.numero.toString().padStart(2, "0")}
      </span>

      <div className="text-[13px] font-semibold text-muted-foreground uppercase tracking-widest hidden sm:flex items-center gap-2 w-32">
        {getLotteryLogo(s.loteria) && (
          <img 
            src={getLotteryLogo(s.loteria)} 
            alt={s.loteria} 
            className="size-5 object-contain opacity-80"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        )}
        <span className="truncate">{s.loteria}</span>
      </div>

      <div className="flex gap-2 flex-1 justify-end">
        <AltoBajoBadge value={s.altoBajo} />
        <ParImparBadge value={s.parImpar} />
        <div className="hidden sm:block">
          <SubcuadranteBadge value={s.subcuadrante} />
        </div>
      </div>
    </div>
  );
}

function AlertRow({ level, text }: { level: "warning" | "info"; text: string }) {
  const isWarning = level === "warning";
  return (
    <div
      className={`flex gap-3 items-center text-[13px] font-bold leading-relaxed rounded-xl p-3 border ${
        isWarning
          ? "bg-warning/10 border-warning/20 text-warning"
          : "bg-info/10 border-info/20 text-info"
      }`}
    >
      <span className={`size-2 shrink-0 rounded-full ${isWarning ? "bg-warning" : "bg-info"}`} />
      <span>{text}</span>
    </div>
  );
}
