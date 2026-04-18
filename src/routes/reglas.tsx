import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Power, Pencil } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

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
      { title: "Reglas y patrones — Cuadrante" },
      { name: "description", content: "Define, mide y activa tus propias reglas de análisis." },
    ],
  }),
  component: Reglas,
});

function Reglas() {
  const [items, setItems] = useState(REGLAS);
  const toggle = (id: string) =>
    setItems((arr) => arr.map((r) => (r.id === id ? { ...r, activa: !r.activa } : r)));

  return (
    <div>
      <PageHeader
        title="Reglas y patrones"
        description="Tus leyes personales de análisis. Cada regla mide su propia efectividad sobre el histórico."
        actions={
          <button className="inline-flex items-center gap-2 h-9 rounded-md bg-foreground text-background px-3 text-sm font-medium hover:opacity-90">
            <Plus className="size-4" /> Nueva regla
          </button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((r) => (
          <div
            key={r.id}
            className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {r.tipo}
                </span>
                <h3 className="mt-2 font-semibold">{r.nombre}</h3>
              </div>
              <button
                onClick={() => toggle(r.id)}
                className={`inline-flex size-9 items-center justify-center rounded-md border ${r.activa ? "border-foreground bg-foreground text-background" : "border-border bg-card text-muted-foreground"}`}
                title={r.activa ? "Desactivar" : "Activar"}
              >
                <Power className="size-4" />
              </button>
            </div>

            <div className="mt-4 space-y-2 text-sm">
              <Row k="Condición" v={r.condicion} />
              <Row k="Consecuencia" v={r.consecuencia} />
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">Efectividad histórica</span>
                <span className="font-semibold tabular-nums">{r.efectividad}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-foreground"
                  style={{ width: `${r.efectividad}%` }}
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <span className={`text-xs font-medium ${r.activa ? "text-success" : "text-muted-foreground"}`}>
                {r.activa ? "● Activa" : "○ Pausada"}
              </span>
              <button className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <Pencil className="size-3" /> Editar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs text-muted-foreground">{k}</span>
      <span className="font-medium text-right">{v}</span>
    </div>
  );
}
