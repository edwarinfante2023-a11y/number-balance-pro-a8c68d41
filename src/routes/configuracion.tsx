import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2, Loader2, Save, ChevronDown, ChevronRight, Clock } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import {
  useClassificationConfig,
  useUpdateClassificationConfig,
} from "@/hooks/useSettings";
import {
  useLotteries,
  useCreateLottery,
  useDeleteLottery,
  useCreateLotteryDraw,
  useDeleteLotteryDraw,
  type LotteryWithDraws,
} from "@/hooks/useLotteries";
import { toast } from "sonner";

export const Route = createFileRoute("/configuracion")({
  head: () => ({
    meta: [
      { title: "Configuración — Cuadrante" },
      {
        name: "description",
        content: "Reglas de clasificación, loterías, horarios y preparación para IA.",
      },
    ],
  }),
  component: Configuracion,
});

function Configuracion() {
  const { data: cfg, isLoading } = useClassificationConfig();
  const updateCfg = useUpdateClassificationConfig();
  const { data: lotteries = [] } = useLotteries();
  const createLottery = useCreateLottery();
  const deleteLottery = useDeleteLottery();

  const [draft, setDraft] = useState<{
    rangeMin: number;
    rangeMax: number;
    altoThreshold: number;
  } | null>(null);
  const current = draft ?? cfg ?? { rangeMin: 0, rangeMax: 99, altoThreshold: 50 };
  const dirty =
    draft !== null &&
    cfg !== undefined &&
    (draft.rangeMin !== cfg.rangeMin ||
      draft.rangeMax !== cfg.rangeMax ||
      draft.altoThreshold !== cfg.altoThreshold);

  function patch(p: Partial<typeof current>) {
    setDraft({ ...current, ...p });
  }

  async function save() {
    if (!draft) return;
    try {
      await updateCfg.mutateAsync(draft);
      toast.success("Configuración guardada");
      setDraft(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    }
  }

  const [newLot, setNewLot] = useState("");
  async function addLottery(e: React.FormEvent) {
    e.preventDefault();
    if (!newLot.trim()) return;
    try {
      await createLottery.mutateAsync({ nombre: newLot.trim() });
      toast.success(`Lotería "${newLot.trim()}" añadida`);
      setNewLot("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error";
      toast.error(msg.includes("duplicate") ? "Esa lotería ya existe" : msg);
    }
  }

  return (
    <div>
      <PageHeader
        title="Configuración"
        description="Ajusta las reglas de clasificación a tu método. Cambios futuros recalcularán automáticamente."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold">Reglas de clasificación</h3>
            {dirty && (
              <button
                onClick={save}
                disabled={updateCfg.isPending}
                className="inline-flex items-center gap-1.5 h-8 rounded-md bg-foreground text-background px-3 text-xs font-medium disabled:opacity-50"
              >
                {updateCfg.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Save className="size-3.5" />
                )}
                Guardar
              </button>
            )}
          </div>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin inline mr-2" /> Cargando...
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Rango mínimo">
                  <input
                    type="number"
                    value={current.rangeMin}
                    onChange={(e) => patch({ rangeMin: parseInt(e.target.value || "0") })}
                    className="w-full h-10 px-3 rounded-md border border-border bg-background tabular-nums"
                  />
                </Field>
                <Field label="Rango máximo">
                  <input
                    type="number"
                    value={current.rangeMax}
                    onChange={(e) => patch({ rangeMax: parseInt(e.target.value || "0") })}
                    className="w-full h-10 px-3 rounded-md border border-border bg-background tabular-nums"
                  />
                </Field>
              </div>
              <div className="mt-4">
                <Field
                  label={`Umbral ALTO/BAJO — números ≥ ${current.altoThreshold} son ALTO`}
                >
                  <input
                    type="range"
                    min={current.rangeMin}
                    max={current.rangeMax}
                    value={current.altoThreshold}
                    onChange={(e) => patch({ altoThreshold: parseInt(e.target.value) })}
                    className="w-full"
                  />
                  <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums mt-1">
                    <span>
                      BAJO: {current.rangeMin}–{current.altoThreshold - 1}
                    </span>
                    <span>
                      ALTO: {current.altoThreshold}–{current.rangeMax}
                    </span>
                  </div>
                </Field>
              </div>
              <div className="mt-5 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                Par/Impar se evalúa siempre por la última cifra del número. Cambiar el umbral
                <strong className="text-foreground"> no recalcula sorteos pasados</strong>{" "}
                automáticamente todavía.
              </div>
            </>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold">Loterías y sorteos por horario</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Cada lotería madre agrupa sus sorteos por horario.
              </p>
            </div>
          </div>
          <form onSubmit={addLottery} className="flex gap-2 mb-4">
            <input
              value={newLot}
              onChange={(e) => setNewLot(e.target.value)}
              placeholder="Nombre de la lotería madre (ej. Anguila)"
              className="flex-1 h-9 px-3 rounded-md border border-border bg-background text-sm"
            />
            <button
              type="submit"
              disabled={!newLot.trim() || createLottery.isPending}
              className="inline-flex items-center gap-1.5 h-9 rounded-md bg-foreground text-background px-3 text-xs font-medium disabled:opacity-50"
            >
              {createLottery.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Plus className="size-3.5" />
              )}
              Añadir
            </button>
          </form>
          <ul className="space-y-2">
            {lotteries.length === 0 && (
              <li className="text-sm text-muted-foreground">Sin loterías activas.</li>
            )}
            {lotteries.map((l) => (
              <LotteryItem
                key={l.id}
                lottery={l}
                onDelete={async () => {
                  if (
                    !confirm(
                      `¿Desactivar "${l.nombre}"? Sus ${l.draws.length} sorteos también se desactivarán.`,
                    )
                  )
                    return;
                  await deleteLottery.mutateAsync(l.id);
                  toast.success("Lotería desactivada");
                }}
              />
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
            La IA futura analizará tu estilo de análisis para validar reglas, descubrir patrones
            nuevos y detectar comportamientos anómalos.{" "}
            <strong className="text-foreground">No será un chatbot</strong> — será un motor
            especializado entrenado sobre tu propio histórico.
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

function LotteryItem({
  lottery,
  onDelete,
}: {
  lottery: LotteryWithDraws;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [hora, setHora] = useState("");
  const createDraw = useCreateLotteryDraw();
  const deleteDraw = useDeleteLotteryDraw();

  async function addDraw(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{2}:\d{2}$/.test(hora)) {
      toast.error("Hora inválida (formato HH:MM)");
      return;
    }
    try {
      await createDraw.mutateAsync({
        loteria_id: lottery.id,
        hora,
        nombre: `${lottery.nombre} ${hora}`,
      });
      toast.success(`Sorteo ${hora} añadido`);
      setHora("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error";
      toast.error(msg.includes("duplicate") ? "Ese horario ya existe" : msg);
    }
  }

  return (
    <li className="rounded-lg border border-border overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 bg-muted/30">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 flex-1 text-left"
        >
          {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          <div>
            <div className="font-medium text-sm">{lottery.nombre}</div>
            <div className="text-[11px] text-muted-foreground">
              {lottery.draws.length} sorteo{lottery.draws.length === 1 ? "" : "s"}
              {lottery.draws.length > 0 &&
                ` · ${lottery.draws[0].hora} – ${lottery.draws[lottery.draws.length - 1].hora}`}
            </div>
          </div>
        </button>
        <button
          onClick={onDelete}
          className="text-muted-foreground hover:text-destructive"
          aria-label="Eliminar lotería"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      {open && (
        <div className="p-3 space-y-3">
          <form onSubmit={addDraw} className="flex gap-2">
            <input
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              className="h-8 px-2 rounded-md border border-border bg-background text-xs tabular-nums"
            />
            <button
              type="submit"
              disabled={!hora || createDraw.isPending}
              className="inline-flex items-center gap-1 h-8 rounded-md bg-foreground text-background px-2.5 text-xs font-medium disabled:opacity-50"
            >
              {createDraw.isPending ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Plus className="size-3" />
              )}
              Añadir sorteo
            </button>
          </form>

          {lottery.draws.length === 0 ? (
            <div className="text-xs text-muted-foreground py-2">
              Aún no hay sorteos. Añade uno por horario.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {lottery.draws.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between rounded-md border border-border px-2 py-1.5 text-xs"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Clock className="size-3 text-muted-foreground shrink-0" />
                    <span className="font-mono tabular-nums">{d.hora}</span>
                  </div>
                  <button
                    onClick={async () => {
                      if (!confirm(`¿Eliminar sorteo de las ${d.hora}?`)) return;
                      await deleteDraw.mutateAsync(d.id);
                      toast.success("Sorteo eliminado");
                    }}
                    className="text-muted-foreground hover:text-destructive ml-1"
                    aria-label="Eliminar sorteo"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </li>
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
