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
            <Wallet className="w-5 h-5" /> Simulación de banca
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            ¿Esto da plata? — backtest sobre carteras ya evaluadas (últimos 90 días).
          </p>
        </div>
        <div className="text-xs text-right">
          <div>Costo por jugada: <span className="font-semibold">{money(costoPorJugada)}</span></div>
          <div>Premio por acierto: <span className="font-semibold">{money(premio)}</span></div>
          <div>
            Break-even: <span className="font-semibold">{(breakEven * 100).toFixed(1)}%</span> hit rate
          </div>
        </div>
      </div>

      {/* Config */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5 p-3 bg-muted/40 rounded-xl">
        <Field label="Fondo inicial $" value={cfg.fondoInicial} onChange={upd("fondoInicial")} />
        <Field label="Apuesta / número $" value={cfg.apuestaPorNumero} onChange={upd("apuestaPorNumero")} />
        <Field label="Paga banca (×)" value={cfg.pago} onChange={upd("pago")} />
        <Field label="Nums / cartera" value={cfg.numerosPorCartera} onChange={upd("numerosPorCartera")} />
        <Field label="Score mínimo (filtradas)" value={cfg.scoreMin} onChange={upd("scoreMin")} />
      </div>

      {isLoading || !data ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Calculando…</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          <SimCard title="Todas las carteras" sub="Como si jugaras todo lo que el motor genera" sim={data.all} cfg={cfg} breakEven={breakEven} />
          <SimCard title={`Solo confianza ≥ ${cfg.scoreMin}`} sub="Filtrando por internalScore (oportunidades)" sim={data.filtered} cfg={cfg} breakEven={breakEven} highlight />
        </div>
      )}

      {data && data.all.jugadas < 30 && (
        <div className="mt-4 flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl text-xs">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>
            Muestra chica ({data.all.jugadas} jugadas). Los números son orientativos — necesitás
            ~50-100 jugadas para que el ROI sea estadísticamente confiable.
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
  return (
    <div className={`rounded-2xl p-4 border ${highlight ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="font-bold text-sm">{title}</div>
          <div className="text-[11px] text-muted-foreground">{sub}</div>
        </div>
        <div className={`flex items-center gap-1 text-sm font-bold ${positive ? "text-emerald-600" : "text-red-600"}`}>
          {positive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          {positive ? "+" : ""}{money(sim.pl)}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <Stat label="Balance final" value={money(sim.balanceFinal)} hint={`de ${money(cfg.fondoInicial)}`} />
        <Stat label="ROI" value={`${(sim.roi * 100).toFixed(1)}%`} positive={sim.roi >= 0} />
        <Stat label="Jugadas" value={fmt(sim.jugadas)} hint={`${fmt(sim.aciertos)} aciertos`} />
        <Stat
          label="Hit rate"
          value={`${(sim.hitRate * 100).toFixed(1)}%`}
          hint={`break-even ${(breakEven * 100).toFixed(1)}%`}
          positive={beatsBreakEven}
        />
        <Stat label="Invertido" value={money(sim.invertido)} />
        <Stat label="Max drawdown" value={money(sim.maxDrawdown)} negative />
      </div>

      <Equity points={sim.equity} fondoInicial={cfg.fondoInicial} />

      <div className="mt-2 text-[11px] text-muted-foreground flex items-center gap-1">
        <Target className="w-3 h-3" />
        {sim.jugadas === 0
          ? "Sin jugadas en este filtro"
          : beatsBreakEven
            ? `Le saca ${((sim.hitRate - breakEven) * 100).toFixed(1)} pts al break-even`
            : `Le falta ${((breakEven - sim.hitRate) * 100).toFixed(1)} pts para break-even`}
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