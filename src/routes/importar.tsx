import { createFileRoute } from "@tanstack/react-router";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/importar")({
  head: () => ({
    meta: [
      { title: "Importar Excel — Cuadrante" },
      { name: "description", content: "Importa años de análisis manual desde Excel o CSV." },
    ],
  }),
  component: Importar,
});

function Importar() {
  return (
    <div>
      <PageHeader
        title="Importar Excel / CSV"
        description="Carga tus tablas históricas. El sistema detecta columnas, valida duplicados y conserva tus observaciones."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl border-2 border-dashed border-border bg-card p-10 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
            <Upload className="size-5 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-base font-semibold">Suelta tu archivo aquí</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Soportamos .xlsx, .xls y .csv hasta 20MB
          </p>
          <button className="mt-5 inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90">
            <FileSpreadsheet className="size-4" />
            Seleccionar archivo
          </button>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
            {[
              { step: "1", title: "Subir", desc: "Carga el archivo desde tu equipo" },
              { step: "2", title: "Mapear", desc: "Asocia tus columnas con los campos" },
              { step: "3", title: "Validar", desc: "Revisa duplicados y errores" },
            ].map((s) => (
              <div key={s.step} className="rounded-lg border border-border p-3">
                <div className="text-[11px] font-semibold text-muted-foreground">PASO {s.step}</div>
                <div className="mt-1 text-sm font-medium">{s.title}</div>
                <div className="text-xs text-muted-foreground">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <h3 className="text-base font-semibold">Columnas recomendadas</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Estas son las columnas que el sistema reconoce automáticamente.
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {[
              "fecha (YYYY-MM-DD)",
              "hora (HH:mm)",
              "loteria",
              "numero",
              "observacion (opcional)",
              "movimiento (opcional)",
            ].map((c) => (
              <li key={c} className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-success" />
                <code className="text-xs">{c}</code>
              </li>
            ))}
          </ul>
          <div className="mt-5 rounded-lg bg-muted p-3 text-xs flex gap-2">
            <AlertCircle className="size-4 shrink-0 mt-0.5 text-warning" />
            <span>
              Alto/Bajo y Par/Impar se calculan automáticamente según tus reglas en
              Configuración.
            </span>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-6">
        <h3 className="text-base font-semibold mb-4">Importaciones recientes</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
              <tr>
                <th className="py-2 pr-4 font-medium">Archivo</th>
                <th className="py-2 pr-4 font-medium">Filas</th>
                <th className="py-2 pr-4 font-medium">Duplicados</th>
                <th className="py-2 pr-4 font-medium">Estado</th>
                <th className="py-2 font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {[
                { f: "historico_2023.xlsx", r: 4380, d: 12, ok: true, dt: "2025-03-12" },
                { f: "enero_marzo.csv", r: 921, d: 0, ok: true, dt: "2025-04-02" },
                { f: "diario_abril.xlsx", r: 156, d: 4, ok: true, dt: "2025-04-15" },
              ].map((r) => (
                <tr key={r.f} className="border-b border-border last:border-0">
                  <td className="py-2.5 pr-4 font-medium">{r.f}</td>
                  <td className="py-2.5 pr-4 tabular-nums">{r.r.toLocaleString("es")}</td>
                  <td className="py-2.5 pr-4 tabular-nums">{r.d}</td>
                  <td className="py-2.5 pr-4">
                    <span className="inline-flex items-center gap-1 rounded-full bg-par-soft px-2 py-0.5 text-[11px] font-medium text-par-soft-foreground">
                      <CheckCircle2 className="size-3" /> Importado
                    </span>
                  </td>
                  <td className="py-2.5 text-muted-foreground tabular-nums">{r.dt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
