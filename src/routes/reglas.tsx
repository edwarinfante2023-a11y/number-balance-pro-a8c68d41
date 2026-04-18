import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Power, Pencil, DatabaseZap } from "lucide-react";
import { cn } from "@/lib/utils";

interface Regla {
  id: string;
  nombre: string;
  condicion: string;
  consecuencia: string;
  efectividad: number;
  activa: boolean;
  tipo: "Racha" | "Equilibrio" | "Cuadrante" | "Patrón";
}

const REGLAS: Regla[] = [
  { id: "1", nombre: "Ruptura tras 3 altos", condicion: "3 ALTOS consecutivos", consecuencia: "Próximo: BAJO", efectividad: 72, activa: true, tipo: "Racha" },
  { id: "2", nombre: "Compensación par/impar", condicion: "PAR + PAR", consecuencia: "Próximo: IMPAR", efectividad: 65, activa: true, tipo: "Equilibrio" },
  { id: "3", nombre: "Ruptura de cuadrante", condicion: "2× mismo subcuadrante", consecuencia: "Cambio de cuadrante", efectividad: 58, activa: true, tipo: "Cuadrante" },
  { id: "4", nombre: "Exceso de impares", condicion: "≥ 65% impares en 10 sorteos", consecuencia: "Compensación con PAR", efectividad: 70, activa: false, tipo: "Equilibrio" },
  { id: "5", nombre: "Bloqueo de Alto Par", condicion: "Alto Par dominante 4 horas", consecuencia: "Posible Bajo Impar", efectividad: 61, activa: true, tipo: "Patrón" },
];

export const Route = createFileRoute("/reglas")({
  head: () => ({
    meta: [
      { title: "Reglas Lógicas — Cuadrante" },
      { name: "description", content: "Define, mide y activa tus propias reglas de análisis predictivo." },
    ],
  }),
  component: Reglas,
});

function Reglas() {
  const [items, setItems] = useState(REGLAS);
  const toggle = (id: string) =>
    setItems((arr) => arr.map((r) => (r.id === id ? { ...r, activa: !r.activa } : r)));

  return (
    <div className="space-y-6 pt-2">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
         <div>
           <h1 className="text-[32px] font-bold tracking-tight text-foreground">Reglas Lógicas</h1>
           <p className="text-[15px] text-muted-foreground mt-1 max-w-xl">Leyes del sistema. Cada módulo evalúa su efectividad predictiva analizando la entropía del histórico.</p>
         </div>
         <button className="shrink-0 flex items-center gap-2 h-12 rounded-[16px] bg-foreground px-6 text-[13px] font-bold uppercase tracking-widest text-background shadow-md hover:-translate-y-0.5 hover:bg-muted-foreground transition-all duration-300">
            <Plus className="size-4" /> 
            <span>Definir módulo</span>
         </button>
      </div>

      {items.length === 0 ? (
        <div className="py-32 text-center bg-white rounded-[32px] border border-border shadow-sm">
          <DatabaseZap className="size-12 mx-auto text-muted-foreground/30 mb-5" />
          <p className="text-[14px] font-bold text-muted-foreground uppercase tracking-widest">SIN REGLAS ACTIVAS EN EL MOTOR DE INFERENCIA</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((r) => (
            <div
              key={r.id}
              className={cn(
                "relative flex flex-col rounded-[24px] p-8 transition-all duration-300 overflow-hidden group border",
                r.activa 
                  ? "bg-white shadow-sm border-border hover:shadow-md hover:border-primary/30" 
                  : "bg-muted/40 shadow-none border-border/50 hover:bg-muted/60"
              )}
            >
              
              <div className="relative z-10 flex items-start justify-between gap-4 mb-8">
                <div>
                  <span className={cn(
                    "inline-flex items-center rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest mb-3 border", 
                    r.activa ? "bg-muted text-foreground border-border" : "bg-transparent text-muted-foreground border-border/50"
                  )}>
                    {r.tipo}
                  </span>
                  <h3 className={cn("text-[16px] font-bold tracking-tight leading-tight", r.activa ? "text-foreground" : "text-muted-foreground")}>
                    {r.nombre}
                  </h3>
                </div>
                <button
                  onClick={() => toggle(r.id)}
                  className={cn(
                    "relative shrink-0 inline-flex size-12 items-center justify-center rounded-[14px] border transition-all duration-300",
                    r.activa 
                      ? "border-emerald-200 bg-emerald-50 text-emerald-600 shadow-sm hover:bg-emerald-100 hover:scale-105" 
                      : "border-border bg-white text-muted-foreground hover:text-foreground hover:bg-muted shadow-sm"
                  )}
                  title={r.activa ? "Desactivar" : "Activar"}
                >
                  <Power className={cn("size-5", r.activa && "text-emerald-500")} />
                </button>
              </div>

              <div className="relative z-10 space-y-4 mb-10 flex-1">
                <Row k="Trigger" v={r.condicion} active={r.activa} />
                <Row k="Resolución" v={r.consecuencia} active={r.activa} />
              </div>

              {/* Progress System */}
              <div className="relative z-10 mt-auto border-t border-border pt-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Eficacia Histórica</span>
                  <span className={cn("font-mono text-[14px] font-extrabold tabular-nums", r.activa ? "text-primary" : "text-muted-foreground")}>
                    {r.efectividad}%
                  </span>
                </div>
                <div className={cn(
                   "h-2 rounded-full overflow-hidden border",
                   r.activa ? "bg-muted border-border shadow-inner" : "bg-muted border-border/50"
                )}>
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-1000",
                      r.activa ? "bg-primary" : "bg-muted-foreground/30"
                    )}
                    style={{ width: `${r.efectividad}%` }}
                  />
                </div>
              </div>

              <div className="relative z-10 mt-6 pt-4 flex items-center justify-between border-t border-border/50">
                <div className="flex items-center gap-2.5">
                  <span className={cn("size-2 rounded-full", r.activa ? "bg-emerald-500 animate-pulse-subtle" : "bg-muted-foreground/30")} />
                  <span className={cn("text-[11px] font-bold uppercase tracking-widest", r.activa ? "text-emerald-700" : "text-muted-foreground")}>
                    {r.activa ? "Online" : "Bypass"}
                  </span>
                </div>
                <button className={cn(
                   "flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[11px] font-bold uppercase tracking-widest transition-colors",
                   r.activa ? "text-muted-foreground hover:bg-muted hover:text-foreground" : "text-muted-foreground/60 hover:bg-white hover:text-foreground border border-border shadow-sm"
                )}>
                  <Pencil className="size-3.5" /> Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ k, v, active }: { k: string; v: string; active: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">{k}</span>
      <span className={cn("text-[14px] font-bold leading-snug", active ? "text-foreground" : "text-muted-foreground")}>
        {v}
      </span>
    </div>
  );
}
