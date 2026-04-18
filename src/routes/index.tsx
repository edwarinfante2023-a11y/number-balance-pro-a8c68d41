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
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { BalanceBar } from "@/components/BalanceBar";
import {
  AltoBajoBadge,
  ParImparBadge,
  SubcuadranteBadge,
} from "@/components/ClassificationBadge";
import {
  generateDemoHistory,
  computeBalance,
  computeRachas,
  computeFrecuencias,
  computeEscenarioProbable,
  subcuadranteLabel,
} from "@/lib/lottery";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Cuadrante" },
      {
        name: "description",
        content:
          "Panel principal de análisis de sorteos: balance, rachas, escenario probable y patrones activos.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const sorteos = useMemo(() => generateDemoHistory(30), []);
  const today = sorteos[0]?.fecha;
  const todaySorteos = useMemo(
    () => sorteos.filter((s) => s.fecha === today),
    [sorteos, today],
  );
  const balance = useMemo(() => computeBalance(sorteos.slice(-20)), [sorteos]);
  const rachas = useMemo(() => computeRachas(sorteos), [sorteos]);
  const escenario = useMemo(() => computeEscenarioProbable(sorteos), [sorteos]);
  const ultimo = useMemo(() => {
    const ordered = [...sorteos].sort((a, b) =>
      `${b.fecha} ${b.hora}`.localeCompare(`${a.fecha} ${a.hora}`),
    );
    return ordered[0];
  }, [sorteos]);

  const frecuencias = useMemo(() => computeFrecuencias(sorteos), [sorteos]);
  const calientes = useMemo(
    () => [...frecuencias].sort((a, b) => b.count - a.count).slice(0, 6),
    [frecuencias],
  );
  const frios = useMemo(
    () => [...frecuencias].sort((a, b) => a.count - b.count).slice(0, 6),
    [frecuencias],
  );

  const ruedaDia = useMemo(
    () =>
      [...todaySorteos]
        .filter((s) => s.loteria === "Quiniela Diaria")
        .sort((a, b) => a.hora.localeCompare(b.hora)),
    [todaySorteos],
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Panel de análisis"
        description="Comportamiento del ecosistema en tiempo real. Balance, rachas, patrones activos y escenarios probables basados en histórico."
        actions={
          <>
            <select className="h-9 rounded-md border border-border bg-card px-3 text-sm">
              <option>Quiniela Diaria</option>
              <option>Sorteo Horario</option>
              <option>Tarde Express</option>
              <option>Todas las loterías</option>
            </select>
            <select className="h-9 rounded-md border border-border bg-card px-3 text-sm">
              <option>Hoy</option>
              <option>Últimos 7 días</option>
              <option>Últimos 30 días</option>
            </select>
          </>
        }
      />

      {/* Resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatCard
          label="Último número"
          value={ultimo?.numero.toString().padStart(2, "0") ?? "—"}
          hint={
            ultimo
              ? `${ultimo.hora} · ${ultimo.loteria}`
              : "sin datos"
          }
          accent={ultimo?.altoBajo === "ALTO" ? "alto" : "bajo"}
          icon={<Activity className="size-4" />}
        />
        <StatCard
          label="Clasificación actual"
          value={
            ultimo ? (
              <div className="flex flex-wrap gap-1.5">
                <AltoBajoBadge value={ultimo.altoBajo} soft={false} />
                <ParImparBadge value={ultimo.parImpar} soft={false} />
              </div>
            ) : (
              "—"
            )
          }
          hint={ultimo ? subcuadranteLabel[ultimo.subcuadrante] : ""}
          icon={<Sparkles className="size-4" />}
        />
        <StatCard
          label="Racha activa más larga"
          value={
            rachas.length > 0
              ? `${rachas[0].longitud}× ${rachas[0].valor}`
              : "—"
          }
          hint={rachas.length > 0 ? `${rachas[0].tipo} consecutivos` : "sin racha relevante"}
          accent={
            rachas[0]?.valor === "ALTO"
              ? "alto"
              : rachas[0]?.valor === "BAJO"
                ? "bajo"
                : rachas[0]?.valor === "PAR"
                  ? "par"
                  : "impar"
          }
          icon={<TrendingUp className="size-4" />}
        />
        <StatCard
          label="Sorteos analizados"
          value={sorteos.length.toLocaleString("es")}
          hint={`30 días · ${todaySorteos.length} hoy`}
          icon={<ClockIcon className="size-4" />}
        />
      </div>

      {/* Balance + Escenario */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-semibold tracking-tight">Estado del sistema</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Balance acumulado de los últimos 20 sorteos
              </p>
            </div>
            <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
              n = {balance.total}
            </span>
          </div>
          <div className="space-y-5">
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

        {/* Escenario probable */}
        <div className="rounded-2xl border border-border bg-foreground text-background p-6 shadow-[var(--shadow-elevated)]">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide opacity-70">
            <Sparkles className="size-3.5" />
            Escenario probable
          </div>
          <div className="mt-3 flex items-baseline gap-3">
            <div className="text-3xl font-semibold tracking-tight">{escenario.escenario}</div>
            <div className="text-lg font-medium opacity-80 tabular-nums">
              {escenario.porcentaje}%
            </div>
          </div>
          <p className="mt-1 text-xs opacity-60">
            Apoyo basado en histórico, equilibrio actual y rachas. No es una predicción garantizada.
          </p>
          <ul className="mt-4 space-y-2">
            {escenario.razones.map((r, i) => (
              <li key={i} className="flex gap-2 text-xs leading-relaxed opacity-90">
                <ArrowUpRight className="size-3.5 shrink-0 mt-0.5 opacity-60" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Rueda del día + Rachas/Alertas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold tracking-tight">Línea del día</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Rueda vertical · Quiniela Diaria · {today}
              </p>
            </div>
          </div>
          {ruedaDia.length === 0 ? (
            <div className="text-sm text-muted-foreground">Sin sorteos hoy todavía.</div>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <div className="min-w-full px-2">
                <div className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-x-4 gap-y-2 text-sm">
                  {ruedaDia.map((s) => (
                    <RowDia key={s.id} s={s} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {/* Rachas */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            <h2 className="text-base font-semibold tracking-tight mb-3">Rachas activas</h2>
            {rachas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin rachas relevantes.</p>
            ) : (
              <ul className="space-y-2.5">
                {rachas.map((r, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2"
                  >
                    <div>
                      <div className="text-sm font-medium">{r.valor}</div>
                      <div className="text-[11px] text-muted-foreground">{r.tipo}</div>
                    </div>
                    <div className="text-sm font-semibold tabular-nums">×{r.longitud}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Alertas */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="size-4 text-warning" />
              <h2 className="text-base font-semibold tracking-tight">Alertas inteligentes</h2>
            </div>
            <ul className="space-y-2 text-sm">
              <li className="flex gap-2">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-warning" />
                <span>
                  Posible ruptura: {rachas[0]?.valor ?? "—"} repetido {rachas[0]?.longitud ?? 0}×
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-info" />
                <span>
                  Balance Alto/Bajo {balance.pctAltos.toFixed(0)}/{balance.pctBajos.toFixed(0)} —
                  monitorear compensación
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-success" />
                <span>Patrón histórico “3 altos → bajo” cumplido 7/10 últimas veces</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Calientes / Fríos / Patrones */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <NumeroPanel title="Números calientes" icon={<Flame className="size-4" />} items={calientes} />
        <NumeroPanel
          title="Números fríos"
          icon={<Snowflake className="size-4" />}
          items={frios}
          variant="cold"
        />

        <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <h2 className="text-base font-semibold tracking-tight mb-3">Patrones activos</h2>
          <ul className="space-y-3">
            {[
              { name: "3 ALTOS → BAJO", pct: 72 },
              { name: "PAR + PAR → IMPAR", pct: 65 },
              { name: "Repetición de cuadrante 2× → ruptura", pct: 58 },
              { name: "Exceso impares → compensación par", pct: 70 },
            ].map((p) => (
              <li key={p.name}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="font-medium">{p.name}</span>
                  <span className="tabular-nums text-muted-foreground">{p.pct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-foreground"
                    style={{ width: `${p.pct}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function RowDia({ s }: { s: ReturnType<typeof generateDemoHistory>[number] }) {
  return (
    <>
      <div className="text-xs text-muted-foreground tabular-nums">{s.hora}</div>
      <div className="font-mono text-base font-semibold tabular-nums">
        {s.numero.toString().padStart(2, "0")}
      </div>
      <AltoBajoBadge value={s.altoBajo} />
      <ParImparBadge value={s.parImpar} />
      <SubcuadranteBadge value={s.subcuadrante} />
    </>
  );
}

function NumeroPanel({
  title,
  icon,
  items,
  variant = "hot",
}: {
  title: string;
  icon: React.ReactNode;
  items: { numero: number; count: number }[];
  variant?: "hot" | "cold";
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2 mb-3">
        <span className={variant === "hot" ? "text-alto" : "text-bajo"}>{icon}</span>
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {items.map((n) => (
          <div
            key={n.numero}
            className="rounded-lg border border-border bg-background p-3 text-center"
          >
            <div className="font-mono text-xl font-semibold tabular-nums">
              {n.numero.toString().padStart(2, "0")}
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
              {n.count}× en 30d
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
