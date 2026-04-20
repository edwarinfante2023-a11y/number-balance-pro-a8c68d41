import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Loader2,
  Trophy,
  Zap,
  Target,
  TrendingUp,
  Clock as ClockIcon,
  BarChart3,
  Flame,
  Shield,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { useDraws } from "@/hooks/useDraws";
import { useRules } from "@/hooks/useRules";
import { usePatterns } from "@/hooks/usePatterns";
import { drawToSorteo } from "@/lib/drawAdapter";
import {
  buildOpportunityRanking,
  type HourOpportunity,
  type OpportunityLevel,
} from "@/lib/opportunityEngine";

export const Route = createFileRoute("/oportunidades")({
  head: () => ({
    meta: [
      { title: "Oportunidades — Cuadrante" },
      {
        name: "description",
        content:
          "Ranking inteligente de oportunidades por hora basado en señales compuestas.",
      },
    ],
  }),
  component: OportunidadesPage,
});

// ─── Helpers visuales ────────────────────────────────────────────────────────

const NIVEL_STYLES: Record<
  OpportunityLevel,
  { bg: string; text: string; border: string; dot: string; label: string }
> = {
  ALTO: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
    label: "Alta",
  },
  MODERADO: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    dot: "bg-amber-500",
    label: "Moderada",
  },
  ESTABLE: {
    bg: "bg-slate-50",
    text: "text-slate-500",
    border: "border-slate-200",
    dot: "bg-slate-400",
    label: "Estable",
  },
};

function formatHora(hora: string): string {
  const [hh] = hora.split(":");
  const h = parseInt(hh, 10);
  if (h === 0) return "12 AM";
  if (h < 12) return `${h} AM`;
  if (h === 12) return "12 PM";
  return `${h - 12} PM`;
}

// ─── Route Component ─────────────────────────────────────────────────────────

