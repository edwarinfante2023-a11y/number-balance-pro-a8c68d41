import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Trash2, Loader2, Database, SlidersHorizontal, ArrowDownToLine } from "lucide-react";
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
import { cn } from "@/lib/utils";

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
    if (!confirm("¿Eliminar este registro permanentemente?")) return;
    try {
      await deleteDraw.mutateAsync(id);
      toast.success("Secuencia purgada del sistema.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error borrando matriz.");
    }
  }

  return (
    <div className="space-y-6 pt-2">
      <div className="mb-8">
         <h1 className="text-[32px] font-bold tracking-tight text-foreground">Registro Histórico</h1>
         <p className="text-[15px] text-muted-foreground mt-1 max-w-2xl">Explorador profundo del historial de secuencias. Motor de filtrado indexado por dimensiones.</p>
      </div>

      <div className="bg-white rounded-[32px] border border-border shadow-sm overflow-hidden relative">
        {/* Toolbar */}
        <div className="relative z-10 flex flex-col md:flex-row gap-3 p-6 border-b border-border bg-muted/10">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground transition-colors group-focus-within:text-primary" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Query: número, fecha, matriz..."
              className="w-full h-12 pl-12 pr-5 rounded-[16px] border border-border bg-white text-[14px] font-mono font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
            />
          </div>
          <div className="flex gap-3">
            <div className="relative group">
              <SlidersHorizontal className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <select
                value={loteria}
                onChange={(e) => setLoteria(e.target.value)}
                className="h-12 pl-11 pr-10 rounded-[16px] border border-border bg-white text-[14px] font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer shadow-sm min-w-[160px] transition-all hover:border-border/80"
              >
                <option value="Todas">Network: Todas</option>
                {lotteries.map((l) => (
                  <option key={l.id} value={l.nombre}>{l.nombre}</option>
                ))}
              </select>
            </div>
            
            <div className="relative group hidden sm:block">
              <ArrowDownToLine className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <select
                value={origen}
                onChange={(e) => setOrigen(e.target.value)}
                className="h-12 pl-11 pr-10 rounded-[16px] border border-border bg-white text-[14px] font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer shadow-sm min-w-[160px] transition-all hover:border-border/80"
              >
                <option value="Todos">Source: Todos</option>
                <option value="scraper">Script</option>
                <option value="manual">Manual</option>
                <option value="excel">Batch (Excel)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="relative z-10 w-full overflow-hidden">
          {isLoading ? (
            <div className="px-5 py-32 text-center bg-muted/5">
              <div className="size-14 rounded-[16px] bg-white border border-border shadow-sm grid place-items-center mx-auto mb-5">
                <Loader2 className="size-6 animate-spin text-primary" />
              </div>
              <p className="text-[12px] font-bold tracking-widest uppercase text-muted-foreground animate-pulse-subtle">
                Montando stream de datos...
              </p>
            </div>
          ) : all.length === 0 ? (
            <div className="px-5 py-32 text-center group bg-muted/5">
              <div className="mx-auto flex size-16 items-center justify-center rounded-[20px] bg-white border border-border shadow-sm mb-6 relative hover:scale-105 transition-transform duration-500">
                <Database className="size-6 text-muted-foreground group-hover:text-primary transition-colors duration-500" />
              </div>
              <p className="text-[18px] font-bold text-foreground tracking-tight">Buffer vacío</p>
              <p className="text-[14px] text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
                El sistema requiere inyección de datos para procesar la historia. Navega a Captura Manual o Ingestión de Datos.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    <th className="px-8 py-5 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground whitespace-nowrap">Timestamp</th>
                    <th className="px-8 py-5 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground whitespace-nowrap">Hora</th>
                    <th className="px-8 py-5 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground whitespace-nowrap">Matriz</th>
                    <th className="px-8 py-5 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground whitespace-nowrap">Valor</th>
                    <th className="px-8 py-5 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground whitespace-nowrap hidden sm:table-cell">A/B</th>
                    <th className="px-8 py-5 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground whitespace-nowrap hidden sm:table-cell">P/I</th>
                    <th className="px-8 py-5 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground whitespace-nowrap">Sector</th>
                    <th className="px-8 py-5 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground whitespace-nowrap hidden md:table-cell">I/O</th>
                    <th className="px-8 py-5 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-white">
                  {rows.map((s, index) => (
                    <tr 
                      key={s.id} 
                      className="group hover:bg-muted/30 transition-colors duration-200"
                      style={{ animationDelay: `${index * 0.02}s` }}
                    >
                      <td className="px-8 py-4 text-[13px] font-mono font-medium text-muted-foreground whitespace-nowrap">
                        {s.fecha}
                      </td>
                      <td className="px-8 py-4 text-[13px] font-mono font-medium text-muted-foreground whitespace-nowrap">
                        {s.hora}
                      </td>
                      <td className="px-8 py-4 text-[14px] font-bold text-foreground">
                        {s.loteria}
                      </td>
                      <td className="px-8 py-4">
                        <span className="font-mono text-[18px] lg:text-[20px] font-extrabold text-foreground bg-muted px-3 py-1 rounded-[8px] border border-border shadow-sm">
                          {s.numero.toString().padStart(2, "0")}
                        </span>
                      </td>
                      <td className="px-8 py-4 hidden sm:table-cell"><AltoBajoBadge value={s.altoBajo} soft={false} /></td>
                      <td className="px-8 py-4 hidden sm:table-cell"><ParImparBadge value={s.parImpar} soft={false} /></td>
                      <td className="px-8 py-4"><SubcuadranteBadge value={s.subcuadrante} /></td>
                      <td className="px-8 py-4 text-[12px] font-mono text-muted-foreground capitalize hidden md:table-cell">
                        {s.origen}
                      </td>
                      <td className="px-8 py-4 text-right">
                        <button
                          onClick={() => handleDelete(s.id)}
                          className="opacity-0 group-hover:opacity-100 p-2 rounded-[8px] hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-all duration-200"
                          aria-label="Purgar"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        {all.length > 0 && (
          <div className="relative z-10 px-8 py-5 border-t border-border bg-muted/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
               <span className="size-2 rounded-full bg-primary animate-pulse" />
               <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Rows rendered</span>
            </div>
            <div className="text-[12px] font-bold text-muted-foreground">
              <span className="text-foreground">{rows.length}</span> / {all.length}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
