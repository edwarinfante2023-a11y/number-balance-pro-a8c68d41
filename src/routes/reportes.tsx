import { createFileRoute } from "@tanstack/react-router";
import { Download, FileSpreadsheet, FileText, FileBarChart } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/reportes")({
  head: () => ({
    meta: [
      { title: "Reportes — Cuadrante" },
      { name: "description", content: "Genera reportes filtrados por fecha, hora, lotería o patrón." },
    ],
  }),
  component: Reportes,
});

function Reportes() {
  return (
    <div>
      <PageHeader
        title="Reportes"
        description="Configura un reporte y expórtalo en el formato que necesites."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-6">
          <h3 className="text-base font-semibold mb-4">Configurar reporte</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Desde">
              <input type="date" className="w-full h-10 px-3 rounded-md border border-border bg-background tabular-nums" />
            </Field>
            <Field label="Hasta">
              <input type="date" className="w-full h-10 px-3 rounded-md border border-border bg-background tabular-nums" />
            </Field>
            <Field label="Lotería">
              <select className="w-full h-10 px-3 rounded-md border border-border bg-background">
                <option>Todas</option>
                <option>Quiniela Diaria</option>
                <option>Sorteo Horario</option>
                <option>Tarde Express</option>
              </select>
            </Field>
            <Field label="Hora">
              <select className="w-full h-10 px-3 rounded-md border border-border bg-background">
                <option>Cualquiera</option>
                {["09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00","21:00"].map(h => <option key={h}>{h}</option>)}
              </select>
            </Field>
            <Field label="Cuadrante">
              <select className="w-full h-10 px-3 rounded-md border border-border bg-background">
                <option>Todos</option>
                <option>Alto Par</option>
                <option>Alto Impar</option>
                <option>Bajo Par</option>
                <option>Bajo Impar</option>
              </select>
            </Field>
            <Field label="Patrón">
              <select className="w-full h-10 px-3 rounded-md border border-border bg-background">
                <option>Todos</option>
                <option>3 ALTOS → BAJO</option>
                <option>PAR + PAR → IMPAR</option>
                <option>Ruptura de cuadrante</option>
              </select>
            </Field>
          </div>
        </div>

        <div className="space-y-3">
          <ExportCard icon={<FileSpreadsheet className="size-5 text-success" />} title="Exportar a Excel" desc=".xlsx con formato y observaciones" />
          <ExportCard icon={<FileText className="size-5 text-info" />} title="Exportar a CSV" desc="Datos planos para análisis externo" />
          <ExportCard icon={<FileBarChart className="size-5 text-warning" />} title="Exportar a PDF" desc="Reporte visual con gráficas" />
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-6">
        <h3 className="text-base font-semibold mb-3">Reportes recientes</h3>
        <ul className="divide-y divide-border">
          {[
            { n: "Análisis abril 2025", t: "PDF · 2.4MB", d: "2025-04-15" },
            { n: "Quiniela Diaria histórico", t: "Excel · 1.1MB", d: "2025-04-12" },
            { n: "Patrones 13:00", t: "CSV · 240KB", d: "2025-04-08" },
          ].map((r) => (
            <li key={r.n} className="flex items-center justify-between py-3">
              <div>
                <div className="font-medium text-sm">{r.n}</div>
                <div className="text-xs text-muted-foreground">{r.t} · {r.d}</div>
              </div>
              <button className="inline-flex items-center gap-1.5 text-sm text-foreground hover:underline">
                <Download className="size-4" /> Descargar
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
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

function ExportCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <button className="w-full text-left rounded-2xl border border-border bg-card p-4 hover:bg-accent transition-colors flex items-start gap-3">
      <div className="rounded-lg bg-muted p-2">{icon}</div>
      <div className="flex-1">
        <div className="font-medium text-sm">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      <Download className="size-4 text-muted-foreground mt-1" />
    </button>
  );
}
