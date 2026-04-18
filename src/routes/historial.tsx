import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Trash2, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import {
  AltoBajoBadge,
  ParImparBadge,
  SubcuadranteBadge,
} from "@/components/ClassificationBadge";
import { useDraws, useDeleteDraw } from "@/hooks/useDraws";
import { useLotteries } from "@/hooks/useLotteries";
import { drawToSorteo } from "@/lib/drawAdapter";
import { toast } from "sonner";

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
  const { data: draws = [], isLoading } = useDraws({ limit: 1000 });
  const { data: lotteries = [] } = useLotteries();
  const deleteDraw = useDeleteDraw();
  const [q, setQ] = useState("");
  const [loteria, setLoteria] = useState("Todas");
  const [origen, setOrigen] = useState("Todos");

  const all = useMemo(() => draws.map(drawToSorteo), [draws]);

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
      .slice(0, 200);
  }, [all, q, loteria, origen]);

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este sorteo?")) return;
    try {
      await deleteDraw.mutateAsync(id);
      toast.success("Sorteo eliminado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    }
  }

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
            {lotteries.map((l) => (
              <option key={l.id}>{l.nombre}</option>
            ))}
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

        {isLoading ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            <Loader2 className="size-5 animate-spin mx-auto mb-2" />
            Cargando sorteos...
          </div>
        ) : all.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <p className="text-sm font-medium">Aún no hay sorteos registrados</p>
            <p className="text-xs text-muted-foreground mt-1">
              Usa <strong>Captura manual</strong> o <strong>Importar Excel</strong> para añadir resultados.
            </p>
          </div>
        ) : (
          <>
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
                    <th className="px-4 py-2.5 font-medium w-10"></th>
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
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => handleDelete(s.id)}
                          className="text-muted-foreground hover:text-destructive"
                          aria-label="Eliminar"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 text-xs text-muted-foreground border-t border-border">
              Mostrando {rows.length} de {all.length} sorteos.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
