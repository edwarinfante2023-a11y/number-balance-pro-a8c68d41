import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Search,
  Trash2,
  Loader2,
  Database,
  SlidersHorizontal,
  ArrowDownToLine,
  Globe,
  Calendar,
  Clock,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Info,
} from "lucide-react";
import { AltoBajoBadge, ParImparBadge, SubcuadranteBadge } from "@/components/ClassificationBadge";
import { useDraws, useDeleteDraw } from "@/hooks/useDraws";
import { useLotteries } from "@/hooks/useLotteries";
import { drawToSorteo } from "@/lib/drawAdapter";
import { syncFromWeb, type SyncSummary } from "@/lib/webSyncEngine";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/historial")({
  head: () => ({
    meta: [
      { title: "Historial — Cuadrante" },
      {
        name: "description",
        content: "Tabla histórica de sorteos clasificados con búsqueda y filtros.",
      },
    ],
  }),
  component: Historial,
});

function Historial() {
  const { data: draws = [], isLoading } = useDraws({ limit: 5000 });
  const { data: lotteries = [] } = useLotteries();
  const deleteDraw = useDeleteDraw();
  const queryClient = useQueryClient();

  // ─── Filtros ─────────────────────────────────────────────────────
  const [q, setQ] = useState("");
  const [loteria, setLoteria] = useState("Todas");
  const [origen, setOrigen] = useState("Todos");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [horaFiltro, setHoraFiltro] = useState("Todas");

  // ─── Sync State ──────────────────────────────────────────────────
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<SyncSummary | null>(null);
  const [showSyncDetail, setShowSyncDetail] = useState(false);

  const all = useMemo(() => draws.map(drawToSorteo), [draws]);

  // ─── Horas disponibles (extraídas de los datos) ──────────────────
  const horasDisponibles = useMemo(() => {
    const set = new Set(all.map((s) => s.hora));
    return Array.from(set).sort();
  }, [all]);

  const rows = useMemo(() => {
    return all
      .filter((s) => (loteria === "Todas" ? true : s.loteria === loteria))
      .filter((s) => (origen === "Todos" ? true : s.origen === origen))
      .filter((s) => (horaFiltro === "Todas" ? true : s.hora === horaFiltro))
      .filter((s) => (!fechaDesde ? true : s.fecha >= fechaDesde))
      .filter((s) => (!fechaHasta ? true : s.fecha <= fechaHasta))
      .filter((s) =>
        q
          ? `${s.numero} ${s.fecha} ${s.hora} ${s.loteria}`.toLowerCase().includes(q.toLowerCase())
          : true,
      )
      .slice(0, 500);
  }, [all, q, loteria, origen, horaFiltro, fechaDesde, fechaHasta]);

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este registro permanentemente?")) return;
    try {
      await deleteDraw.mutateAsync(id);
      toast.success("Secuencia purgada del sistema.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error borrando matriz.");
    }
  }

  async function handleSync() {
    setIsSyncing(true);
    setLastSync(null);
    try {
      const result = await syncFromWeb();
      setLastSync(result);
      
      if (result.nuevasInsertadas > 0) {
        toast.success(`${result.nuevasInsertadas} registros nuevos sincronizados.`);
        queryClient.invalidateQueries({ queryKey: ["draws"] });
      } else if (result.errores === 0) {
        toast.info("Todo al día. No se encontraron registros nuevos.");
      } else {
        toast.warning(`Sincronización parcial. ${result.errores} errores.`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error en sincronización.");
    } finally {
      setIsSyncing(false);
    }
  }

  const origenBadge = (o: string) => {
    const styles: Record<string, string> = {
      manual: "bg-blue-50 text-blue-700 border-blue-200",
      scraper: "bg-emerald-50 text-emerald-700 border-emerald-200",
      excel: "bg-amber-50 text-amber-700 border-amber-200",
      web: "bg-indigo-50 text-indigo-700 border-indigo-200",
    };
    return styles[o] || "bg-muted text-muted-foreground border-border";
  };

  return (
    <div className="space-y-6 pt-2 pb-10">
      <div className="mb-8 flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-bold tracking-tight text-foreground">Registro Histórico</h1>
          <p className="text-[15px] text-muted-foreground mt-1 max-w-2xl">
            Explorador profundo del historial de secuencias. Motor de filtrado indexado por
            dimensiones.
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="inline-flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-5 py-2.5 rounded-[16px] font-bold text-[13px] transition-colors shadow-sm shrink-0"
        >
          {isSyncing ? <Loader2 className="size-4 animate-spin" /> : <Globe className="size-4" />}
          Sincronizar Resultados Web
        </button>
      </div>

      {/* ══ Resumen de Sincronización ══ */}
      {lastSync && (
        <div className="bg-slate-950 text-slate-50 rounded-[24px] p-5 lg:p-6 border border-slate-800 relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-1/4 -translate-y-1/4 size-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h3 className="text-[14px] font-bold uppercase tracking-[0.15em] text-slate-300 flex items-center gap-2">
                <RefreshCw className="size-4 text-indigo-400" />
                Última Sincronización
              </h3>
              <button
                onClick={() => setShowSyncDetail(!showSyncDetail)}
                className="text-[11px] font-bold uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
              >
                {showSyncDetail ? "Ocultar detalle" : "Ver detalle"}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Procesadas</div>
                <div className="text-2xl font-extrabold tabular-nums text-white">{lastSync.totalProcesadas}</div>
              </div>
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 mb-1 flex items-center gap-1">
                  <CheckCircle2 className="size-3" /> Nuevas
                </div>
                <div className="text-2xl font-extrabold tabular-nums text-emerald-400">{lastSync.nuevasInsertadas}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1 flex items-center gap-1">
                  <Info className="size-3" /> Duplicadas
                </div>
                <div className="text-2xl font-extrabold tabular-nums text-slate-300">{lastSync.duplicadasIgnoradas}</div>
              </div>
              <div className={cn(
                "p-3 rounded-xl border",
                lastSync.errores > 0 ? "bg-red-500/10 border-red-500/20" : "bg-slate-900 border-slate-800"
              )}>
                <div className={cn(
                  "text-[10px] font-bold uppercase tracking-widest mb-1 flex items-center gap-1",
                  lastSync.errores > 0 ? "text-red-400" : "text-slate-500"
                )}>
                  <XCircle className="size-3" /> Errores
                </div>
                <div className={cn(
                  "text-2xl font-extrabold tabular-nums",
                  lastSync.errores > 0 ? "text-red-400" : "text-slate-300"
                )}>{lastSync.errores}</div>
              </div>
            </div>

            {showSyncDetail && lastSync.detalle.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-800 max-h-[200px] overflow-y-auto">
                <div className="space-y-1.5">
                  {lastSync.detalle.map((d, i) => (
                    <div key={i} className="text-[12px] font-mono text-slate-400 leading-relaxed">
                      {d}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ Filtros Avanzados ══ */}
      <div className="bg-white rounded-[24px] lg:rounded-[32px] border border-border shadow-sm overflow-hidden relative">
        {/* Toolbar Row 1: Search + Primary Filters */}
        <div className="relative z-10 flex flex-col md:flex-row gap-3 p-6 border-b border-border bg-muted/10">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground transition-colors group-focus-within:text-primary" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por número, fecha, matriz..."
              className="w-full h-12 pl-12 pr-5 rounded-[16px] border border-border bg-white text-[14px] font-mono font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
            />
          </div>
          <div className="flex gap-3 flex-wrap">
            <div className="relative group">
              <SlidersHorizontal className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <select
                value={loteria}
                onChange={(e) => setLoteria(e.target.value)}
                className="h-12 pl-11 pr-10 rounded-[16px] border border-border bg-white text-[14px] font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer shadow-sm min-w-[160px] transition-all hover:border-border/80"
              >
                <option value="Todas">Sorteo: Todos</option>
                {lotteries.map((l) => (
                  <option key={l.id} value={l.nombre}>
                    {l.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative group">
              <ArrowDownToLine className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <select
                value={origen}
                onChange={(e) => setOrigen(e.target.value)}
                className="h-12 pl-11 pr-10 rounded-[16px] border border-border bg-white text-[14px] font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer shadow-sm min-w-[140px] transition-all hover:border-border/80"
              >
                <option value="Todos">Origen: Todos</option>
                <option value="scraper">Web / Script</option>
                <option value="manual">Manual</option>
                <option value="excel">Excel</option>
              </select>
            </div>

            <div className="relative group">
              <Clock className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <select
                value={horaFiltro}
                onChange={(e) => setHoraFiltro(e.target.value)}
                className="h-12 pl-11 pr-10 rounded-[16px] border border-border bg-white text-[14px] font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer shadow-sm min-w-[140px] transition-all hover:border-border/80"
              >
                <option value="Todas">Hora: Todas</option>
                {horasDisponibles.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Toolbar Row 2: Date Range */}
        <div className="relative z-10 flex flex-col sm:flex-row gap-3 px-6 py-4 border-b border-border bg-muted/5">
          <div className="flex items-center gap-2 flex-1">
            <Calendar className="size-4 text-muted-foreground shrink-0" />
            <span className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground shrink-0">Desde</span>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="h-10 px-4 rounded-xl border border-border bg-white text-[13px] font-mono font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all flex-1 min-w-[140px]"
            />
          </div>
          <div className="flex items-center gap-2 flex-1">
            <Calendar className="size-4 text-muted-foreground shrink-0" />
            <span className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground shrink-0">Hasta</span>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="h-10 px-4 rounded-xl border border-border bg-white text-[13px] font-mono font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all flex-1 min-w-[140px]"
            />
          </div>
          {(fechaDesde || fechaHasta || horaFiltro !== "Todas" || origen !== "Todos" || loteria !== "Todas" || q) && (
            <button
              onClick={() => {
                setQ("");
                setLoteria("Todas");
                setOrigen("Todos");
                setHoraFiltro("Todas");
                setFechaDesde("");
                setFechaHasta("");
              }}
              className="h-10 px-4 rounded-xl border border-red-200 bg-red-50 text-red-600 text-[12px] font-bold uppercase tracking-widest hover:bg-red-100 transition-colors shrink-0"
            >
              Limpiar filtros
            </button>
          )}
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
                El sistema requiere inyección de datos para procesar la historia. Usa el botón
                "Sincronizar Resultados Web" o navega a Captura Manual.
              </p>
            </div>
          ) : (
            <div className="w-full">
              {/* Mobile Card List View */}
              <div className="lg:hidden flex flex-col divide-y divide-border bg-white w-full">
                {rows.map((s, index) => (
                  <div 
                    key={s.id} 
                    className="p-5 flex flex-col gap-4 animate-fade-up bg-white hover:bg-muted/20 transition-colors"
                    style={{ animationDelay: `${index * 0.02}s` }}
                  >
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                           <div className="flex flex-col">
                             <span className="font-bold text-foreground text-[16px] tracking-tight">{s.loteria}</span>
                             <span className="text-[12px] font-mono font-bold text-muted-foreground uppercase tracking-widest">{s.hora}</span>
                           </div>
                        </div>
                        <div className="size-12 rounded-xl bg-muted/40 border border-border flex items-center justify-center shadow-sm">
                           <span className="font-mono text-[22px] font-extrabold text-foreground">
                             {s.numero.toString().padStart(2, "0")}
                           </span>
                        </div>
                     </div>
                     
                     <div className="flex items-center gap-3 flex-wrap">
                        <div className="scale-90 origin-left"><SubcuadranteBadge value={s.subcuadrante} /></div>
                        <div className="scale-90 origin-left"><AltoBajoBadge value={s.altoBajo} soft={false} /></div>
                        <div className="scale-90 origin-left"><ParImparBadge value={s.parImpar} soft={false} /></div>
                        <span className={cn(
                          "text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md border",
                          origenBadge(s.origen)
                        )}>
                          {s.origen}
                        </span>
                     </div>
                     
                     <div className="flex items-center justify-between pt-4 border-t border-border/40">
                        <div className="flex items-center gap-2">
                           <span className="text-[11px] font-mono text-muted-foreground/80">{s.fecha}</span>
                        </div>
                        <button
                           onClick={() => handleDelete(s.id)}
                           className="p-2 rounded-[10px] bg-red-500/5 hover:bg-red-500/10 text-red-500 transition-all duration-200"
                           aria-label="Purgar"
                        >
                           <Trash2 className="size-4" />
                        </button>
                     </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      <th className="px-6 py-5 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground whitespace-nowrap">
                        Fecha
                      </th>
                      <th className="px-6 py-5 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground whitespace-nowrap">
                        Hora
                      </th>
                      <th className="px-6 py-5 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground whitespace-nowrap">
                        Sorteo
                      </th>
                      <th className="px-6 py-5 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground whitespace-nowrap">
                        Número
                      </th>
                      <th className="px-6 py-5 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground whitespace-nowrap">
                        Alto/Bajo
                      </th>
                      <th className="px-6 py-5 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground whitespace-nowrap">
                        Par/Impar
                      </th>
                      <th className="px-6 py-5 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground whitespace-nowrap">
                        Cuadrante
                      </th>
                      <th className="px-6 py-5 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground whitespace-nowrap">
                        Origen
                      </th>
                      <th className="px-6 py-5 w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-white">
                    {rows.map((s, index) => (
                      <tr
                        key={s.id}
                        className="group hover:bg-muted/30 transition-colors duration-200"
                        style={{ animationDelay: `${index * 0.02}s` }}
                      >
                        <td className="px-6 py-4 text-[13px] font-mono font-medium text-muted-foreground whitespace-nowrap">
                          {s.fecha}
                        </td>
                        <td className="px-6 py-4 text-[13px] font-mono font-medium text-muted-foreground whitespace-nowrap">
                          {s.hora}
                        </td>
                        <td className="px-6 py-4 text-[14px] font-bold text-foreground">
                          {s.loteria}
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-mono text-[18px] lg:text-[20px] font-extrabold text-foreground bg-muted px-3 py-1 rounded-[8px] border border-border shadow-sm">
                            {s.numero.toString().padStart(2, "0")}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <AltoBajoBadge value={s.altoBajo} soft={false} />
                        </td>
                        <td className="px-6 py-4">
                          <ParImparBadge value={s.parImpar} soft={false} />
                        </td>
                        <td className="px-6 py-4">
                          <SubcuadranteBadge value={s.subcuadrante} />
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "text-[11px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md border whitespace-nowrap",
                            origenBadge(s.origen)
                          )}>
                            {s.origen}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
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
            </div>
          )}
        </div>

        {/* Footer */}
        {all.length > 0 && (
          <div className="relative z-10 px-8 py-5 border-t border-border bg-muted/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="size-2 rounded-full bg-primary animate-pulse" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Rows rendered
              </span>
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
