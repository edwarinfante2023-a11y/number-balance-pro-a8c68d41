import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { defaultConfig } from "@/lib/lottery";

export const Route = createFileRoute("/configuracion")({
  head: () => ({
    meta: [
      { title: "Configuración — Cuadrante" },
      { name: "description", content: "Reglas de clasificación, loterías, horarios y preparación para IA." },
    ],
  }),
  component: Configuracion,
});

function Configuracion() {
  const [rangeMin, setRangeMin] = useState(defaultConfig.rangeMin);
  const [rangeMax, setRangeMax] = useState(defaultConfig.rangeMax);
  const [threshold, setThreshold] = useState(defaultConfig.altoThreshold);
  const [loterias, setLoterias] = useState(["Quiniela Diaria", "Sorteo Horario", "Tarde Express"]);

  return (
    <div>
      <PageHeader
        title="Configuración"
        description="Ajusta las reglas de clasificación a tu método. Cambios futuros recalcularán automáticamente."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-card p-6">
          <h3 className="text-base font-semibold mb-4">Reglas de clasificación</h3>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Rango mínimo">
              <input
                type="number"
                value={rangeMin}
                onChange={(e) => setRangeMin(parseInt(e.target.value))}
                className="w-full h-10 px-3 rounded-md border border-border bg-background tabular-nums"
              />
            </Field>
            <Field label="Rango máximo">
              <input
                type="number"
                value={rangeMax}
                onChange={(e) => setRangeMax(parseInt(e.target.value))}
                className="w-full h-10 px-3 rounded-md border border-border bg-background tabular-nums"
              />
            </Field>
          </div>
          <div className="mt-4">
            <Field label={`Umbral ALTO/BAJO — números ≥ ${threshold} son ALTO`}>
              <input
                type="range"
                min={rangeMin}
                max={rangeMax}
                value={threshold}
                onChange={(e) => setThreshold(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums mt-1">
                <span>BAJO: {rangeMin}–{threshold - 1}</span>
                <span>ALTO: {threshold}–{rangeMax}</span>
              </div>
            </Field>
          </div>
          <div className="mt-5 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            Par/Impar se evalúa siempre por la última cifra del número.
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold">Loterías y horarios</h3>
            <button className="inline-flex items-center gap-1.5 h-8 rounded-md bg-foreground text-background px-2.5 text-xs font-medium">
              <Plus className="size-3.5" /> Añadir
            </button>
          </div>
          <ul className="space-y-2">
            {loterias.map((l) => (
              <li key={l} className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                <div>
                  <div className="font-medium text-sm">{l}</div>
                  <div className="text-[11px] text-muted-foreground">Cada hora · 09:00 – 21:00</div>
                </div>
                <button
                  onClick={() => setLoterias((arr) => arr.filter((x) => x !== l))}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-base font-semibold">Inteligencia artificial (próximamente)</h3>
            <span className="text-[10px] font-semibold uppercase tracking-wide bg-muted px-2 py-0.5 rounded-full">
              Beta
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            La IA futura analizará tu estilo de análisis para validar reglas, descubrir patrones nuevos y
            detectar comportamientos anómalos. <strong className="text-foreground">No será un chatbot</strong> —
            será un motor especializado entrenado sobre tu propio histórico.
          </p>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { t: "Validar reglas", d: "Mide efectividad real" },
              { t: "Descubrir patrones", d: "Hallazgos automáticos" },
              { t: "Detectar anomalías", d: "Comportamiento atípico" },
            ].map((c) => (
              <div key={c.t} className="rounded-lg border border-border p-3">
                <div className="font-medium text-sm">{c.t}</div>
                <div className="text-xs text-muted-foreground">{c.d}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs font-medium mb-1.5">{label}</div>
      {children}
    </label>
  );
}
