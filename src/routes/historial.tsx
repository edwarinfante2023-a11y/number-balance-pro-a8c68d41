import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import {
  AltoBajoBadge,
  ParImparBadge,
  SubcuadranteBadge,
} from "@/components/ClassificationBadge";
import { generateDemoHistory } from "@/lib/lottery";

export const Route = createFileRoute("/historial")({
  head: () => ({
    meta: [
      { title: "Historial — Cuadrante" },
      { name: "description", content: "Tabla histórica de sorteos clasificados con búsqueda y filtros." },
    ],
  }),
  component: Historial,
});

function Historial() {
  const all = useMemo(() => generateDemoHistory(30), []);
  const [q, setQ] = useState("");
  const [loteria, setLoteria] = useState("Todas");
  const [origen, setOrigen] = useState("Todos");

  const rows = useMemo(() => {
    return all
      .filter((s) => (loteria === "Todas" ? true : s.loteria === loteria))
      .filter((s) => (origen === "Todos" ? true : s.origen === origen))
      .filter((s) =>
        q
          ? `${s.numero} ${s.fecha} ${s.hora} ${s.loteria}`
              .toLowerCase()
              .includes(q.toLowerCase())
          : true,
      )
      .sort((a, b) => `${b.fecha} ${b.hora}`.localeCompare(`${a.fecha} ${a.hora}`))
      .slice(0, 200);
  }, [all, q, loteria, origen]);

  return (
    <div>
      <PageHeader
        title="Historial de sorteos"
        description="Cada resultado clasificado automáticamente por Alto/Bajo, Par/Impar y subcuadrante."
      />

      <div className="rounded-2xl border border-border bg-card shadow-[var(--shadow-card)] overflow-hidden">
        <div className="flex flex-col sm:flex-row gap-2 p-4 border-b border-border">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por número, fecha, hora o lotería..."
              className="w-full h-10 pl-9 pr-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <select
            value={loteria}
            onChange={(e) => setLoteria(e.target.value)}
            className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          >
            <option>Todas</option>
            <option>Quiniela Diaria</option>
            <option>Sorteo Horario</option>
            <option>Tarde Express</option>
          </select>
          <select
            value={origen}
            onChange={(e) => setOrigen(e.target.value)}
            className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          >
            <option>Todos</option>
            <option value="scraper">Scraper</option>
            <option value="manual">Manual</option>
            <option value="excel">Excel</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                <th className="px-4 py-2.5 font-medium">Fecha</th>
                <th className="px-4 py-2.5 font-medium">Hora</th>
                <th className="px-4 py-2.5 font-medium">Lotería</th>
                <th className="px-4 py-2.5 font-medium">Número</th>
                <th className="px-4 py-2.5 font-medium">Alto/Bajo</th>
                <th className="px-4 py-2.5 font-medium">Par/Impar</th>
                <th className="px-4 py-2.5 font-medium">Cuadrante</th>
                <th className="px-4 py-2.5 font-medium">Origen</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                  <td className="px-4 py-2.5 text-muted-foreground tabular-nums">{s.fecha}</td>
                  <td className="px-4 py-2.5 tabular-nums">{s.hora}</td>
                  <td className="px-4 py-2.5">{s.loteria}</td>
                  <td className="px-4 py-2.5 font-mono font-semibold tabular-nums">
                    {s.numero.toString().padStart(2, "0")}
                  </td>
                  <td className="px-4 py-2.5"><AltoBajoBadge value={s.altoBajo} /></td>
                  <td className="px-4 py-2.5"><ParImparBadge value={s.parImpar} /></td>
                  <td className="px-4 py-2.5"><SubcuadranteBadge value={s.subcuadrante} /></td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground capitalize">{s.origen}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 text-xs text-muted-foreground border-t border-border">
          Mostrando {rows.length} de {all.length} sorteos.
        </div>
      </div>
    </div>
  );
}
