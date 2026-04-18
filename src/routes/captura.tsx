import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { AltoBajoBadge, ParImparBadge, SubcuadranteBadge } from "@/components/ClassificationBadge";
import { classify } from "@/lib/lottery";
import { useCreateDraw } from "@/hooks/useDraws";
import { useClassificationConfig } from "@/hooks/useSettings";
import { useLotteries } from "@/hooks/useLotteries";
import { toast } from "sonner";

export const Route = createFileRoute("/captura")({
  head: () => ({
    meta: [
      { title: "Captura manual — Cuadrante" },
      { name: "description", content: "Registra resultados manualmente con clasificación automática." },
    ],
  }),
  component: Captura,
});

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function Captura() {
  const { data: cfg } = useClassificationConfig();
  const { data: lotteries = [] } = useLotteries();
  const createDraw = useCreateDraw();

  const [numero, setNumero] = useState<string>("");
  const [fecha, setFecha] = useState<string>(todayStr());
  const [hora, setHora] = useState<string>(new Date().toTimeString().slice(0, 5));
  const [loteria, setLoteria] = useState("");
  const [observacion, setObservacion] = useState("");

  // Pick first lottery once loaded
  if (!loteria && lotteries[0]) setLoteria(lotteries[0].nombre);

  const config = cfg ?? { rangeMin: 0, rangeMax: 99, altoThreshold: 50 };
  const n = parseInt(numero);
  const valid = !isNaN(n) && n >= config.rangeMin && n <= config.rangeMax;
  const c = valid ? classify(n, config) : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || !loteria) return;
    try {
      await createDraw.mutateAsync({
        fecha,
        hora,
        loteria,
        numero: n,
        observacion: observacion.trim() || undefined,
      });
      toast.success(`Sorteo registrado: ${n.toString().padStart(2, "0")} (${c?.subcuadrante})`);
      setNumero("");
      setObservacion("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al guardar";
      if (msg.includes("duplicate") || msg.includes("unique")) {
        toast.error("Ya existe un sorteo para esa fecha, hora y lotería.");
      } else {
        toast.error(msg);
      }
    }
  }

  return (
    <div>
      <PageHeader
        title="Captura manual"
        description="Ingresa un resultado y observa cómo se clasifica al instante con tus reglas."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <Field label="Número">
            <input
              type="number"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              min={config.rangeMin}
              max={config.rangeMax}
              placeholder={`${config.rangeMin} - ${config.rangeMax}`}
              className="w-full h-11 px-3 rounded-md border border-border bg-background text-lg font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha">
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full h-11 px-3 rounded-md border border-border bg-background tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </Field>
            <Field label="Hora">
              <input
                type="time"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                className="w-full h-11 px-3 rounded-md border border-border bg-background tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </Field>
          </div>
          <Field label="Lotería">
            <select
              value={loteria}
              onChange={(e) => setLoteria(e.target.value)}
              className="w-full h-11 px-3 rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {lotteries.length === 0 && <option value="">Cargando...</option>}
              {lotteries.map((l) => (
                <option key={l.id} value={l.nombre}>
                  {l.nombre}
                </option>
              ))}
            </select>
          </Field>
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
            disabled={!valid || !loteria || createDraw.isPending}
            className="w-full h-11 rounded-md bg-foreground text-background font-medium hover:opacity-90 disabled:opacity-40 inline-flex items-center justify-center gap-2"
          >
            {createDraw.isPending && <Loader2 className="size-4 animate-spin" />}
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
                  {fecha} · {hora} · {loteria || "—"}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                <AltoBajoBadge value={c.altoBajo} soft={false} />
                <ParImparBadge value={c.parImpar} soft={false} />
                <SubcuadranteBadge value={c.subcuadrante} />
              </div>
              <ul className="text-xs text-muted-foreground space-y-1.5">
                <li>• Umbral Alto/Bajo: ≥ {config.altoThreshold}</li>
                <li>• Par/Impar evaluado por última cifra</li>
                <li>• Subcuadrante combinado automáticamente</li>
              </ul>
            </div>
          ) : (
            <div className="mt-4 text-sm text-muted-foreground">
              Ingresa un número válido entre {config.rangeMin} y {config.rangeMax} para
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
