import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, TerminalSquare, Settings2, ShieldCheck, DatabaseZap } from "lucide-react";
import { AltoBajoBadge, ParImparBadge, SubcuadranteBadge } from "@/components/ClassificationBadge";
import { classify } from "@/lib/lottery";
import { useCreateDraw } from "@/hooks/useDraws";
import { useClassificationConfig } from "@/hooks/useSettings";
import { useLotteries } from "@/hooks/useLotteries";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/captura")({
  head: () => ({
    meta: [
      { title: "Captura Manual — Cuadrante" },
      {
        name: "description",
        content: "Registra resultados manualmente con clasificación automática.",
      },
    ],
  }),
  component: Captura,
});

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function Captura() {
  const { data: cfg } = useClassificationConfig();
  const { data: lotteries = [] } = useLotteries();
  const createDraw = useCreateDraw();

  const [numero, setNumero] = useState<string>("");
  const [fecha, setFecha] = useState<string>(todayStr());
  const [loteriaId, setLoteriaId] = useState<string>("");
  const [sorteoId, setSorteoId] = useState<string>("");
  const [observacion, setObservacion] = useState("");

  // Auto-seleccionar la primera lotería disponible
  useEffect(() => {
    if (!loteriaId && lotteries[0]) setLoteriaId(lotteries[0].id);
  }, [loteriaId, lotteries]);

  const loteriaSel = useMemo(
    () => lotteries.find((l) => l.id === loteriaId),
    [lotteries, loteriaId],
  );

  // Auto-seleccionar el primer sorteo de la lotería actual
  useEffect(() => {
    if (loteriaSel && (!sorteoId || !loteriaSel.draws.find((d) => d.id === sorteoId))) {
      setSorteoId(loteriaSel.draws[0]?.id ?? "");
    }
  }, [loteriaSel, sorteoId]);

  const sorteoSel = useMemo(
    () => loteriaSel?.draws.find((d) => d.id === sorteoId),
    [loteriaSel, sorteoId],
  );

  const config = cfg ?? { rangeMin: 0, rangeMax: 99, altoThreshold: 50 };
  const n = parseInt(numero);
  const valid = !isNaN(n) && n >= config.rangeMin && n <= config.rangeMax;
  const c = valid ? classify(n, config) : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || !sorteoId) return;
    try {
      await createDraw.mutateAsync({
        sorteo_id: sorteoId,
        fecha,
        numero: n,
        observacion: observacion.trim() || undefined,
      });
      toast.success(
        `Payload insertado: ${n.toString().padStart(2, "0")} (${c?.subcuadrante})`
      );
      setNumero("");
      setObservacion("");
      
      // Auto focus on number input after success
      document.getElementById('input-numero')?.focus();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Fallo de inserción";
      if (msg.includes("duplicate") || msg.includes("unique")) {
        toast.error("Colisión detectada: Matriz ya registrada en ese horario.");
      } else {
        toast.error(msg);
      }
    }
  }

  return (
    <div className="space-y-6 pt-2">
      <div className="mb-8">
         <h1 className="text-[32px] font-bold tracking-tight text-foreground">Captura Manual</h1>
         <p className="text-[15px] text-muted-foreground mt-1">Terminal de captura directa. El clasificador evalúa el input en tiempo real aplicando los umbrales configurados.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Lado del Formulario (7 columnas) */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-7 bg-white rounded-[32px] p-8 lg:p-10 border border-border shadow-sm flex flex-col relative"
        >
          <div className="flex items-center gap-3 mb-8 border-b border-border pb-6">
             <div className="size-10 rounded-xl bg-primary/10 grid place-items-center">
               <TerminalSquare className="size-5 text-primary" />
             </div>
             <div>
               <h3 className="text-[16px] font-bold text-foreground">Consola de Inserción</h3>
               <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-widest mt-0.5">Entrada Numérica</p>
             </div>
          </div>

          <div className="space-y-6 flex-1 relative z-10">
            <Field label="Target Value (Número)">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                  <span className="text-primary/70 font-mono text-xl font-bold">{">"}</span>
                </div>
                <input
                  id="input-numero"
                  type="number"
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  min={config.rangeMin}
                  max={config.rangeMax}
                  placeholder={`Rango ${config.rangeMin}-${config.rangeMax}`}
                  className="w-full h-16 pl-14 pr-5 rounded-[16px] border border-border bg-muted/50 text-[28px] font-extrabold text-foreground tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-inner placeholder:text-muted-foreground/30"
                  autoFocus
                />
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-5">
               <Field label="Timestamp (Fecha)">
                 <input
                   type="date"
                   value={fecha}
                   onChange={(e) => setFecha(e.target.value)}
                   className="w-full h-14 px-5 rounded-[16px] border border-border bg-muted/50 text-[14px] font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-inner"
                 />
               </Field>
               
               <Field label="Network (Lotería)">
                 <select
                   value={loteriaId}
                   onChange={(e) => setLoteriaId(e.target.value)}
                   className="w-full h-14 px-5 rounded-[16px] border border-border bg-muted/50 text-[14px] font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-inner appearance-none cursor-pointer"
                 >
                   {lotteries.length === 0 && <option value="">Montando redes...</option>}
                   {lotteries.map((l) => (
                     <option key={l.id} value={l.id}>
                       {l.nombre}
                     </option>
                   ))}
                 </select>
               </Field>
            </div>

            <Field label="Bloque Horario">
               <select
                 value={sorteoId}
                 onChange={(e) => setSorteoId(e.target.value)}
                 disabled={!loteriaSel || loteriaSel.draws.length === 0}
                 className="w-full h-14 px-5 rounded-[16px] border border-border bg-muted/50 text-[14px] font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-inner disabled:opacity-50 appearance-none cursor-pointer"
               >
                 {(!loteriaSel || loteriaSel.draws.length === 0) && (
                   <option value="">Falta de eventos</option>
                 )}
                 {loteriaSel?.draws.map((d) => (
                   <option key={d.id} value={d.id}>
                     {d.hora} — {d.nombre}
                   </option>
                 ))}
               </select>
            </Field>

            <Field label="Metadata Adjunta (Opcional)">
              <textarea
                value={observacion}
                onChange={(e) => setObservacion(e.target.value)}
                rows={2}
                placeholder="Notas operativas, tags, anomalías..."
                className="w-full px-5 py-4 rounded-[16px] border border-border bg-muted/50 text-[14px] font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-inner resize-none placeholder:text-muted-foreground/40"
              />
            </Field>
          </div>

          <button
            type="submit"
            disabled={!valid || !sorteoId || createDraw.isPending}
            className="mt-8 w-full h-[60px] rounded-[16px] bg-primary text-[15px] font-bold uppercase tracking-widest text-white hover:bg-primary/90 transition-all duration-300 disabled:opacity-30 disabled:hover:bg-primary disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-md hover:shadow-lg hover:-translate-y-0.5"
          >
            {createDraw.isPending ? (
               <Loader2 className="size-5 animate-spin" />
            ) : (
               <>
                 <DatabaseZap className="size-5" />
                 Inyectar al sistema
               </>
            )}
          </button>
        </form>

        {/* Lado Prevista (5 columnas) */}
        <div className="lg:col-span-5 bg-white rounded-[32px] p-8 lg:p-10 border border-border shadow-sm flex flex-col relative overflow-hidden group">
          {/* Animación radial background si es válido */}
          <div className={cn(
             "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-[80px] pointer-events-none transition-all duration-1000",
             valid ? "size-[500px] bg-primary/5 scale-100 opacity-100" : "size-[0px] bg-transparent scale-50 opacity-0"
          )} />
          
          <div className="flex items-center gap-3 mb-8 border-b border-border pb-6 relative z-10">
             <div className="size-10 rounded-xl bg-primary/10 grid place-items-center">
               <Settings2 className="size-5 text-primary" />
             </div>
             <div>
               <h3 className="text-[16px] font-bold text-foreground">Evaluador Lógico</h3>
               <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-widest mt-0.5">Clasificación</p>
             </div>
          </div>

          <div className="flex-1 flex flex-col relative z-10 w-full">
             {valid && c ? (
               <div className="flex-1 flex flex-col animate-fade-in">
                 <div className="p-10 text-center bg-white border border-border rounded-[24px] shadow-sm relative overflow-hidden mb-8">
                   <div className="text-[120px] font-mono font-extrabold leading-none tabular-nums text-foreground drop-shadow-sm transition-transform duration-300 hover:scale-105">
                     {n.toString().padStart(2, "0")}
                   </div>
                   <div className="mt-6 flex items-center justify-center gap-3 text-[12px] font-bold tracking-widest text-muted-foreground uppercase">
                     <span>{fecha}</span>
                     <span className="size-1.5 rounded-full bg-primary" />
                     <span>{sorteoSel ? sorteoSel.hora : "—"}</span>
                   </div>
                 </div>

                 <div className="flex flex-wrap gap-4 justify-center mb-10 border-t border-b border-border py-8 bg-muted/10">
                   <div className="scale-110">
                     <AltoBajoBadge value={c.altoBajo} />
                   </div>
                   <div className="scale-110">
                     <ParImparBadge value={c.parImpar} />
                   </div>
                   <div className="scale-110">
                     <SubcuadranteBadge value={c.subcuadrante} />
                   </div>
                 </div>

                 <div className="mt-auto bg-emerald-50/50 rounded-[20px] border border-emerald-100 p-6">
                    <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.2em] text-emerald-700 mb-4">
                       <ShieldCheck className="size-4" /> Specs Mapeadas
                    </div>
                    <ul className="text-[13px] text-emerald-800/80 font-medium space-y-3">
                      <li className="flex items-center gap-3">
                         <span className="text-emerald-500 font-bold">{">"}</span> 
                         Umbral Alto/Bajo cruzado: &ge; {config.altoThreshold}
                      </li>
                      <li className="flex items-center gap-3">
                         <span className="text-emerald-500 font-bold">{">"}</span> 
                         Paridad matemática extraída de arr[n]
                      </li>
                      <li className="flex items-center gap-3">
                         <span className="text-emerald-500 font-bold">{">"}</span> 
                         Subcuadrante consolidado <strong className="font-bold text-emerald-700 ml-1">{c.subcuadrante.replace("_", "")}</strong>
                      </li>
                    </ul>
                 </div>
               </div>
             ) : (
               <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-muted/30 rounded-[24px] border border-dashed border-border flex-grow">
                 <div className="size-20 rounded-[20px] bg-white shadow-sm border border-border grid place-items-center mb-6">
                    <span className="font-mono text-3xl font-bold text-muted-foreground/30">00</span>
                 </div>
                 <div className="text-[16px] font-bold text-foreground mb-2">
                   Esperando Entidad
                 </div>
                 <div className="text-[13px] text-muted-foreground leading-relaxed max-w-[250px]">
                   Aplica un valor en el rango global [{config.rangeMin} - {config.rangeMax}] para disparar el motor.
                 </div>
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
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