function OportunidadesPage() {
  const { data: draws = [], isLoading: drawsLoading } = useDraws({ limit: 5000 });
  const { rules, isLoading: rulesLoading } = useRules();
  const { patterns, isLoading: patternsLoading } = usePatterns();

  const isLoading = drawsLoading || rulesLoading || patternsLoading;

  const sorteos = useMemo(() => draws.map(drawToSorteo), [draws]);

  const ranking = useMemo(() => {
    if (sorteos.length === 0) return null;
    return buildOpportunityRanking(sorteos, rules, patterns);
  }, [sorteos, rules, patterns]);

  if (isLoading) {
    return (
      <div className="grid place-items-center py-32">
        <div className="flex flex-col items-center gap-4">
          <div className="size-16 rounded-[24px] surface-elevated grid place-items-center shadow-md">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
          <span className="text-[13px] font-bold text-muted-foreground">
            Calculando oportunidades...
          </span>
        </div>
      </div>
    );
  }

  if (!ranking || ranking.ranking.length === 0) {
    return (
      <div className="pt-2">
        <PageHeader
          title="Oportunidades"
          description="Ranking inteligente por hora"
        />
        <div className="surface-elevated rounded-[24px] p-12 text-center mt-8">
          <div className="mx-auto size-16 rounded-[20px] bg-muted/50 grid place-items-center mb-4">
            <BarChart3 className="size-7 text-muted-foreground/40" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-2">
            Sin datos suficientes
          </h3>
          <p className="text-[14px] text-muted-foreground max-w-md mx-auto">
            Importa datos históricos o sincroniza resultados desde la web para
            que el motor pueda evaluar oportunidades.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-2 space-y-6">
      <PageHeader
        title="Oportunidades"
        description="Ranking inteligente por hora — evaluación consolidada de señales"
      />

      {/* ─── Summary bar ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 stagger-1 animate-fade-up">
        <MiniStat
          label="Horas evaluadas"
          value={ranking.totalHoras.toString()}
          icon={<ClockIcon className="size-4" />}
        />
        <MiniStat
          label="Score promedio"
          value={ranking.promedioScore.toString()}
          icon={<BarChart3 className="size-4" />}
        />
        <MiniStat
          label="Mejor hora"
          value={ranking.horaFavorita ? formatHora(ranking.horaFavorita.hora) : "—"}
          icon={<Trophy className="size-4" />}
          accent
        />
        <MiniStat
          label="Mejor score"
          value={ranking.horaFavorita?.score.toString() ?? "—"}
          icon={<Flame className="size-4" />}
          accent
        />
      </div>

      {/* ─── Top 3 Hero Cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 stagger-2 animate-fade-up">
        {ranking.top3.map((opp, idx) => (
          <TopCard key={opp.hora} opp={opp} rank={idx + 1} />
        ))}
      </div>

      {/* ─── Full Ranking Table ───────────────────────────────────────────── */}
      <div className="surface-elevated rounded-[24px] lg:rounded-[32px] p-6 lg:p-8 stagger-3 animate-fade-up">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-[18px] font-bold text-foreground">
              Ranking Completo
            </h2>
            <p className="text-[13px] text-muted-foreground mt-1 font-medium">
              Todas las horas evaluadas, ordenadas por score descendente
            </p>
          </div>
          <div className="flex items-center gap-2 bg-muted/50 border border-border px-4 py-1.5 rounded-full">
            <Sparkles className="size-3.5 text-primary" />
            <span className="text-[11px] font-bold text-foreground uppercase tracking-wider">
              {ranking.ranking.length} Slots
            </span>
          </div>
        </div>

        {/* Table header */}
        <div className="hidden sm:grid grid-cols-12 gap-3 px-4 py-2 text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
          <div className="col-span-1">#</div>
          <div className="col-span-2">Hora</div>
          <div className="col-span-2">Escenario</div>
          <div className="col-span-1 text-center">Conf.</div>
          <div className="col-span-1 text-center">Reglas</div>
          <div className="col-span-1 text-center">Patrones</div>
          <div className="col-span-2">Nivel</div>
          <div className="col-span-1 text-center">Score</div>
          <div className="col-span-1"></div>
        </div>

        {/* Rows */}
        <div className="space-y-1.5">
          {ranking.ranking.map((opp, idx) => (
            <RankingRow key={opp.hora} opp={opp} position={idx + 1} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function MiniStat({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "surface-elevated rounded-[16px] p-4 flex flex-col gap-2",
        accent && "ring-1 ring-primary/20",
      )}
    >
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "size-7 rounded-lg grid place-items-center",
            accent
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground",
          )}
        >
          {icon}
        </div>
        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
      </div>
      <span
        className={cn(
          "text-[22px] font-extrabold tabular-nums tracking-tight",
          accent ? "text-primary" : "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function TopCard({ opp, rank }: { opp: HourOpportunity; rank: number }) {
  const nivelStyle = NIVEL_STYLES[opp.nivel];

  const isFirst = rank === 1;

  return (
    <Link
      to="/analisis-hora"
      className={cn(
        "group relative rounded-[24px] p-6 transition-all duration-300 hover:-translate-y-1 cursor-pointer overflow-hidden border",
        isFirst
          ? "surface-hero-green text-white border-none shadow-[0_12px_30px_oklch(0.42_0.09_155/0.25)]"
          : "surface-elevated border-border hover:shadow-lg",
      )}
    >
      {/* Background decoration */}
      {isFirst && (
        <>
          <div className="absolute -top-16 -right-16 size-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-8 -left-8 size-32 bg-white/5 rounded-full blur-xl pointer-events-none" />
        </>
      )}

      <div className="relative z-10">
        {/* Rank + badge */}
        <div className="flex items-center justify-between mb-4">
          <div
            className={cn(
              "flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider",
              isFirst
                ? "bg-white/20 text-white backdrop-blur-sm"
                : "bg-muted text-muted-foreground",
            )}
          >
            {rank === 1 && <Trophy className="size-3.5" />}
            {rank === 2 && <Target className="size-3.5" />}
            {rank === 3 && <TrendingUp className="size-3.5" />}
            <span>#{rank}</span>
          </div>

          <div
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold",
              isFirst
                ? "bg-white/20 text-white"
                : `${nivelStyle.bg} ${nivelStyle.text}`,
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                isFirst ? "bg-white" : nivelStyle.dot,
              )}
            />
            {nivelStyle.label}
          </div>
        </div>

        {/* Hora */}
        <div
          className={cn(
            "text-[36px] font-extrabold tracking-tighter leading-none mb-1",
            isFirst ? "text-white" : "text-foreground",
          )}
        >
          {formatHora(opp.hora)}
        </div>
        <div
          className={cn(
            "text-[13px] font-semibold mb-4",
            isFirst ? "text-white/70" : "text-muted-foreground",
          )}
        >
          {opp.hora}
        </div>

        {/* Escenario + confianza */}
        <div className="flex items-center gap-3 mb-4">
          <div
            className={cn(
              "px-3 py-1.5 rounded-[8px] text-[12px] font-bold",
              isFirst
                ? "bg-white text-primary shadow-sm"
                : "bg-primary/10 text-primary",
            )}
          >
            {opp.escenario}
          </div>
          <span
            className={cn(
              "text-[12px] font-medium",
              isFirst ? "text-white/80" : "text-muted-foreground",
            )}
          >
            {opp.confianza}% confianza
          </span>
        </div>

        {/* Score bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <span
              className={cn(
                "text-[11px] font-bold uppercase tracking-wider",
                isFirst ? "text-white/60" : "text-muted-foreground",
              )}
            >
              Score
            </span>
            <span
              className={cn(
                "text-[18px] font-extrabold tabular-nums",
                isFirst ? "text-white" : "text-foreground",
              )}
            >
              {opp.score}
            </span>
          </div>
          <div
            className={cn(
              "h-2 rounded-full overflow-hidden",
              isFirst ? "bg-white/20" : "bg-muted",
            )}
          >
            <div
              className={cn(
                "h-full rounded-full transition-all duration-700 ease-out",
                isFirst ? "bg-white" : "bg-primary",
              )}
              style={{ width: `${opp.score}%` }}
            />
          </div>
        </div>

        {/* Compact stats */}
        <div className="flex items-center gap-4">
          {opp.reglasActivas > 0 && (
            <div
              className={cn(
                "flex items-center gap-1 text-[11px] font-bold",
                isFirst ? "text-white/80" : "text-foreground",
              )}
            >
              <Shield className="size-3" />
              {opp.reglasActivas} regla{opp.reglasActivas > 1 ? "s" : ""}
            </div>
          )}
          {opp.patronesActivos > 0 && (
            <div
              className={cn(
                "flex items-center gap-1 text-[11px] font-bold",
                isFirst ? "text-white/80" : "text-foreground",
              )}
            >
              <Zap className="size-3" />
              {opp.patronesActivos} patrón
              {opp.patronesActivos > 1 ? "es" : ""}
            </div>
          )}
          <div
            className={cn(
              "flex items-center gap-1 text-[11px] font-medium ml-auto",
              isFirst ? "text-white/60" : "text-muted-foreground",
            )}
          >
            {opp.totalDraws} registros
          </div>
        </div>

        {/* Resumen bullets */}
        <div
          className={cn(
            "mt-4 pt-3 space-y-1",
            isFirst
              ? "border-t border-white/20"
              : "border-t border-border",
          )}
        >
          {opp.resumen.slice(0, 3).map((r, i) => (
            <div
              key={i}
              className={cn(
                "flex items-start gap-2 text-[11px] font-medium",
                isFirst ? "text-white/80" : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "size-1 rounded-full mt-1.5 shrink-0",
                  isFirst ? "bg-white/60" : "bg-muted-foreground/40",
                )}
              />
              <span className="truncate">{r}</span>
            </div>
          ))}
        </div>
      </div>
    </Link>
  );
}

function RankingRow({
  opp,
  position,
}: {
  opp: HourOpportunity;
  position: number;
}) {
  const nivelStyle = NIVEL_STYLES[opp.nivel];
  const isTop3 = position <= 3;

  return (
    <Link
      to="/analisis-hora"
      className={cn(
        "grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-3 items-center px-4 py-3.5 rounded-[14px] border transition-all group cursor-pointer",
        isTop3
          ? "bg-primary/[0.03] border-primary/10 hover:bg-primary/[0.06]"
          : "bg-white border-border hover:bg-muted/30",
      )}
    >
      {/* Position */}
      <div className="hidden sm:flex col-span-1 items-center">
        <span
          className={cn(
            "text-[14px] font-extrabold tabular-nums",
            isTop3 ? "text-primary" : "text-muted-foreground",
          )}
        >
          {position}
        </span>
      </div>

      {/* Hora */}
      <div className="col-span-2 flex items-center gap-3">
        {/* Mobile: show position */}
        <span
          className={cn(
            "sm:hidden text-[12px] font-extrabold tabular-nums w-5",
            isTop3 ? "text-primary" : "text-muted-foreground",
          )}
        >
          {position}
        </span>
        <div
          className={cn(
            "size-9 rounded-[10px] grid place-items-center shrink-0",
            isTop3
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground",
          )}
        >
          <ClockIcon className="size-4" />
        </div>
        <div>
          <div className="text-[14px] font-bold text-foreground">
            {formatHora(opp.hora)}
          </div>
          <div className="text-[11px] text-muted-foreground font-medium tabular-nums">
            {opp.hora}
          </div>
        </div>
      </div>

      {/* Escenario */}
      <div className="hidden sm:block col-span-2">
        <span className="text-[12px] font-bold text-foreground bg-muted/50 px-2.5 py-1 rounded-md">
          {opp.escenario}
        </span>
      </div>

      {/* Confianza */}
      <div className="hidden sm:block col-span-1 text-center">
        <span className="text-[13px] font-bold text-foreground tabular-nums">
          {opp.confianza}%
        </span>
      </div>

      {/* Reglas */}
      <div className="hidden sm:block col-span-1 text-center">
        {opp.reglasActivas > 0 ? (
          <span className="inline-flex items-center gap-1 text-[12px] font-bold text-primary">
            <Shield className="size-3" />
            {opp.reglasActivas}
          </span>
        ) : (
          <span className="text-[12px] text-muted-foreground/40">—</span>
        )}
      </div>

      {/* Patrones */}
      <div className="hidden sm:block col-span-1 text-center">
        {opp.patronesActivos > 0 ? (
          <span className="inline-flex items-center gap-1 text-[12px] font-bold text-amber-600">
            <Zap className="size-3" />
            {opp.patronesActivos}
          </span>
        ) : (
          <span className="text-[12px] text-muted-foreground/40">—</span>
        )}
      </div>

      {/* Nivel */}
      <div className="hidden sm:flex col-span-2 items-center">
        <div
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border",
            nivelStyle.bg,
            nivelStyle.text,
            nivelStyle.border,
          )}
        >
          <span className={cn("size-1.5 rounded-full", nivelStyle.dot)} />
          {nivelStyle.label}
        </div>
      </div>

      {/* Score */}
      <div className="hidden sm:flex col-span-1 items-center justify-center">
        <div className="flex items-center gap-2">
          <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full",
                opp.score >= 70
                  ? "bg-primary"
                  : opp.score >= 50
                    ? "bg-amber-500"
                    : "bg-slate-400",
              )}
              style={{ width: `${opp.score}%` }}
            />
          </div>
          <span className="text-[13px] font-extrabold tabular-nums text-foreground">
            {opp.score}
          </span>
        </div>
      </div>

      {/* Arrow */}
      <div className="hidden sm:flex col-span-1 justify-end">
        <ChevronRight className="size-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
      </div>

      {/* Mobile compact row details */}
      <div className="flex sm:hidden items-center justify-between ml-5 mt-1">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
            {opp.escenario}
          </span>
          <div
            className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border",
              nivelStyle.bg,
              nivelStyle.text,
              nivelStyle.border,
            )}
          >
            <span className={cn("size-1 rounded-full", nivelStyle.dot)} />
            {nivelStyle.label}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-10 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full",
                opp.score >= 70
                  ? "bg-primary"
                  : opp.score >= 50
                    ? "bg-amber-500"
                    : "bg-slate-400",
              )}
              style={{ width: `${opp.score}%` }}
            />
          </div>
          <span className="text-[13px] font-extrabold tabular-nums text-foreground">
            {opp.score}
          </span>
        </div>
      </div>
    </Link>
  );
}
