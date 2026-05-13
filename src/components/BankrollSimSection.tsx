import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBankrollSim, type BankrollConfig, type SimResult } from "@/hooks/useBankrollSim";
import { TrendingUp, TrendingDown, Wallet, Target, AlertTriangle } from "lucide-react";

const STORAGE_KEY = "bankroll-cfg-v1";
const DEFAULT_CFG: BankrollConfig = {
  fondoInicial: 200_000,
  apuestaPorNumero: 1_000,
  pago: 72,
  numerosPorCartera: 25,
  scoreMin: 60,
};

function fmt(n: number) {
  return new Intl.NumberFormat("es-DO", { maximumFractionDigits: 0 }).format(Math.round(n));
}
function money(n: number) {
  return `$${fmt(n)}`;
}

function loadCfg(): BankrollConfig {
  if (typeof window === "undefined") return DEFAULT_CFG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CFG;
    return { ...DEFAULT_CFG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CFG;
  }
}

export function BankrollSimSection() {
  const [cfg, setCfg] = useState<BankrollConfig>(DEFAULT_CFG);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setCfg(loadCfg());
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  }, [cfg, hydrated]);

  const { data, isLoading } = useBankrollSim(cfg, 90);

  const breakEven = useMemo(() => cfg.numerosPorCartera / cfg.pago, [cfg]);
  const costoPorJugada = cfg.numerosPorCartera * cfg.apuestaPorNumero;
  const premio = cfg.apuestaPorNumero * cfg.pago;

  const upd = (k: keyof BankrollConfig) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    setCfg((c) => ({ ...c, [k]: Number.isFinite(v) ? v : 0 }));
  };

  return (
    <Card className="p-5 mb-5">
      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Wallet className="w-5 h-5" /> ¿Cuánto dinero ganaría?
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Simulamos cómo te habría ido jugando estas carteras los últimos 90 días.
          </p>
        </div>
        <div className="text-xs text-right">
          <div>Gastas por sorteo: <span className="font-semibold">{money(costoPorJugada)}</span></div>
          <div>Cobras si aciertas: <span className="font-semibold">{money(premio)}</span></div>
          <div>
            Para no perder: acertar <span className="font-semibold">{(breakEven * 100).toFixed(1)}%</span> de las veces
          </div>
        </div>
      </div>

      {/* Config */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5 p-3 bg-muted/40 rounded-xl">
        <Field label="Dinero que tienes $" value={cfg.fondoInicial} onChange={upd("fondoInicial")} />
        <Field label="Apuesta a cada número $" value={cfg.apuestaPorNumero} onChange={upd("apuestaPorNumero")} />
        <Field label="La banca paga (×)" value={cfg.pago} onChange={upd("pago")} />
        <Field label="Números por jugada" value={cfg.numerosPorCartera} onChange={upd("numerosPorCartera")} />
        <Field label="Confianza mínima" value={cfg.scoreMin} onChange={upd("scoreMin")} />
      </div>

      {isLoading || !data ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Calculando…</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          <SimCard
            title="Si juegas SIEMPRE"
            sub="Apuestas en cada sorteo que el motor te arma"
            sim={data.all}
            cfg={cfg}
            breakEven={breakEven}
          />
          <SimCard
            title="Si juegas SOLO cuando hay buena señal"
            sub={`Apuestas solo cuando la confianza es ${cfg.scoreMin} o más`}
            sim={data.filtered}
            cfg={cfg}
            breakEven={breakEven}
            highlight
          />
        </div>
      )}

      {data && data.all.jugadas < 30 && (
        <div className="mt-4 flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl text-xs">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>
            Pocas jugadas todavía ({data.all.jugadas}). Estos números son una estimación —
            con 50-100 jugadas la ganancia real será mucho más confiable.
          </span>
        </div>
      )}
    </Card>
  );
}

function Field({ label, value, onChange }: { label: string; value: number; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <div>
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      <Input type="number" value={value} onChange={onChange} className="mt-1 h-9" />
    </div>
  );
}

