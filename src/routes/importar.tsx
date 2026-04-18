import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowRight,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  parseSpreadsheet,
  autoDetectMapping,
  buildRows,
  FIELD_DEFS,
  type ParsedFile,
  type FieldKey,
} from "@/lib/excelParser";
import { useExecuteImport, useImports } from "@/hooks/useImports";
import { useLotteries } from "@/hooks/useLotteries";
import { useClassificationConfig } from "@/hooks/useSettings";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

export const Route = createFileRoute("/importar")({
  head: () => ({
    meta: [
      { title: "Importar Excel — Cuadrante" },
      { name: "description", content: "Importa años de análisis manual desde Excel o CSV." },
    ],
  }),
  component: Importar,
});

type Step = "upload" | "map" | "preview" | "done";

function Importar() {
  const [step, setStep] = useState<Step>("upload");
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [mapping, setMapping] = useState<Partial<Record<FieldKey, string>>>({});
  const [loteriaFallback, setLoteriaFallback] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const { data: lotteries = [] } = useLotteries();
  const { data: cfg } = useClassificationConfig();
  const { data: imports = [] } = useImports(8);
  const exec = useExecuteImport();

  const built = useMemo(() => {
    if (!parsed || !cfg) return null;
    return buildRows(parsed.rows, {
      mapping,
      loteriaFallback: loteriaFallback || undefined,
      rangeMin: cfg.rangeMin,
      rangeMax: cfg.rangeMax,
    });
  }, [parsed, mapping, loteriaFallback, cfg]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (file.size > 20 * 1024 * 1024) {
      toast.error("El archivo excede 20MB");
      return;
    }
    setBusy(true);
    try {
      const p = await parseSpreadsheet(file);
      if (p.totalRows === 0) {
        toast.error("El archivo está vacío");
        return;
      }
      setParsed(p);
      setMapping(autoDetectMapping(p.headers));
      setStep("map");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error leyendo archivo";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setParsed(null);
    setMapping({});
    setLoteriaFallback("");
    setStep("upload");
    if (fileInput.current) fileInput.current.value = "";
  }

  async function executeImport() {
    if (!parsed || !built) return;
    if (built.valid.length === 0) {
      toast.error("No hay filas válidas para importar");
      return;
    }
    try {
      const result = await exec.mutateAsync({
        fileName: parsed.fileName,
        rows: built.valid,
        errorsCount: built.errors.length,
        errorDetails: built.errors.map((e) => ({ index: e.index, message: e.message })),
      });
      toast.success(
        `Importación completa: ${result.importados} nuevos, ${result.duplicados} duplicados, ${result.errores} errores`,
      );
      setStep("done");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al importar";
      toast.error(msg);
    }
  }

  return (
    <div>
      <PageHeader
        title="Importar Excel / CSV"
        description="Carga tus tablas históricas. El sistema detecta columnas, valida duplicados y conserva tus observaciones manuales."
        actions={
          parsed && (
            <Button variant="outline" size="sm" onClick={reset}>
              <X className="size-4" />
              Cancelar
            </Button>
          )
        }
      />

      <Stepper step={step} />

      {step === "upload" && (
        <UploadStep
          busy={busy}
          fileInput={fileInput}
          onPick={() => fileInput.current?.click()}
          onChange={(e) => handleFiles(e.target.files)}
        />
      )}

      {step === "map" && parsed && (
        <div>
          <BlocksOverview parsed={parsed} />
          <MapStep
            parsed={parsed}
            mapping={mapping}
            setMapping={setMapping}
            loteriaFallback={loteriaFallback}
            setLoteriaFallback={setLoteriaFallback}
            lotteries={lotteries.map((l) => l.nombre)}
            onNext={() => setStep("preview")}
            onBack={reset}
          />
        </div>
      )}

      {step === "preview" && parsed && built && (
        <PreviewStep
          parsed={parsed}
          built={built}
          onBack={() => setStep("map")}
          onConfirm={executeImport}
          loading={exec.isPending}
        />
      )}

      {step === "done" && (
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-success/10">
            <CheckCircle2 className="size-6 text-success" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">Importación finalizada</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Los sorteos fueron clasificados automáticamente y están disponibles en el historial.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Button onClick={reset}>Importar otro archivo</Button>
          </div>
        </div>
      )}

      <RecentImports imports={imports} />
    </div>
  );
}

// ---------- Stepper ----------

function Stepper({ step }: { step: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: "upload", label: "Subir" },
    { id: "map", label: "Mapear" },
    { id: "preview", label: "Validar" },
    { id: "done", label: "Listo" },
  ];
  const idx = steps.findIndex((s) => s.id === step);
  return (
    <div className="mb-6 flex items-center gap-2 text-sm">
      {steps.map((s, i) => (
        <div key={s.id} className="flex items-center gap-2">
          <div
            className={`flex size-7 items-center justify-center rounded-full text-xs font-semibold ${
              i <= idx
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {i + 1}
          </div>
          <span className={i <= idx ? "font-medium" : "text-muted-foreground"}>{s.label}</span>
          {i < steps.length - 1 && <ArrowRight className="size-3.5 text-muted-foreground mx-1" />}
        </div>
      ))}
    </div>
  );
}

// ---------- Step 1: Upload ----------

function UploadStep({
  busy,
  fileInput,
  onPick,
  onChange,
}: {
  busy: boolean;
  fileInput: React.RefObject<HTMLInputElement | null>;
  onPick: () => void;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div
        className="lg:col-span-2 rounded-2xl border-2 border-dashed border-border bg-card p-10 text-center"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (fileInput.current && e.dataTransfer.files.length) {
            const dt = new DataTransfer();
            dt.items.add(e.dataTransfer.files[0]);
            fileInput.current.files = dt.files;
            fileInput.current.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }}
      >
        <input
          ref={fileInput}
          type="file"
          className="hidden"
          accept=".xlsx,.xls,.csv"
          onChange={onChange}
        />
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
          {busy ? (
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          ) : (
            <Upload className="size-5 text-muted-foreground" />
          )}
        </div>
        <h3 className="mt-4 text-base font-semibold">Suelta tu archivo aquí</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Soportamos .xlsx, .xls y .csv hasta 20MB
        </p>
        <Button onClick={onPick} disabled={busy} className="mt-5">
          <FileSpreadsheet className="size-4" />
          Seleccionar archivo
        </Button>

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
        <h3 className="text-base font-semibold">Columnas reconocidas</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Detectamos estas columnas automáticamente y mapeamos por nombre.
        </p>
        <div className="mt-4 space-y-3 text-sm">
          <div>
            <div className="text-[11px] font-semibold uppercase text-muted-foreground mb-1">
              Base (obligatorias)
            </div>
            <ul className="space-y-1">
              {FIELD_DEFS.filter((f) => f.required).map((f) => (
                <li key={f.key} className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-success" />
                  <code className="text-xs">{f.label}</code>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase text-muted-foreground mb-1">
              Análisis manual (se guarda)
            </div>
            <ul className="space-y-1">
              {FIELD_DEFS.filter((f) => f.manual).map((f) => (
                <li key={f.key} className="flex items-center gap-2 text-muted-foreground">
                  <span className="size-1.5 rounded-full bg-muted-foreground/40" />
                  <code className="text-xs">{f.label}</code>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-5 rounded-lg bg-muted p-3 text-xs flex gap-2">
          <AlertCircle className="size-4 shrink-0 mt-0.5 text-warning" />
          <span>
            Alto/Bajo, Par/Impar y Cuadrante se recalculan automáticamente al importar usando tus
            reglas de Configuración.
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------- Step 2: Map ----------

function MapStep({
  parsed,
  mapping,
  setMapping,
  loteriaFallback,
  setLoteriaFallback,
  lotteries,
  onBack,
  onNext,
}: {
  parsed: ParsedFile;
  mapping: Partial<Record<FieldKey, string>>;
  setMapping: (m: Partial<Record<FieldKey, string>>) => void;
  loteriaFallback: string;
  setLoteriaFallback: (v: string) => void;
  lotteries: string[];
  onBack: () => void;
  onNext: () => void;
}) {
  const missingRequired = FIELD_DEFS.filter(
    (f) => f.required && !mapping[f.key] && !(f.key === "loteria" && loteriaFallback),
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">Mapeo de columnas</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {parsed.fileName} · {parsed.totalRows.toLocaleString("es")} filas ·{" "}
              {parsed.headers.length} columnas
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {FIELD_DEFS.map((f) => (
            <div key={f.key} className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
              <div className="text-sm">
                <div className="font-medium flex items-center gap-1.5">
                  {f.label}
                  {f.required && <span className="text-destructive">*</span>}
                  {f.manual && (
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      manual
                    </span>
                  )}
                </div>
                {f.manual && (
                  <div className="text-[11px] text-muted-foreground">
                    Se guarda como referencia
                  </div>
                )}
              </div>
              <div className="sm:col-span-2">
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={mapping[f.key] ?? ""}
                  onChange={(e) =>
                    setMapping({ ...mapping, [f.key]: e.target.value || undefined })
                  }
                >
                  <option value="">— No mapear —</option>
                  {parsed.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between gap-2">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="size-4" />
            Volver
          </Button>
          <Button onClick={onNext} disabled={missingRequired.length > 0}>
            Validar filas
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <div>
          <h3 className="text-base font-semibold">Lotería por defecto</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Si tu archivo no tiene columna de lotería, asigna una para todas las filas.
          </p>
          <select
            className="mt-3 w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={loteriaFallback}
            onChange={(e) => setLoteriaFallback(e.target.value)}
          >
            <option value="">— Ninguna —</option>
            {lotteries.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>

        {missingRequired.length > 0 && (
          <div className="rounded-lg bg-destructive/10 p-3 text-xs flex gap-2 text-destructive">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <div>
              Faltan campos obligatorios:{" "}
              <strong>{missingRequired.map((f) => f.label).join(", ")}</strong>
            </div>
          </div>
        )}

        <div className="rounded-lg bg-muted p-3 text-xs">
          <div className="font-medium mb-1">Vista previa de columnas</div>
          <div className="flex flex-wrap gap-1">
            {parsed.headers.slice(0, 20).map((h) => (
              <span
                key={h}
                className="text-[10px] bg-background border border-border rounded px-1.5 py-0.5"
              >
                {h}
              </span>
            ))}
            {parsed.headers.length > 20 && (
              <span className="text-[10px] text-muted-foreground">
                +{parsed.headers.length - 20} más
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Step 3: Preview ----------

function PreviewStep({
  parsed,
  built,
  onBack,
  onConfirm,
  loading,
}: {
  parsed: ParsedFile;
  built: ReturnType<typeof buildRows>;
  onBack: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  const sample = built.valid.slice(0, 10);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryCard label="Filas válidas" value={built.valid.length} tone="success" />
        <SummaryCard label="Filas con error" value={built.errors.length} tone="warning" />
        <SummaryCard label="Total leídas" value={parsed.totalRows} tone="muted" />
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-base font-semibold">Vista previa (primeras 10 filas válidas)</h3>
          <p className="text-xs text-muted-foreground">
            Se importarán las {built.valid.length.toLocaleString("es")} filas válidas. La
            clasificación (Alto/Bajo, Par/Impar, Cuadrante) se calcula al guardar.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border bg-muted/30">
              <tr>
                <th className="py-2 px-4 font-medium">Fecha</th>
                <th className="py-2 px-4 font-medium">Hora</th>
                <th className="py-2 px-4 font-medium">Lotería</th>
                <th className="py-2 px-4 font-medium">Número</th>
                <th className="py-2 px-4 font-medium">Observación</th>
                <th className="py-2 px-4 font-medium">Manual conservado</th>
              </tr>
            </thead>
            <tbody>
              {sample.map((r, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="py-2 px-4 tabular-nums">{r.fecha}</td>
                  <td className="py-2 px-4 tabular-nums">{r.hora}</td>
                  <td className="py-2 px-4">{r.loteria}</td>
                  <td className="py-2 px-4 tabular-nums font-mono">{r.numero}</td>
                  <td className="py-2 px-4 text-muted-foreground text-xs">
                    {r.observacion ?? "—"}
                  </td>
                  <td className="py-2 px-4 text-xs">
                    {(() => {
                      const ma = (r.extra as { manual_analysis?: Record<string, unknown> })
                        .manual_analysis;
                      if (!ma || Object.keys(ma).length === 0) {
                        return <span className="text-muted-foreground">—</span>;
                      }
                      return (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-foreground">
                          {Object.keys(ma).length} campos
                        </span>
                      );
                    })()}
                  </td>
                </tr>
              ))}
              {sample.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                    Ninguna fila válida con el mapeo actual.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {built.errors.length > 0 && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center gap-2">
            <AlertCircle className="size-4 text-warning" />
            <h3 className="text-sm font-semibold">
              {built.errors.length} fila{built.errors.length === 1 ? "" : "s"} con problemas
            </h3>
          </div>
          <div className="max-h-56 overflow-y-auto">
            <table className="w-full text-xs">
              <tbody>
                {built.errors.slice(0, 50).map((e, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="py-1.5 px-4 text-muted-foreground tabular-nums w-16">
                      Fila {e.index + 2}
                    </td>
                    <td className="py-1.5 px-4">{e.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {built.errors.length > 50 && (
              <div className="p-3 text-center text-xs text-muted-foreground">
                + {built.errors.length - 50} errores adicionales
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack} disabled={loading}>
          <ArrowLeft className="size-4" />
          Ajustar mapeo
        </Button>
        <Button onClick={onConfirm} disabled={loading || built.valid.length === 0}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
          Importar {built.valid.length.toLocaleString("es")} sorteos
        </Button>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "warning" | "muted";
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : "text-foreground";
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${toneClass}`}>
        {value.toLocaleString("es")}
      </div>
    </div>
  );
}

// ---------- Recientes ----------

function RecentImports({
  imports,
}: {
  imports: Array<{
    id: string;
    archivo: string;
    registros_importados: number;
    registros_duplicados: number;
    errores: number;
    estado: string;
    created_at: string;
  }>;
}) {
  return (
    <div className="mt-8 rounded-2xl border border-border bg-card p-6">
      <h3 className="text-base font-semibold mb-4">Importaciones recientes</h3>
      {imports.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aún no hay importaciones registradas.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
              <tr>
                <th className="py-2 pr-4 font-medium">Archivo</th>
                <th className="py-2 pr-4 font-medium">Filas</th>
                <th className="py-2 pr-4 font-medium">Duplicados</th>
                <th className="py-2 pr-4 font-medium">Errores</th>
                <th className="py-2 pr-4 font-medium">Estado</th>
                <th className="py-2 font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {imports.map((r) => {
                const ok = r.estado === "completado";
                return (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="py-2.5 pr-4 font-medium">{r.archivo}</td>
                    <td className="py-2.5 pr-4 tabular-nums">
                      {r.registros_importados.toLocaleString("es")}
                    </td>
                    <td className="py-2.5 pr-4 tabular-nums">{r.registros_duplicados}</td>
                    <td className="py-2.5 pr-4 tabular-nums">{r.errores}</td>
                    <td className="py-2.5 pr-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          ok
                            ? "bg-par-soft text-par-soft-foreground"
                            : "bg-warning/15 text-warning"
                        }`}
                      >
                        {ok ? <CheckCircle2 className="size-3" /> : <AlertCircle className="size-3" />}
                        {ok ? "Completado" : "Con errores"}
                      </span>
                    </td>
                    <td className="py-2.5 text-muted-foreground tabular-nums">
                      {formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: es })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------- Bloques detectados ----------

function BlocksOverview({ parsed }: { parsed: ParsedFile }) {
  if (!parsed.blocks || parsed.blocks.length <= 1) return null;
  return (
    <div className="mb-4 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold">
            Bloques detectados ({parsed.blocks.length})
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            El archivo contiene varios bloques diarios. Se importarán todos en conjunto.
          </p>
        </div>
        <div className="text-xs text-muted-foreground">
          {parsed.totalRows.toLocaleString("es")} filas totales
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
        {parsed.blocks.map((b, i) => (
          <div key={i} className="rounded-lg border border-border p-2.5 text-xs">
            <div className="font-medium truncate">{b.label}</div>
            <div className="text-muted-foreground mt-0.5 flex items-center justify-between">
              <span>{b.rows.length} filas</span>
              {b.contextoFecha && (
                <span className="tabular-nums text-[10px] bg-muted px-1.5 py-0.5 rounded">
                  {b.contextoFecha}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

