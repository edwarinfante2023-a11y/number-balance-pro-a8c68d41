import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { AltoBajoBadge, ParImparBadge, SubcuadranteBadge } from "@/components/ClassificationBadge";
import { classify, defaultConfig } from "@/lib/lottery";

export const Route = createFileRoute("/captura")({
  head: () => ({
    meta: [
      { title: "Captura manual — Cuadrante" },
      { name: "description", content: "Registra resultados manualmente con clasificación automática." },
    ],
  }),
  component: Captura,
});

function Captura() {
  const [numero, setNumero] = useState<string>("");
  const [hora, setHora] = useState<string>(new Date().toTimeString().slice(0, 5));
  const [loteria, setLoteria] = useState("Quiniela Diaria");
  const [observacion, setObservacion] = useState("");

  const n = parseInt(numero);
  const valid = !isNaN(n) && n >= defaultConfig.rangeMin && n <= defaultConfig.rangeMax;
  const c = valid ? classify(n) : null;

  return (
    <div>
      <PageHeader
        title="Captura manual"
        description="Ingresa un resultado y observa cómo se clasifica al instante con tus reglas."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setNumero("");
            setObservacion("");
          }}
          className="rounded-2xl border border-border bg-card p-6 space-y-4"
        >
          <Field label="Número">
            <input
              type="number"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              min={defaultConfig.rangeMin}
              max={defaultConfig.rangeMax}
              placeholder="00 - 99"
              className="w-full h-11 px-3 rounded-md border border-border bg-background text-lg font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Hora">
              <input
                type="time"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                className="w-full h-11 px-3 rounded-md border border-border bg-background tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </Field>
            <Field label="Lotería">
              <select
                value={loteria}
                onChange={(e) => setLoteria(e.target.value)}
                className="w-full h-11 px-3 rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option>Quiniela Diaria</option>
                <option>Sorteo Horario</option>
                <option>Tarde Express</option>
              </select>
            </Field>
          </div>
          <Field label="Observación (opcional)">
            <textarea
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              rows={3}
              placeholder="Notas, contexto, movimiento detectado..."
              className="w-full px-3 py-2 rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </Field>
          <button
            type="submit"
            disabled={!valid}
            className="w-full h-11 rounded-md bg-foreground text-background font-medium hover:opacity-90 disabled:opacity-40"
          >
            Registrar sorteo
          </button>
        </form>

        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Vista previa de clasificación
          </div>
          {valid && c ? (
            <div className="mt-4 space-y-5">
              <div className="text-center py-6 rounded-xl bg-muted">
                <div className="font-mono text-6xl font-bold tabular-nums">
                  {n.toString().padStart(2, "0")}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {hora} · {loteria}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                <AltoBajoBadge value={c.altoBajo} soft={false} />
                <ParImparBadge value={c.parImpar} soft={false} />
                <SubcuadranteBadge value={c.subcuadrante} />
              </div>
              <ul className="text-xs text-muted-foreground space-y-1.5">
                <li>• Umbral Alto/Bajo: ≥ {defaultConfig.altoThreshold}</li>
                <li>• Par/Impar evaluado por última cifra</li>
                <li>• Subcuadrante combinado automáticamente</li>
              </ul>
            </div>
          ) : (
            <div className="mt-4 text-sm text-muted-foreground">
              Ingresa un número válido entre {defaultConfig.rangeMin} y {defaultConfig.rangeMax} para
              ver la clasificación.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-foreground mb-1.5">{label}</div>
      {children}
    </label>
  );
}
