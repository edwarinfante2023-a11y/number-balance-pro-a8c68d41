import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { generateDemoHistory, computeBalance, subcuadranteLabel } from "@/lib/lottery";
import type { Subcuadrante } from "@/lib/lottery";
import { BalanceBar } from "@/components/BalanceBar";

const HORAS = ["09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00","21:00"];

export const Route = createFileRoute("/analisis-hora")({
  head: () => ({
    meta: [
      { title: "Análisis por hora — Cuadrante" },
      { name: "description", content: "Comportamiento histórico de cada hora del día." },
    ],
  }),
  component: AnalisisHora,
});

function AnalisisHora() {
  const all = useMemo(() => generateDemoHistory(30), []);
  const [hora, setHora] = useState("13:00");
  const subset = useMemo(() => all.filter((s) => s.hora === hora), [all, hora]);
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

  return (
    <div>
      <PageHeader
        title="Análisis por hora"
        description="Rueda horizontal: cómo se comporta históricamente una misma hora del día."
      />

      <div className="rounded-2xl border border-border bg-card p-4 mb-6">
        <div className="text-xs text-muted-foreground mb-2">Selecciona una hora</div>
        <div className="flex flex-wrap gap-1.5">
          {HORAS.map((h) => (
            <button
              key={h}
              onClick={() => setHora(h)}
              className={`px-3 h-9 rounded-md text-sm tabular-nums border ${h === hora ? "bg-foreground text-background border-foreground" : "bg-card border-border text-foreground hover:bg-accent"}`}
            >
              {h}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-card p-6">
          <h3 className="text-base font-semibold mb-4">
            Balance histórico — {hora}
          </h3>
          <div className="space-y-5">
            <BalanceBar leftLabel="ALTO" rightLabel="BAJO" leftValue={balance.altos} rightValue={balance.bajos} leftClass="bg-alto" rightClass="bg-bajo" />
            <BalanceBar leftLabel="PAR" rightLabel="IMPAR" leftValue={balance.pares} rightValue={balance.impares} leftClass="bg-par" rightClass="bg-impar" />
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Basado en {subset.length} sorteos en esta hora durante 30 días.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <h3 className="text-base font-semibold mb-4">Distribución por subcuadrante</h3>
          <div className="grid grid-cols-2 gap-3">
            {(Object.keys(distribucion) as Subcuadrante[]).map((k) => {
              const total = subset.length || 1;
              const pct = (distribucion[k] / total) * 100;
              return (
                <div key={k} className="rounded-xl border border-border p-4">
                  <div className="text-xs text-muted-foreground">{subcuadranteLabel[k]}</div>
                  <div className="mt-1 text-2xl font-semibold tabular-nums">
                    {distribucion[k]}
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-foreground" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                    {pct.toFixed(1)}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-6">
        <h3 className="text-base font-semibold mb-4">Patrones más comunes en esta hora</h3>
        <ul className="space-y-3 text-sm">
          {[
            { p: `En ${hora} domina ${balance.pctAltos > balance.pctBajos ? "ALTO" : "BAJO"}`, pct: Math.max(balance.pctAltos, balance.pctBajos) },
            { p: `Tendencia ${balance.pctPares > balance.pctImpares ? "PAR" : "IMPAR"}`, pct: Math.max(balance.pctPares, balance.pctImpares) },
            { p: "Subcuadrante más frecuente", pct: 0 },
          ].map((x, i) => (
            <li key={i} className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
              <span>{x.p}</span>
              {x.pct > 0 && <span className="font-semibold tabular-nums">{x.pct.toFixed(0)}%</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