function SimCard({
  title,
  sub,
  sim,
  cfg,
  breakEven,
  highlight,
}: {
  title: string;
  sub: string;
  sim: SimResult;
  cfg: BankrollConfig;
  breakEven: number;
  highlight?: boolean;
}) {
  const positive = sim.pl >= 0;
  const beatsBreakEven = sim.hitRate >= breakEven;
  const aciertosNecesarios = Math.ceil(breakEven * sim.jugadas);
  const diffAciertos = sim.aciertos - aciertosNecesarios;
  const hitPct = (sim.hitRate * 100).toFixed(1);
  const beEvenPct = (breakEven * 100).toFixed(1);

  let veredictoIcon = "⚪️";
  let veredictoTitulo = "Sin datos";
  let veredictoDetalle = "Todavía no hay sorteos evaluados con este filtro.";

  if (sim.jugadas > 0) {
    if (positive && beatsBreakEven) {
      veredictoIcon = "🟢";
      veredictoTitulo = "Da ganancia";
      veredictoDetalle = `Acertaste ${sim.aciertos} de ${sim.jugadas} (${hitPct}%) — ${diffAciertos} aciertos por encima del mínimo (${aciertosNecesarios} para no perder · ${beEvenPct}%).`;
    } else if (positive && !beatsBreakEven) {
      // Caso raro: saldo positivo pero hit rate por debajo (pagos altos en pocos aciertos)
      veredictoIcon = "🟡";
      veredictoTitulo = "Apenas empata";
      veredictoDetalle = `Saldo positivo de chiripa: acertaste ${sim.aciertos} de ${sim.jugadas} (${hitPct}%), debajo del mínimo (${beEvenPct}%). En el largo plazo va a perder.`;
    } else if (!positive && beatsBreakEven) {
      veredictoIcon = "🟡";
      veredictoTitulo = "Casi rentable";
      veredictoDetalle = `Aciertas bien (${sim.aciertos} de ${sim.jugadas} = ${hitPct}%, encima de ${beEvenPct}%) pero las rachas malas te pasaron factura. Necesitas más jugadas para confirmar.`;
    } else {
      veredictoIcon = "🔴";
      veredictoTitulo = "Pierde plata";
      const faltan = Math.abs(diffAciertos);
      veredictoDetalle = `Solo acertaste ${sim.aciertos} de ${sim.jugadas} (${hitPct}%). Te faltaron ${faltan} aciertos para llegar al mínimo de ${aciertosNecesarios} (${beEvenPct}%) que cubre los gastos.`;
    }
  }

  return (
    <div className={`rounded-2xl p-4 border ${highlight ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="font-bold text-sm">{title}</div>
          <div className="text-[11px] text-muted-foreground">{sub}</div>
        </div>
        <div className="text-right">
          <div className={`flex items-center justify-end gap-1 text-base font-bold ${positive ? "text-emerald-600" : "text-red-600"}`}>
            {positive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            {positive ? "Ganas " : "Pierdes "}{money(Math.abs(sim.pl))}
          </div>
        </div>
      </div>

      {/* Veredicto explícito */}
      <div
        className={`mb-3 p-2.5 rounded-xl border text-[11px] leading-relaxed ${
          veredictoIcon === "🟢"
            ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900"
            : veredictoIcon === "🔴"
              ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900"
              : veredictoIcon === "🟡"
                ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900"
                : "bg-muted/40 border-border"
        }`}
      >
        <div className="font-bold mb-0.5">
          {veredictoIcon} {veredictoTitulo}
        </div>
        <div className="text-muted-foreground">{veredictoDetalle}</div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <Stat
          label="Te queda"
          value={money(sim.balanceFinal)}
          hint={`empezaste con ${money(cfg.fondoInicial)}`}
          positive={sim.balanceFinal >= cfg.fondoInicial}
        />
        <Stat
          label="Por cada $100 que apuestas"
          value={`${sim.roi >= 0 ? "ganas" : "pierdes"} $${Math.abs(sim.roi * 100).toFixed(0)}`}
          positive={sim.roi >= 0}
        />
        <Stat
          label="Sorteos jugados"
          value={fmt(sim.jugadas)}
          hint={`acertaste ${fmt(sim.aciertos)} de ${fmt(sim.jugadas)}`}
        />
        <Stat
          label="Aciertas"
          value={`${(sim.hitRate * 100).toFixed(0)} de cada 100`}
          hint={`necesitas ${(breakEven * 100).toFixed(0)} para no perder`}
          positive={beatsBreakEven}
        />
        <Stat label="Total apostado" value={money(sim.invertido)} />
        <Stat
          label="Peor bajón"
          value={money(sim.maxDrawdown)}
          hint="cuánto llegaste a perder en racha"
          negative
        />
      </div>

      <Equity points={sim.equity} fondoInicial={cfg.fondoInicial} />

      <div className="mt-2 text-[11px] text-muted-foreground flex items-center gap-1">
        <Target className="w-3 h-3" />
        {sim.jugadas === 0
          ? "Todavía no hay sorteos para mostrar"
          : beatsBreakEven
            ? `Aciertas ${((sim.hitRate - breakEven) * 100).toFixed(1)}% más de lo necesario para ganar`
            : `Te falta acertar ${((breakEven - sim.hitRate) * 100).toFixed(1)}% más para no perder`}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  positive,
  negative,
}: {
  label: string;
  value: string;
  hint?: string;
  positive?: boolean;
  negative?: boolean;
}) {
  const color = positive ? "text-emerald-600" : negative ? "text-red-600" : "text-foreground";
  return (
    <div className="bg-background/60 rounded-lg px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-bold text-sm ${color}`}>{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Equity({ points, fondoInicial }: { points: Array<{ i: number; balance: number }>; fondoInicial: number }) {
  if (points.length < 2) return <div className="h-16" />;
  const w = 280;
  const h = 60;
  const xs = points.map((p) => p.i);
  const ys = points.map((p) => p.balance);
  const minY = Math.min(...ys, fondoInicial);
  const maxY = Math.max(...ys, fondoInicial);
  const span = Math.max(1, maxY - minY);
  const maxX = Math.max(1, xs[xs.length - 1]);
  const path = points
    .map((p, idx) => {
      const x = (p.i / maxX) * w;
      const y = h - ((p.balance - minY) / span) * h;
      return `${idx === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  const baseY = h - ((fondoInicial - minY) / span) * h;
  const last = points[points.length - 1].balance;
  const stroke = last >= fondoInicial ? "rgb(16 185 129)" : "rgb(239 68 68)";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-16">
      <line x1={0} x2={w} y1={baseY} y2={baseY} stroke="currentColor" strokeOpacity={0.2} strokeDasharray="3 3" />
      <path d={path} fill="none" stroke={stroke} strokeWidth={1.8} />
    </svg>
  );
}