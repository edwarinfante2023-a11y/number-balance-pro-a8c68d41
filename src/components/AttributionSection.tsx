import { useAttributionStats, type SenalKey } from "@/hooks/useAttributionStats";
import { Activity, Scale, BookOpen, Sparkles, Loader2, Trophy, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS: Record<SenalKey, React.ComponentType<{ className?: string }>> = {
  freq: Activity,
  balance: Scale,
  regla: BookOpen,
  patron: Sparkles,
};

const BASELINE = 0.25;

export function AttributionSection() {
  const q = useAttributionStats(90);

  return (
    <section className="rounded-[24px] bg-card p-6 shadow-sm border border-border/40">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="text-[18px] font-black tracking-tight">Atribución de aciertos</h2>
          <p className="text-[13px] text-muted-foreground mt-1">
            Qué señal del motor está empujando los aciertos reales (últimos 90 días).
          </p>
        </div>
        <Trophy className="size-5 text-muted-foreground shrink-0" />
      </div>

      {q.isLoading ? (
        <div className="grid place-items-center h-24 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : !q.data || q.data.totalAciertos === 0 ? (
        <div className="rounded-xl bg-muted/40 p-5 text-center text-[13px] text-muted-foreground">
          Aún no hay aciertos evaluados. Cuando entren los primeros ganadores, vas a ver qué señal los está aportando.
        </div>
      ) : (
        <>
          {q.data.totalAciertos < 5 && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 mb-4 text-[12px] text-amber-900">
              Solo {q.data.totalAciertos} aciertos evaluados — los porcentajes son indicativos, no estadísticamente estables.
            </div>
          )}

          {/* 4 cards de señales */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            {q.data.porSenal.map((s) => {
              const Icon = ICONS[s.senal];
              const pct = Math.round(s.pctAciertos * 100);
              const hitPct = Math.round(s.hitRateSenal * 100);
              const beatBaseline = s.hitRateSenal > BASELINE;
              return (
                <div key={s.senal} className="rounded-xl border border-border/40 bg-background p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="size-4 text-primary" />
                    <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
                      {s.label}
                    </div>
                  </div>
                  <div className="text-[22px] font-black tabular-nums leading-none">{pct}%</div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    presente en {s.aciertosTocados}/{q.data!.totalAciertos} aciertos
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className={cn(
                    "text-[11px] font-bold mt-2",
                    beatBaseline ? "text-emerald-600" : "text-muted-foreground",
                  )}>
                    hit-rate {hitPct}% {beatBaseline ? "↑" : ""} <span className="font-normal text-muted-foreground">vs 25% base</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Insight */}
          {q.data.porSenal[0] && q.data.porSenal[0].pctAciertos > 0 && (
            <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 mb-4 flex items-start gap-2">
              <Lightbulb className="size-4 text-primary shrink-0 mt-0.5" />
              <div className="text-[13px]">
                La señal que más aporta es{" "}
                <b>{q.data.porSenal[0].label}</b>{" "}
                (presente en {Math.round(q.data.porSenal[0].pctAciertos * 100)}% de los aciertos,
                hit-rate {Math.round(q.data.porSenal[0].hitRateSenal * 100)}%).
              </div>
            </div>
          )}

          {/* Leaderboards */}
          <div className="grid md:grid-cols-2 gap-4">
            <Leaderboard title="Top patrones que pegaron" rows={q.data.topPatrones} emptyText="Ningún patrón específico aportó aciertos todavía." />
            <Leaderboard title="Top reglas que pegaron" rows={q.data.topReglas} emptyText="Ninguna regla específica aportó aciertos todavía." />
          </div>
        </>
      )}
    </section>
  );
}

function Leaderboard({
  title, rows, emptyText,
}: { title: string; rows: Array<{ nombre: string; aciertos: number }>; emptyText: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-background p-3">
      <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">{title}</div>
      {rows.length === 0 ? (
        <div className="text-[12px] text-muted-foreground py-3">{emptyText}</div>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r, i) => (
            <li key={r.nombre} className="flex items-center justify-between text-[13px]">
              <span className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] font-black text-muted-foreground tabular-nums w-4">{i + 1}</span>
                <span className="truncate">{r.nombre}</span>
              </span>
              <span className="font-bold tabular-nums shrink-0">{r.aciertos}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}