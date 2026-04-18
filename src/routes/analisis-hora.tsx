import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { computeBalance, subcuadranteLabel } from "@/lib/lottery";
import type { Subcuadrante } from "@/lib/lottery";
import { BalanceBar } from "@/components/BalanceBar";
import { useDraws } from "@/hooks/useDraws";
import { drawToSorteo } from "@/lib/drawAdapter";

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
  const { data: draws = [], isLoading } = useDraws({ limit: 5000 });
  const all = useMemo(() => draws.map(drawToSorteo), [draws]);

  // Detectar horas presentes en BD; fallback al set fijo
  const horasDisponibles = useMemo(() => {
    const set = new Set(all.map((s) => s.hora));
    const found = Array.from(set).sort();
    return found.length > 0 ? found : HORAS;
  }, [all]);

  const [hora, setHora] = useState<string>(() => "13:00");
  const horaActiva = horasDisponibles.includes(hora) ? hora : (horasDisponibles[0] ?? "13:00");

  const subset = useMemo(() => all.filter((s) => s.hora === horaActiva), [all, horaActiva]);
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

  if (isLoading) {
    return (
      <div className="grid place-items-center py-24 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Análisis por hora"
        description="Rueda horizontal: cómo se comporta históricamente una misma hora del día."
      />

      <div className="rounded-2xl border border-border bg-card p-4 mb-6">
        <div className="text-xs text-muted-foreground mb-2">Selecciona una hora</div>
        <div className="flex flex-wrap gap-1.5">
          {horasDisponibles.map((h) => (
            <button
              key={h}
              onClick={() => setHora(h)}
              className={`px-3 h-9 rounded-md text-sm tabular-nums border ${h === horaActiva ? "bg-foreground text-background border-foreground" : "bg-card border-border text-foreground hover:bg-accent"}`}
            >
              {h}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-card p-6">
          <h3 className="text-base font-semibold mb-4">
            Balance histórico — {horaActiva}
          </h3>
          {subset.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin sorteos en esta hora todavía.</p>
          ) : (
            <>
              <div className="space-y-5">
                <BalanceBar leftLabel="ALTO" rightLabel="BAJO" leftValue={balance.altos} rightValue={balance.bajos} leftClass="bg-alto" rightClass="bg-bajo" />
                <BalanceBar leftLabel="PAR" rightLabel="IMPAR" leftValue={balance.pares} rightValue={balance.impares} leftClass="bg-par" rightClass="bg-impar" />
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Basado en {subset.length} sorteos en esta hora.
              </p>
            </>
          )}
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

      {subset.length > 0 && (
        <div className="mt-6 rounded-2xl border border-border bg-card p-6">
          <h3 className="text-base font-semibold mb-4">Patrones más comunes en esta hora</h3>
          <ul className="space-y-3 text-sm">
            <li className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
              <span>En {horaActiva} domina {balance.pctAltos > balance.pctBajos ? "ALTO" : "BAJO"}</span>
              <span className="font-semibold tabular-nums">{Math.max(balance.pctAltos, balance.pctBajos).toFixed(0)}%</span>
            </li>
            <li className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
              <span>Tendencia {balance.pctPares > balance.pctImpares ? "PAR" : "IMPAR"}</span>
              <span className="font-semibold tabular-nums">{Math.max(balance.pctPares, balance.pctImpares).toFixed(0)}%</span>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
