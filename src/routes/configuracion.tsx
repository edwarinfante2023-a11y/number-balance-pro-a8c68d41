import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Plus,
  Trash2,
  Loader2,
  Save,
  ChevronDown,
  ChevronRight,
  Clock,
  ShieldAlert,
  Cpu,
  Network,
  Sparkles,
  FolderTree,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { SyncLogsWidget } from "@/components/SyncLogsWidget";
import { useClassificationConfig, useUpdateClassificationConfig } from "@/hooks/useSettings";
import {
  useLotteries,
  useCreateLottery,
  useDeleteLottery,
  useCreateLotteryDraw,
  useDeleteLotteryDraw,
  type LotteryWithDraws,
} from "@/hooks/useLotteries";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/configuracion")({
  head: () => ({
    meta: [
      { title: "System Environment — Cuadrante" },
      {
        name: "description",
        content: "Core variables, network topology, and AI integration config.",
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
      toast.success("Core variables actualizadas.");
      setDraft(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error compilando config.");
    }
  }

  const [newLot, setNewLot] = useState("");
  async function addLottery(e: React.FormEvent) {
    e.preventDefault();
    if (!newLot.trim()) return;
    try {
      await createLottery.mutateAsync({ nombre: newLot.trim() });
      toast.success(`Red "${newLot.trim()}" inyectada.`);
      setNewLot("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Fatal error";
      toast.error(msg.includes("duplicate") ? "Colisión: Nodo de red ya existe" : msg);
    }
  }

  return (
    <div className="space-y-6 pt-2">
      <div className="mb-8">
        <h1 className="text-[32px] font-bold tracking-tight text-foreground">System Environment</h1>
        <p className="text-[15px] text-muted-foreground mt-1">
          Variables Core y Topología de Red. Alterar estos umbrales recalibra la entropía
          predictiva.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Core Rules Engine */}
        <div className="lg:col-span-7 bg-white rounded-[24px] lg:rounded-[32px] border border-border shadow-sm p-5 lg:p-8 relative overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-8 border-b border-border pb-6 relative z-10">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-primary/10 grid place-items-center">
                <Cpu className="size-5 text-primary" />
              </div>
              <div>
                <h3 className="text-[16px] font-bold text-foreground">Matrix Boundary Engine</h3>
                <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-widest mt-0.5">
                  Core Rules
                </p>
              </div>
            </div>
            {dirty && (
              <button
                onClick={save}
                disabled={updateCfg.isPending}
                className="inline-flex items-center gap-2 h-10 rounded-[12px] bg-primary text-white px-5 text-[13px] font-bold shadow-md disabled:opacity-50 hover:shadow-lg transition-all hover:-translate-y-0.5"
              >
                {updateCfg.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Confirmar
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="text-[13px] font-bold text-muted-foreground flex items-center justify-center py-10">
              <Loader2 className="size-5 animate-spin inline mr-3 text-primary" /> Cargando
              kernel...
            </div>
          ) : (
            <div className="relative z-10 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="MIN_RANGE (Floor)">
                  <input
                    type="number"
                    value={current.rangeMin}
                    onChange={(e) => patch({ rangeMin: parseInt(e.target.value || "0") })}
                    className="w-full h-14 px-5 rounded-[16px] bg-muted/50 border border-border text-[20px] font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all tabular-nums text-center shadow-inner"
                  />
                </Field>
                <Field label="MAX_RANGE (Ceil)">
                  <input
                    type="number"
                    value={current.rangeMax}
                    onChange={(e) => patch({ rangeMax: parseInt(e.target.value || "0") })}
                    className="w-full h-14 px-5 rounded-[16px] bg-muted/50 border border-border text-[20px] font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all tabular-nums text-center shadow-inner"
                  />
                </Field>
              </div>

              <div className="bg-muted/30 rounded-[20px] p-6 border border-border mt-6">
                <Field label={`OVERRIDE: LIMITER A/B (≥ ${current.altoThreshold})`}>
                  <input
                    type="range"
                    min={current.rangeMin}
                    max={current.rangeMax}
                    value={current.altoThreshold}
                    onChange={(e) => patch({ altoThreshold: parseInt(e.target.value) })}
                    className="w-full mt-6 style-range accent-primary h-2 bg-muted rounded-full appearance-none cursor-pointer"
                  />

                  <div className="flex justify-between text-[11px] font-bold text-muted-foreground tabular-nums mt-6 border-t border-border pt-4">
                    <span className="flex flex-col gap-1">
                      <span className="uppercase text-[10px] text-bajo tracking-widest drop-shadow-sm">
                        Bajo Vector
                      </span>
                      <span className="text-[14px]">
                        [{current.rangeMin} — {current.altoThreshold - 1}]
                      </span>
                    </span>
                    <span className="flex flex-col gap-1 text-right">
                      <span className="uppercase text-[10px] text-alto tracking-widest drop-shadow-sm">
                        Alto Vector
                      </span>
                      <span className="text-[14px]">
                        [{current.altoThreshold} — {current.rangeMax}]
                      </span>
                    </span>
                  </div>
                </Field>
              </div>

              <div className="mt-4 rounded-[16px] bg-warning/10 border border-warning/20 p-5 text-[13px] text-orange-800 font-medium flex gap-4 items-start shadow-sm">
                <ShieldAlert className="size-5 shrink-0 mt-0.5 text-warning" />
                <div className="leading-relaxed">
                  PAR/IMPAR se aisla computando el último dígito del buffer. Mutar el{" "}
                  <strong className="font-bold text-orange-900 border-b border-orange-900/30">
                    LIMITER A/B
                  </strong>{" "}
                  no recompila eventos pasados automáticamente. Requiere purgado manual.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Loterías y Sorteos Topology */}
        <div className="lg:col-span-5 bg-white rounded-[32px] border border-border shadow-sm p-8 relative flex flex-col h-full max-h-[800px]">
          <div className="flex items-center justify-between mb-8 border-b border-border pb-6 relative z-10 shrink-0">
            <div>
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-primary/10 grid place-items-center">
                  <Network className="size-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-[16px] font-bold text-foreground">Network Topology</h3>
                  <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-widest mt-0.5">
                    Nodos y Bloques
                  </p>
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={addLottery} className="flex gap-3 mb-6 shrink-0">
            <input
              value={newLot}
              onChange={(e) => setNewLot(e.target.value)}
              placeholder="Añadir Lotería..."
              className="flex-1 h-12 px-5 rounded-[16px] bg-muted/50 border border-border text-[14px] font-bold text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-inner"
            />
            <button
              type="submit"
              disabled={!newLot.trim() || createLottery.isPending}
              className="inline-flex items-center justify-center size-12 rounded-[16px] bg-foreground text-background disabled:opacity-30 hover:bg-muted-foreground transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
            >
              {createLottery.isPending ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Plus className="size-5" />
              )}
            </button>
          </form>

          <ul className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {lotteries.length === 0 && (
              <li className="text-[12px] font-bold text-muted-foreground/50 text-center py-16 uppercase border-2 border-dashed border-border rounded-[20px]">
                Topología vacía
              </li>
            )}
            {lotteries.map((l) => (
              <LotteryItem
                key={l.id}
                lottery={l}
                onDelete={async () => {
                  if (
                    !confirm(
                      `[WARNING] Destruir nodo "${l.nombre}" purgará sus ${l.draws.length} bloques horarios dependientes. ¿Confirmar?`,
                    )
                  )
                    return;
                  await deleteLottery.mutateAsync(l.id);
                  toast.success("Nodo Purge completado");
                }}
              />
            ))}
          </ul>
        </div>

        {/* Sync Logs Widget */}
        <div className="lg:col-span-12">
          <SyncLogsWidget />
        </div>

        {/* AI Upcoming Banner */}
        <div className="lg:col-span-12 surface-hero-green rounded-[32px] p-8 lg:p-10 relative overflow-hidden shadow-[0_12px_40px_oklch(0.42_0.09_155/0.2)]">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/10 rounded-full blur-[80px] pointer-events-none -translate-y-1/2 translate-x-1/3" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="max-w-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="size-12 rounded-full bg-white/20 backdrop-blur-md grid place-items-center border border-white/20">
                  <Sparkles className="size-6 text-white" />
                </div>
                <div>
                  <h3 className="text-[24px] font-bold tracking-tight text-white leading-none">
                    Motor Neuronal Predictivo
                  </h3>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="size-2 rounded-full bg-white animate-pulse" />
                    <span className="text-[12px] font-bold uppercase tracking-[0.2em] text-white/80">
                      Coming Soon
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-[14px] text-white/80 leading-relaxed font-medium mt-3">
                El core AI analizará todo tu historial (matriz X/Y) para someter tus reglas a estrés
                algorítmico, revelando vectores anómalos ocultos y prediciendo asimetrías con rangos
                de confianza explícitos. No es un chatbot, es matemáticas puras.
              </p>
            </div>

            <div className="shrink-0 grid grid-cols-1 sm:grid-cols-3 gap-3 w-full md:w-auto">
              {[
                { t: "Cross-Validation", d: "Testea efectividad" },
                { t: "Deep Patterns", d: "Vectorización" },
                { t: "Anomaly Shield", d: "Desviación" },
              ].map((c) => (
                <div
                  key={c.t}
                  className="rounded-[16px] bg-white/10 backdrop-blur-md border border-white/20 p-4 shadow-inner"
                >
                  <div className="font-bold text-[13px] text-white">{c.t}</div>
                  <div className="text-[11px] font-medium text-white/60 mt-1">{c.d}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LotteryItem({ lottery, onDelete }: { lottery: LotteryWithDraws; onDelete: () => void }) {
  const [open, setOpen] = useState(true);
  const [hora, setHora] = useState("");
  const createDraw = useCreateLotteryDraw();
  const deleteDraw = useDeleteLotteryDraw();

  async function addDraw(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{2}:\d{2}$/.test(hora)) {
      toast.error("Formato inválido (HH:MM)");
      return;
    }
    try {
      await createDraw.mutateAsync({
        loteria_id: lottery.id,
        hora,
        nombre: `Block ${hora}`,
      });
      toast.success(`Añadido ${hora} a ${lottery.nombre}`);
      setHora("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error";
      toast.error(msg.includes("duplicate") ? "Colisión: Bloque ya existe" : msg);
    }
  }

  return (
    <li className="rounded-[20px] border border-border bg-white shadow-sm overflow-hidden group">
      <div
        className="flex items-center justify-between px-5 py-4 bg-white hover:bg-muted/30 transition-colors border-b border-transparent data-[state=open]:border-border cursor-pointer select-none"
        data-state={open ? "open" : "closed"}
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-4 flex-1">
          <div className="size-8 rounded-[8px] bg-muted flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors group-hover:bg-primary/10">
            {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </div>
          <div>
            <div className="font-bold text-[15px] text-foreground">{lottery.nombre}</div>
            <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">
              {lottery.draws.length} bloques enlazados
            </div>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="size-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-white hover:bg-destructive transition-colors shrink-0"
          aria-label="Root purge"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      {open && (
        <div className="p-5 bg-muted/20">
          <form onSubmit={addDraw} className="flex gap-2 mb-5">
            <input
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              className="h-10 px-4 rounded-[12px] border border-border bg-white text-[14px] font-bold tabular-nums text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm flex-1 min-w-[100px]"
            />
            <button
              type="submit"
              disabled={!hora || createDraw.isPending}
              className="inline-flex items-center justify-center h-10 px-5 rounded-[12px] bg-primary text-white text-[12px] font-bold shadow-md hover:shadow-lg disabled:opacity-50 hover:-translate-y-0.5 transition-all"
            >
              {createDraw.isPending ? <Loader2 className="size-4 animate-spin" /> : "Vincular"}
            </button>
          </form>

          {lottery.draws.length === 0 ? (
            <div className="text-[12px] font-bold text-muted-foreground/50 py-4 text-center border-2 border-dashed border-border rounded-[12px]">
              No hay horarios vinculados.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {lottery.draws.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between rounded-[12px] bg-white border border-border px-4 py-3 hover:border-primary/30 transition-colors shadow-sm"
                >
                  <div className="flex items-center gap-2.5">
                    <Clock className="size-4 text-primary/70 shrink-0" />
                    <span className="font-extrabold text-[14px] tabular-nums text-foreground">
                      {d.hora}
                    </span>
                  </div>
                  <button
                    onClick={async () => {
                      if (!confirm(`Desenlace de ${d.hora}?`)) return;
                      await deleteDraw.mutateAsync(d.id);
                      toast.success("Bloque eliminado");
                    }}
                    className="text-muted-foreground/40 hover:text-destructive transition-colors ml-2"
                  >
                    <Trash2 className="size-4" />
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
    <div className="flex flex-col gap-2.5">
      <label className="text-[12px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
