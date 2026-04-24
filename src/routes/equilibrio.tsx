import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Loader2,
  Scale,
  Flame,
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Bell,
  BellOff,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Line,
  Area,
  ReferenceLine,
  Legend,
} from "recharts";
import { cn } from "@/lib/utils";
import { useBalance, type BalanceWindow, type HourPoint } from "@/hooks/useBalance";
import { useBalanceAlerts } from "@/hooks/useBalanceAlerts";
import { useBalanceAlertsConfig } from "@/hooks/useSettings";

export const Route = createFileRoute("/equilibrio")({
  head: () => ({
    meta: [
      { title: "Equilibrio y Compensación — Cuadrante" },
      {
        name: "description",
        content:
          "Tablero analítico de equilibrio Alto/Bajo y Par/Impar por hora con detección de rachas pendientes y bloques desbalanceados.",
      },
      { property: "og:title", content: "Equilibrio y Compensación — Cuadrante" },
      {
        property: "og:description",
        content: "Compensación por hora, hora más desbalanceada y rachas pendientes.",
      },
    ],
  }),
  component: EquilibrioPage,
});

const WINDOW_OPTIONS: { label: string; value: BalanceWindow }[] = [
  { label: "7 días", value: 7 },
  { label: "30 días", value: 30 },
  { label: "90 días", value: 90 },
];

