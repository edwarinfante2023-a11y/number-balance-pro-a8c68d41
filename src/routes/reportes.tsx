import { createFileRoute } from "@tanstack/react-router";
import { Download, FileSpreadsheet, FileText, FileBarChart, Filter, HardDrive, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/reportes")({
  head: () => ({
    meta: [
      { title: "Exportar Reportes — Cuadrante" },
      { name: "description", content: "Genera extracciones históricas formateadas." },
    ],
  }),
  component: Reportes,
});

function Reportes() {
  return (
    <div className="space-y-6 pt-2">
      <div className="mb-8">
         <h1 className="text-[32px] font-bold tracking-tight text-foreground">Exportar Reportes</h1>
         <p className="text-[15px] text-muted-foreground mt-1">Query builder de extracción. Formatea sub-conjuntos para análisis externo o revisión algorítmica.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white rounded-[32px] border border-border shadow-sm p-8 lg:p-10 relative flex flex-col">
          
          <div className="flex items-center gap-3 mb-8 border-b border-border pb-6">
             <div className="size-10 rounded-xl bg-primary/10 grid place-items-center">
               <Filter className="size-5 text-primary" />
             </div>
             <div>
               <h3 className="text-[16px] font-bold text-foreground">Query Builder</h3>
               <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-widest mt-0.5">Parámetros</p>
             </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-6 flex-1">
            <Field label="Rango Inicial (Desde)">
              <input type="date" className="w-full h-14 px-5 rounded-[16px] bg-muted/50 border border-border text-[15px] font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-inner" />
            </Field>
            <Field label="Rango Final (Hasta)">
              <input type="date" className="w-full h-14 px-5 rounded-[16px] bg-muted/50 border border-border text-[15px] font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-inner" />
            </Field>
            <Field label="Network (Lotería)">
              <select className="w-full h-14 px-5 rounded-[16px] bg-muted/50 border border-border text-[14px] font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-inner appearance-none cursor-pointer">
                <option>Full Network (Global)</option>
                <option>Quiniela Diaria</option>
                <option>Sorteo Horario</option>
                <option>Tarde Express</option>
              </select>
            </Field>
            <Field label="Bloque Horario">
              <select className="w-full h-14 px-5 rounded-[16px] bg-muted/50 border border-border text-[14px] font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-inner appearance-none cursor-pointer">
                <option>Todos los Bloques</option>
                {["09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00","21:00"].map((h) => (
                  <option key={h}>{h}</option>
                ))}
              </select>
            </Field>
            <Field label="Filtro Sectorial">
              <select className="w-full h-14 px-5 rounded-[16px] bg-muted/50 border border-border text-[14px] font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-inner appearance-none cursor-pointer">
                <option>Sin Filtro</option>
                <option>Alto Par</option>
                <option>Alto Impar</option>
                <option>Bajo Par</option>
                <option>Bajo Impar</option>
              </select>
            </Field>
            <Field label="Trigger Activo">
              <select className="w-full h-14 px-5 rounded-[16px] bg-muted/50 border border-border text-[14px] font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-inner appearance-none cursor-pointer">
                <option>Ignorar Módulos</option>
                <option>3 ALTOS → BAJO</option>
                <option>PAR + PAR → IMPAR</option>
                <option>Ruptura de cuadrante</option>
              </select>
            </Field>
          </div>
        </div>

        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-white rounded-[32px] border border-border shadow-sm p-8">
             <div className="text-[12px] font-bold uppercase tracking-[0.1em] text-muted-foreground mb-6">Export Engine</div>
             <div className="space-y-4">
               <ExportCard 
                 icon={<FileSpreadsheet className="size-6 text-emerald-600" />} 
                 title="Generar Matriz (.xlsx)" 
                 desc="Exporta el dataset completo con reglas aplicadas." 
                 accent="success"
               />
               <ExportCard 
                 icon={<FileText className="size-6 text-blue-600" />} 
                 title="Volcado Crudo (.csv)" 
                 desc="Buffer numérico sin UI ideal para ingestión." 
                 accent="info"
               />
               <ExportCard 
                 icon={<FileBarChart className="size-6 text-amber-600" />} 
                 title="Snapshot Visual (.pdf)" 
                 desc="Imprime gráficas y UI generada en pantalla." 
                 accent="warning"
               />
             </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[32px] border border-border shadow-sm overflow-hidden mt-6">
        <div className="px-8 py-6 border-b border-border bg-muted/30 flex items-center justify-between">
          <h3 className="text-[15px] font-bold tracking-tight text-foreground flex items-center gap-3">
             <HardDrive className="size-5 text-muted-foreground" /> Registry (Últimas Extracciones)
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-muted/10 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground border-b border-border">
              <tr>
                <th className="px-8 py-4 whitespace-nowrap">Output Name</th>
                <th className="px-8 py-4 whitespace-nowrap">Engine Format</th>
                <th className="px-8 py-4 whitespace-nowrap">Size</th>
                <th className="px-8 py-4 whitespace-nowrap">Timestamp</th>
                <th className="px-8 py-4 whitespace-nowrap text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                { n: "Análisis abril 2025", t: "PDF", s: "2.4MB", d: "2025-04-15" },
                { n: "Quiniela Diaria histórico", t: "XLSX", s: "1.1MB", d: "2025-04-12" },
                { n: "Patrones 13:00", t: "CSV", s: "240KB", d: "2025-04-08" },
              ].map((r, i) => (
                <tr key={i} className="hover:bg-muted/30 transition-colors">
                  <td className="px-8 py-5 text-[14px] font-bold text-foreground">{r.n}</td>
                  <td className="px-8 py-5">
                     <span className={cn(
                        "inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-bold tracking-widest uppercase border",
                        r.t === "XLSX" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                        r.t === "CSV" ? "bg-blue-50 text-blue-700 border-blue-200" :
                        "bg-amber-50 text-amber-700 border-amber-200"
                     )}>
                       {r.t}
                     </span>
                  </td>
                  <td className="px-8 py-5 text-[14px] font-semibold text-muted-foreground tabular-nums">{r.s}</td>
                  <td className="px-8 py-5 text-[14px] font-semibold text-muted-foreground tabular-nums">{r.d}</td>
                  <td className="px-8 py-5 text-right">
                    <button className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-border text-[12px] font-bold text-foreground hover:bg-muted-foreground/5 hover:border-muted-foreground/30 transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5">
                      <Download className="size-4" /> Fetch
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

function ExportCard({ icon, title, desc, accent }: { icon: React.ReactNode; title: string; desc: string; accent: "success" | "warning" | "info" }) {
  return (
    <button className={cn(
       "w-full text-left rounded-[20px] bg-white border border-border p-5 flex items-center gap-4 transition-all duration-300 group shadow-sm relative overflow-hidden",
       accent === "success" && "hover:border-emerald-300 hover:shadow-md hover:-translate-y-0.5",
       accent === "info" && "hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5",
       accent === "warning" && "hover:border-amber-300 hover:shadow-md hover:-translate-y-0.5"
    )}>
      {/* Glow on hover */}
      <div className={cn(
         "absolute left-0 top-0 bottom-0 w-1 transition-all duration-300",
         accent === "success" && "bg-emerald-500",
         accent === "info" && "bg-blue-500",
         accent === "warning" && "bg-amber-500"
      )} />
      
      <div className="rounded-xl bg-muted p-3 group-hover:bg-white group-hover:scale-110 transition-transform">
         {icon}
      </div>
      <div className="flex-1">
        <div className="font-bold text-[15px] text-foreground">{title}</div>
        <div className="text-[13px] text-muted-foreground leading-snug mt-1">{desc}</div>
      </div>
      <Terminal className={cn(
         "size-5 opacity-0 -translate-x-3 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0 hidden sm:block",
         accent === "success" && "text-emerald-500",
         accent === "info" && "text-blue-500",
         accent === "warning" && "text-amber-500"
      )} />
    </button>
  );
}