function EquilibrioPage() {
  const [windowDays, setWindowDays] = useState<BalanceWindow>(30);
  const { data: globalCfg } = useBalanceAlertsConfig();
  const [overrideThreshold, setOverrideThreshold] = useState<number | null>(null);
  const effectiveThreshold = overrideThreshold ?? globalCfg?.threshold ?? 15;
  const { alerts: balanceAlerts } = useBalanceAlerts(windowDays, {
    threshold: effectiveThreshold,
  });
  const { series, kpis, isLoading } = useBalance(windowDays);

  if (isLoading) {
    return (
      <div className="grid place-items-center py-32">
        <div className="size-14 rounded-[16px] bg-white border border-border grid place-items-center shadow-sm">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const populatedSeries = series.filter((s) => s.total > 0);

  return (
    <div className="space-y-6 pt-2 animate-fade-up">
      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5 mb-6">
        <div>
          <h1 className="text-[28px] lg:text-[32px] font-bold tracking-tight text-foreground flex items-center gap-3">
            <div className="size-10 rounded-xl bg-emerald-100 border border-emerald-200 grid place-items-center shadow-sm">
              <Scale className="size-5 text-emerald-600" />
            </div>
            Equilibrio y Compensación
          </h1>
          <p className="text-[15px] text-muted-foreground mt-2 max-w-2xl leading-relaxed">
            Distribución de Alto/Bajo y Par/Impar por hora del día, con detección de la
            franja más desbalanceada y rachas pendientes de compensar.
          </p>
        </div>

        {/* Window switcher */}
        <div className="inline-flex items-center bg-white border border-border rounded-full p-1 shadow-sm self-start">
          {WINDOW_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setWindowDays(opt.value)}
              className={cn(
                "px-4 h-9 rounded-full text-[12px] font-bold transition-all",
                windowDays === opt.value
                  ? "bg-foreground text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPIs ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-5">
        <KPICard
          icon={<Activity className="size-4" />}
          label="Muestra Total"
          value={kpis.totalDraws.toString()}
          hint={`Últimos ${windowDays} días`}
        />
        <DeltaCard
          label="Sesgo Alto/Bajo"
          pct={kpis.altoPct}
          delta={kpis.abDelta}
          leftLabel="BAJO"
          rightLabel="ALTO"
        />
        <DeltaCard
          label="Sesgo Par/Impar"
          pct={kpis.parPct}
          delta={kpis.piDelta}
          leftLabel="IMPAR"
          rightLabel="PAR"
        />
        <WorstHourCard kpis={kpis} />
      </div>

      {/* ── Panel de Alertas de Desbalance ──────────────────── */}
      <BalanceAlertsPanel
        alerts={balanceAlerts}
        threshold={effectiveThreshold}
        globalThreshold={globalCfg?.threshold ?? 15}
        override={overrideThreshold}
        onOverrideChange={setOverrideThreshold}
        enabled={globalCfg?.enabled ?? true}
      />

      {/* ── Rachas pendientes ────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">
        <StreakCard
          label="Racha Alto/Bajo"
          streak={kpis.pendingStreakAB}
          leftLabel="BAJO"
          rightLabel="ALTO"
        />
        <StreakCard
          label="Racha Par/Impar"
          streak={kpis.pendingStreakPI}
          leftLabel="IMPAR"
          rightLabel="PAR"
        />
      </div>

      {/* ── Gráfico Alto/Bajo ────────────────────────────────── */}
      <BalanceChart
        title="Alto vs Bajo por hora"
        subtitle="% de resultados ALTO sobre el total de la franja horaria. La línea se aleja del 50% cuando hay sesgo."
        series={populatedSeries}
        dataKey="altoPct"
        deviationKey="abDeviation"
        color="oklch(0.65 0.18 25)"
        accentLabel="ALTO"
        baseLabel="BAJO"
      />

      {/* ── Gráfico Par/Impar ────────────────────────────────── */}
      <BalanceChart
        title="Par vs Impar por hora"
        subtitle="% de resultados PAR sobre el total. La sombra ámbar indica la magnitud del desequilibrio."
        series={populatedSeries}
        dataKey="parPct"
        deviationKey="piDeviation"
        color="oklch(0.55 0.16 250)"
        accentLabel="PAR"
        baseLabel="IMPAR"
      />

      {/* ── Tabla resumen ───────────────────────────────────── */}
      <HourTable series={populatedSeries} />
    </div>
  );
}

// ─── KPI cards ────────────────────────────────────────────────────────────

function KPICard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="bg-white rounded-[24px] border border-border shadow-sm p-5 relative overflow-hidden">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="size-7 rounded-lg bg-muted/40 grid place-items-center">{icon}</span>
        <span className="text-[11px] font-bold uppercase tracking-[0.15em]">{label}</span>
      </div>
      <div className="mt-3 text-[28px] font-extrabold tracking-tight tabular-nums text-foreground">
        {value}
      </div>
      {hint && <div className="text-[12px] text-muted-foreground font-medium">{hint}</div>}
    </div>
  );
}

function DeltaCard({
  label,
  pct,
  delta,
  leftLabel,
  rightLabel,
}: {
  label: string;
  pct: number;
  delta: number;
  leftLabel: string;
  rightLabel: string;
}) {
  const tone = Math.abs(delta) >= 5 ? "warning" : Math.abs(delta) >= 2 ? "info" : "ok";
  const toneClass =
    tone === "warning"
      ? "text-orange-600 bg-orange-50 border-orange-200"
      : tone === "info"
        ? "text-blue-600 bg-blue-50 border-blue-200"
        : "text-emerald-600 bg-emerald-50 border-emerald-200";
  const Arrow = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;

  return (
    <div className="bg-white rounded-[24px] border border-border shadow-sm p-5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
          {label}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold tabular-nums",
            toneClass,
          )}
        >
          <Arrow className="size-3" />
          {delta >= 0 ? "+" : ""}
          {delta.toFixed(1)}%
        </span>
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-[28px] font-extrabold tabular-nums text-foreground">
          {pct.toFixed(1)}%
        </span>
        <span className="text-[12px] font-bold text-muted-foreground uppercase tracking-widest">
          {rightLabel}
        </span>
      </div>

      {/* Barra divergente */}
      <div className="mt-3 h-2.5 rounded-full bg-muted overflow-hidden relative">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-300 to-blue-500"
          style={{ width: `${100 - pct}%` }}
        />
        <div
          className="absolute inset-y-0 right-0 bg-gradient-to-l from-orange-400 to-orange-500"
          style={{ width: `${pct}%` }}
        />
        <div className="absolute inset-y-0 left-1/2 w-[2px] -ml-px bg-foreground/40" />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        <span>{leftLabel}</span>
        <span>50/50</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}

function WorstHourCard({ kpis }: { kpis: ReturnType<typeof useBalance>["kpis"] }) {
  const wh = kpis.worstHour;

  if (!wh) {
    return (
      <KPICard
        icon={<Flame className="size-4" />}
        label="Hora más desbalanceada"
        value="—"
        hint="Sin datos suficientes"
      />
    );
  }

  const dev = Math.max(wh.abDeviation, wh.piDeviation);
  const cat = kpis.worstHourCategory ?? "—";
  const dominant =
    cat === "ALTO/BAJO"
      ? wh.altoPct >= 50
        ? "ALTO"
        : "BAJO"
      : wh.parPct >= 50
        ? "PAR"
        : "IMPAR";

  return (
    <div className="bg-white rounded-[24px] border border-border shadow-sm p-5 relative overflow-hidden">
      <div className="absolute -top-8 -right-8 size-28 rounded-full bg-orange-500/10 blur-2xl pointer-events-none" />
      <div className="flex items-center gap-2 text-muted-foreground relative z-10">
        <span className="size-7 rounded-lg bg-orange-50 text-orange-600 grid place-items-center border border-orange-200">
          <Flame className="size-4" />
        </span>
        <span className="text-[11px] font-bold uppercase tracking-[0.15em]">
          Hora más desbalanceada
        </span>
      </div>
      <div className="mt-3 flex items-baseline gap-2 relative z-10">
        <span className="text-[28px] font-extrabold tabular-nums text-foreground">{wh.hora}</span>
        <span className="text-[12px] font-bold text-muted-foreground">
          ({wh.total} draws)
        </span>
      </div>
      <div className="mt-2 flex items-center gap-2 relative z-10">
        <span className="inline-block rounded-md border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-orange-700">
          {cat}
        </span>
        <span className="text-[12px] font-bold text-foreground">
          domina {dominant}
        </span>
        <span className="text-[12px] font-bold text-muted-foreground tabular-nums">
          · Δ {dev.toFixed(1)}pts
        </span>
      </div>
    </div>
  );
}

function StreakCard({
  label,
  streak,
  leftLabel,
  rightLabel,
}: {
  label: string;
  streak: { side: string; length: number } | null;
  leftLabel: string;
  rightLabel: string;
}) {
  const empty = !streak || streak.length < 2;
  const intense = streak && streak.length >= 5;
  return (
    <div
      className={cn(
        "rounded-[24px] border shadow-sm p-5 relative overflow-hidden transition-colors",
        intense
          ? "bg-orange-50/60 border-orange-200"
          : empty
            ? "bg-white border-border"
            : "bg-white border-border",
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span
            className={cn(
              "size-7 rounded-lg grid place-items-center",
              intense ? "bg-orange-100 text-orange-600" : "bg-muted/40",
            )}
          >
            <Activity className="size-4" />
          </span>
          <span className="text-[11px] font-bold uppercase tracking-[0.15em]">{label}</span>
        </div>
        {!empty && (
          <span
            className={cn(
              "text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border",
              intense
                ? "bg-orange-100 border-orange-200 text-orange-700"
                : "bg-muted/30 border-border text-muted-foreground",
            )}
          >
            {intense ? "Compensación pendiente" : "En curso"}
          </span>
        )}
      </div>

      {empty ? (
        <div className="mt-4">
          <div className="text-[20px] font-bold text-muted-foreground">Sin racha activa</div>
          <p className="text-[12px] text-muted-foreground mt-1 font-medium">
            La última secuencia alterna entre {leftLabel} y {rightLabel}.
          </p>
        </div>
      ) : (
        <div className="mt-4">
          <div className="flex items-baseline gap-3">
            <span className="text-[36px] font-extrabold tabular-nums text-foreground leading-none">
              {streak!.length}
            </span>
            <span className="text-[14px] font-bold text-muted-foreground">consecutivos</span>
          </div>
          <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1">
            <span className="size-2 rounded-full bg-foreground" />
            <span className="text-[12px] font-bold tracking-wider uppercase text-foreground">
              {streak!.side}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Chart ────────────────────────────────────────────────────────────────

function BalanceChart({
  title,
  subtitle,
  series,
  dataKey,
  deviationKey,
  color,
  accentLabel,
  baseLabel,
}: {
  title: string;
  subtitle: string;
  series: HourPoint[];
  dataKey: "altoPct" | "parPct";
  deviationKey: "abDeviation" | "piDeviation";
  color: string;
  accentLabel: string;
  baseLabel: string;
}) {
  return (
    <div className="bg-white rounded-[24px] lg:rounded-[32px] border border-border shadow-sm p-5 lg:p-7">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5">
        <div>
          <h3 className="text-[16px] font-bold text-foreground tracking-tight">{title}</h3>
          <p className="text-[12.5px] text-muted-foreground mt-1 max-w-xl leading-relaxed">
            {subtitle}
          </p>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: color }} />
            {accentLabel}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-foreground/30" />
            Equilibrio 50%
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-sm bg-orange-400/40" />
            Desviación
          </span>
        </div>
      </div>

      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={series} margin={{ top: 10, right: 16, bottom: 0, left: -10 }}>
            <defs>
              <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="oklch(0.75 0.15 60)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="oklch(0.75 0.15 60)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 6" stroke="oklch(0.92 0 0)" vertical={false} />
            <XAxis
              dataKey="hora"
              stroke="oklch(0.55 0 0)"
              tick={{ fontSize: 11, fontWeight: 600 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              stroke="oklch(0.55 0 0)"
              tick={{ fontSize: 11, fontWeight: 600 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}%`}
              width={40}
            />
            <Tooltip
              cursor={{ stroke: "oklch(0.85 0 0)", strokeWidth: 1 }}
              contentStyle={{
                background: "white",
                border: "1px solid oklch(0.9 0 0)",
                borderRadius: 12,
                fontSize: 12,
                fontWeight: 600,
                boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
              }}
              formatter={(value: number, name: string) => {
                if (name === "Desviación") return [`${value.toFixed(1)} pts`, name];
                return [`${value.toFixed(1)}%`, name];
              }}
            />
            <ReferenceLine
              y={50}
              stroke="oklch(0.4 0 0)"
              strokeDasharray="4 4"
              strokeWidth={1.2}
              label={{
                value: "50%",
                position: "right",
                fill: "oklch(0.4 0 0)",
                fontSize: 10,
                fontWeight: 700,
              }}
            />
            <Area
              type="monotone"
              dataKey={deviationKey}
              name="Desviación"
              stroke="none"
              fill={`url(#grad-${dataKey})`}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey={dataKey}
              name={`% ${accentLabel}`}
              stroke={color}
              strokeWidth={2.5}
              dot={{ r: 3, fill: color, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: color, stroke: "white", strokeWidth: 2 }}
            />
            <Legend
              iconType="circle"
              wrapperStyle={{ fontSize: 11, fontWeight: 700, paddingTop: 8 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <p className="text-[11px] text-muted-foreground mt-3 font-medium">
        Lectura: cuando la línea se aleja del 50% hacia arriba, dominan los <b>{accentLabel}</b>;
        hacia abajo, dominan los <b>{baseLabel}</b>. La sombra ámbar muestra la magnitud absoluta
        del desequilibrio en esa hora.
      </p>
    </div>
  );
}

// ─── Tabla resumen ────────────────────────────────────────────────────────

function HourTable({ series }: { series: HourPoint[] }) {
  if (series.length === 0) {
    return (
      <div className="bg-white rounded-[24px] border border-border shadow-sm p-10 text-center">
        <p className="text-[14px] text-muted-foreground font-medium">
          No hay sorteos registrados en el período seleccionado.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[24px] lg:rounded-[32px] border border-border shadow-sm overflow-hidden">
      <div className="px-5 lg:px-7 py-5 border-b border-border bg-muted/10">
        <h4 className="text-[14px] font-bold uppercase tracking-[0.1em] text-foreground">
          Detalle por hora
        </h4>
        <p className="text-[12px] text-muted-foreground mt-1 font-medium">
          Solo se muestran horas con datos.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-muted/5 text-[10.5px] font-bold uppercase tracking-[0.18em] text-muted-foreground border-b border-border">
            <tr>
              <th className="px-5 py-3.5">Hora</th>
              <th className="px-5 py-3.5 text-right">Total</th>
              <th className="px-5 py-3.5 text-right">Alto%</th>
              <th className="px-5 py-3.5 text-right">Par%</th>
              <th className="px-5 py-3.5 text-right">Desv. AB</th>
              <th className="px-5 py-3.5 text-right">Desv. PI</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {series.map((s) => (
              <tr key={s.hora} className="hover:bg-muted/20 transition-colors">
                <td className="px-5 py-3 font-mono font-bold text-[13px] text-foreground tabular-nums">
                  {s.hora}
                </td>
                <td className="px-5 py-3 text-right tabular-nums text-[13px] font-bold text-foreground">
                  {s.total}
                </td>
                <td className="px-5 py-3 text-right tabular-nums text-[13px] font-medium text-foreground">
                  {s.altoPct.toFixed(1)}%
                </td>
                <td className="px-5 py-3 text-right tabular-nums text-[13px] font-medium text-foreground">
                  {s.parPct.toFixed(1)}%
                </td>
                <td
                  className={cn(
                    "px-5 py-3 text-right tabular-nums text-[13px] font-bold",
                    s.abDeviation >= 15
                      ? "text-orange-600"
                      : s.abDeviation >= 8
                        ? "text-amber-600"
                        : "text-muted-foreground",
                  )}
                >
                  {s.abDeviation.toFixed(1)}
                </td>
                <td
                  className={cn(
                    "px-5 py-3 text-right tabular-nums text-[13px] font-bold",
                    s.piDeviation >= 15
                      ? "text-orange-600"
                      : s.piDeviation >= 8
                        ? "text-amber-600"
                        : "text-muted-foreground",
                  )}
                >
                  {s.piDeviation.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}