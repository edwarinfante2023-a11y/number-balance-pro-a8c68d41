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
  Server,
  Terminal,
  Database,
} from "lucide-react";
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
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/importar")({
  head: () => ({
    meta: [
      { title: "Ingestión de Datos — Cuadrante" },
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
        `Ingestión completa: ${result.importados} procesados, ${result.duplicados} omitidos.`,
      );
      setStep("done");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error en Ingestión";
      toast.error(msg);
    }
  }

  return (
    <div className="space-y-6 pt-2">
      <div className="mb-8 flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-bold tracking-tight text-foreground">
            Ingestión de Datos
          </h1>
          <p className="text-[15px] text-muted-foreground mt-1 max-w-2xl">
            Pipeline de carga masiva. Detecta dimensiones, consolida bloques horarios y
            auto-resuelve colisiones históricas.
          </p>
        </div>
        {parsed && step !== "done" && (
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-[12px] bg-white border border-border text-[12px] font-bold text-muted-foreground hover:bg-muted-foreground/5 hover:text-foreground transition-all shadow-sm shrink-0"
          >
            <X className="size-4" /> Cancelar proceso
          </button>
        )}
      </div>

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
        <div className="space-y-8 animate-fade-in">
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
        <div className="animate-fade-in space-y-8">
          <PreviewStep
            parsed={parsed}
            built={built}
            onBack={() => setStep("map")}
            onConfirm={executeImport}
            loading={exec.isPending}
          />
        </div>
      )}

      {step === "done" && (
        <div className="bg-white rounded-[24px] lg:rounded-[32px] p-8 lg:p-16 text-center border border-border shadow-sm animate-fade-in relative overflow-hidden flex flex-col items-center justify-center min-h-[400px]">
          <div className="absolute inset-x-0 bottom-0 top-1/2 bg-gradient-to-t from-emerald-50 to-transparent pointer-events-none opacity-50" />
          <div className="relative z-10 mx-auto flex size-24 items-center justify-center rounded-[24px] bg-emerald-50 border border-emerald-100 shadow-sm mb-8">
            <CheckCircle2 className="size-12 text-emerald-500" />
          </div>
          <h3 className="relative z-10 text-[24px] font-bold tracking-tight text-foreground">
            Consolidación Exitosa
          </h3>
          <p className="relative z-10 mt-3 text-[15px] text-muted-foreground max-w-md mx-auto leading-relaxed">
            El archivo ha sido indexado correctamente. Las asimetrías y paridades han sido
            insertadas en el Registry de forma persistente.
          </p>
          <div className="relative z-10 mt-10 flex justify-center">
            <button
              onClick={reset}
              className="px-8 py-3 rounded-full bg-white border border-border text-[14px] font-bold text-foreground shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              Iniciar nueva ingestión
            </button>
          </div>
        </div>
      )}

      {step === "upload" && <RecentImports imports={imports} />}
    </div>
  );
}

// ---------- Stepper ----------

function Stepper({ step }: { step: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: "upload", label: "Mount" },
    { id: "map", label: "Mapping" },
    { id: "preview", label: "Audit" },
    { id: "done", label: "Ingest" },
  ];
  const idx = steps.findIndex((s) => s.id === step);
  return (
    <div className="mb-8 flex items-center gap-1 overflow-x-auto pb-2 custom-scrollbar">
      {steps.map((s, i) => {
        const isActive = i === idx;
        const isPast = i < idx;

        return (
          <div key={s.id} className="flex items-center shrink-0">
            <div
              className={cn(
                "flex items-center gap-2.5 px-4 py-2 rounded-full text-[11px] uppercase font-bold tracking-widest transition-all",
                isActive
                  ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                  : isPast
                    ? "bg-muted/50 border border-border text-foreground"
                    : "bg-transparent text-muted-foreground/50 border border-transparent",
              )}
            >
              <span
                className={cn(
                  "size-2.5 rounded-full transition-colors",
                  isActive
                    ? "bg-emerald-500 animate-pulse-subtle"
                    : isPast
                      ? "bg-muted-foreground"
                      : "bg-border",
                )}
              />
              {s.label}
            </div>
            {i < steps.length - 1 && <div className="w-8 h-[2px] bg-border mx-2 rounded-full" />}
          </div>
        );
      })}
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
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div
        className="lg:col-span-8 bg-muted/10 rounded-[32px] border-2 border-dashed border-border overflow-hidden relative group transition-all duration-300 hover:border-emerald-300 hover:bg-emerald-50/20"
        onDragOver={(e) => {
          e.preventDefault();
          e.currentTarget.classList.add("border-emerald-400", "bg-emerald-50");
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.currentTarget.classList.remove("border-emerald-400", "bg-emerald-50");
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.currentTarget.classList.remove("border-emerald-400", "bg-emerald-50");
          if (fileInput.current && e.dataTransfer.files.length) {
            const dt = new DataTransfer();
            dt.items.add(e.dataTransfer.files[0]);
            fileInput.current.files = dt.files;
            fileInput.current.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }}
      >
        <div className="relative z-10 flex flex-col items-center justify-center py-24 text-center h-full">
          <input
            ref={fileInput}
            type="file"
            className="hidden"
            accept=".xlsx,.xls,.csv"
            onChange={onChange}
          />
          <div
            className={cn(
              "flex size-20 items-center justify-center rounded-[24px] mb-8 transition-all duration-500 shadow-sm border",
              busy
                ? "bg-white border-border shadow-inner"
                : "bg-white border-border group-hover:border-emerald-200 group-hover:bg-emerald-100/50 group-hover:scale-105",
            )}
          >
            {busy ? (
              <Loader2 className="size-8 animate-spin text-emerald-600" />
            ) : (
              <Upload className="size-8 text-muted-foreground group-hover:text-emerald-600 transition-colors duration-500" />
            )}
          </div>
          <h3 className="text-[20px] font-bold text-foreground tracking-tight">Drop Payload</h3>
          <p className="mt-3 text-[14px] text-muted-foreground font-mono bg-white px-4 py-1.5 rounded-full border border-border shadow-sm">
            Soportamos buffers .xlsx, .xls y .csv hasta 20MB
          </p>
          <button
            onClick={onPick}
            disabled={busy}
            className="mt-10 relative h-12 px-8 rounded-full bg-foreground border border-foreground text-[14px] font-bold text-white shadow-md hover:bg-muted-foreground transition-all disabled:opacity-50 hover:-translate-y-0.5"
          >
            {busy ? (
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" /> Mapeando...
              </span>
            ) : (
              "Examinar disco local"
            )}
          </button>
        </div>
      </div>

      <div className="lg:col-span-4 bg-white rounded-[32px] p-8 border border-border shadow-sm flex flex-col min-h-full">
        <h3 className="text-[14px] font-bold uppercase tracking-[0.1em] text-foreground mb-2 flex items-center gap-3 border-b border-border pb-4">
          <Terminal className="size-5 text-muted-foreground/60" /> Protocolo de Detección
        </h3>
        <p className="text-[12px] text-muted-foreground leading-relaxed mb-8 font-mono bg-muted/40 p-4 rounded-[16px] border border-border/50">
          El analizador lee dinámicamente el header y mapea las columnas conocidas del engine.
        </p>

        <div className="space-y-8 flex-1">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700 mb-4 px-2">
              Main Matrix (Requerido)
            </div>
            <ul className="space-y-3 px-2">
              {FIELD_DEFS.filter((f) => f.required).map((f) => (
                <li key={f.key} className="flex items-center gap-3">
                  <CheckCircle2 className="size-4 text-emerald-500" />
                  <span className="text-[13px] font-bold text-foreground">{f.label}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-4 px-2">
              Metadata Manual (Preservada)
            </div>
            <ul className="space-y-3 px-2">
              {FIELD_DEFS.filter((f) => f.manual).map((f) => (
                <li key={f.key} className="flex items-center gap-3">
                  <span className="size-1.5 rounded-full bg-muted-foreground/30 ml-1.5" />
                  <span className="text-[12px] font-medium text-muted-foreground">{f.label}</span>
                </li>
              ))}
            </ul>
          </div>
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
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-8 bg-white rounded-[32px] border border-border shadow-sm overflow-hidden flex flex-col">
        <div className="px-8 py-6 border-b border-border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="text-[16px] font-bold text-foreground tracking-tight">
            Indexación de Schema
          </h3>
          <div className="flex flex-wrap gap-2">
            <span className="px-2.5 py-1 rounded-[6px] bg-white border border-border text-[11px] font-bold text-muted-foreground shadow-sm">
              {parsed.fileName}
            </span>
            <span className="px-2.5 py-1 rounded-[6px] bg-white border border-border text-[11px] font-bold text-muted-foreground shadow-sm">
              {parsed.totalRows.toLocaleString("es")} Rows
            </span>
            <span className="px-2.5 py-1 rounded-[6px] bg-white border border-border text-[11px] font-bold text-muted-foreground shadow-sm">
              {parsed.headers.length} Cols
            </span>
          </div>
        </div>

        <div className="p-8 space-y-3 flex-1 bg-muted/5">
          {FIELD_DEFS.map((f) => (
            <div
              key={f.key}
              className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center p-4 rounded-[16px] bg-white border border-border shadow-sm hover:border-primary/30 transition-all group"
            >
              <div className="flex flex-col">
                <div className="text-[14px] font-bold text-foreground flex items-center gap-2">
                  {f.label}
                  {f.required && (
                    <span className="text-[14px] leading-none text-red-500 mt-1">*</span>
                  )}
                  {f.manual && (
                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground bg-muted px-2 py-0.5 rounded-[4px] border border-border">
                      Extra
                    </span>
                  )}
                </div>
              </div>
              <div className="md:col-span-2">
                <select
                  className="w-full h-12 px-4 rounded-[12px] border border-border bg-muted/40 text-[14px] font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer appearance-none shadow-inner group-focus-within:bg-white"
                  value={mapping[f.key] ?? ""}
                  onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value || undefined })}
                >
                  <option value="">— Unmapped —</option>
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

        <div className="px-8 py-5 border-t border-border bg-white flex items-center justify-between mt-auto">
          <button
            onClick={onBack}
            className="px-5 py-2.5 rounded-[12px] bg-muted/50 border border-border text-[13px] font-bold text-foreground hover:bg-muted transition-colors flex items-center gap-2"
          >
            <ArrowLeft className="size-4" /> Back
          </button>

          <button
            onClick={onNext}
            disabled={missingRequired.length > 0}
            className="px-8 py-2.5 rounded-[12px] bg-primary text-[13px] font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 hover:bg-primary/90 shadow-md hover:-translate-y-0.5"
          >
            {missingRequired.length > 0 ? (
              <span>Faltan Requeridos</span>
            ) : (
              <>
                Auditar Schema <ArrowRight className="size-4" />
              </>
            )}
          </button>
        </div>
      </div>

      <div className="lg:col-span-4 space-y-6">
        <div className="bg-white rounded-[32px] p-8 border border-border shadow-sm">
          <h3 className="text-[14px] font-bold uppercase tracking-[0.1em] text-foreground mb-2 flex items-center gap-2 border-b border-border pb-4">
            <Database className="size-5 text-muted-foreground/60" /> Red Fallback
          </h3>
          <p className="text-[12px] font-medium text-muted-foreground mt-4 mb-6 leading-relaxed">
            Aplica un identificador de Red (Lotería) global si el dataset no contiene la columna de
            forma explícita.
          </p>
          <select
            className="w-full h-14 px-5 rounded-[16px] border border-border bg-muted/40 text-[14px] font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer appearance-none shadow-inner"
            value={loteriaFallback}
            onChange={(e) => setLoteriaFallback(e.target.value)}
          >
            <option value="">— Sin Default —</option>
            {lotteries.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>

        {missingRequired.length > 0 ? (
          <div className="bg-orange-50 rounded-[24px] border border-orange-200 p-6 flex flex-col">
            <div className="size-10 rounded-full bg-white shadow-sm flex items-center justify-center text-orange-500 mb-4">
              <AlertCircle className="size-5" />
            </div>
            <div>
              <div className="text-[14px] font-bold text-orange-900 mb-2">Schema Incompleto</div>
              <div className="text-[12px] font-medium text-orange-800 leading-relaxed bg-white/50 p-3 rounded-xl border border-orange-200/50">
                Requeridos que faltan:{" "}
                <strong className="block mt-1 font-mono">
                  {missingRequired.map((f) => f.label).join(" / ")}
                </strong>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-emerald-50 rounded-[24px] border border-emerald-200 p-6 flex items-center gap-4">
            <div className="size-12 rounded-full bg-white shadow-sm flex items-center justify-center text-emerald-500 shrink-0">
              <CheckCircle2 className="size-6" />
            </div>
            <div className="text-[14px] font-bold text-emerald-900">
              Schema Autorizado.
              <br />
              <span className="text-[12px] font-medium text-emerald-700">Listo para Audit</span>
            </div>
          </div>
        )}

        <div className="bg-white rounded-[24px] border border-border p-6 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground mb-4">
            Buffer Columns
          </div>
          <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
            {parsed.headers.map((h) => (
              <span
                key={h}
                className="text-[11px] font-mono font-bold bg-muted border border-border rounded-lg px-2.5 py-1 text-muted-foreground"
              >
                {h}
              </span>
            ))}
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
  const sample = built.valid.slice(0, 8);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <SummaryCard
          label="Muestra Válida"
          value={built.valid.length}
          tone="success"
          icon={<CheckCircle2 className="size-5" />}
        />
        <SummaryCard
          label="Corrupciones"
          value={built.errors.length}
          tone={built.errors.length > 0 ? "warning" : "muted"}
          icon={<AlertCircle className="size-5" />}
        />
        <SummaryCard
          label="Blocks (Total)"
          value={parsed.totalRows}
          tone="muted"
          icon={<Server className="size-5" />}
        />
      </div>

      <div className="bg-white rounded-[32px] border border-border shadow-sm overflow-hidden">
        <div className="px-8 py-6 border-b border-border bg-muted/20 flex sm:items-center justify-between flex-col sm:flex-row gap-4">
          <div>
            <h3 className="text-[16px] font-bold text-foreground tracking-tight">Audit (Head)</h3>
            <p className="text-[13px] text-muted-foreground mt-1 font-medium">
              Inspección de las primeras {sample.length} inserciones propuestas.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              disabled={loading}
              className="px-5 py-2.5 rounded-[12px] bg-white border border-border text-[13px] font-bold text-foreground hover:bg-muted transition-colors shadow-sm"
            >
              Re-Map
            </button>
            <button
              onClick={onConfirm}
              disabled={loading || built.valid.length === 0}
              className={cn(
                "relative shrink-0 inline-flex items-center gap-2 px-6 py-2.5 rounded-[12px] transition-all font-bold text-[13px] shadow-sm",
                loading || built.valid.length === 0
                  ? "bg-muted text-muted-foreground opacity-50 cursor-not-allowed border border-border"
                  : "bg-foreground text-background hover:bg-muted-foreground hover:-translate-y-0.5",
              )}
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Database className="size-4" />
              )}
              {loading ? "INYECTANDO" : "EJECUTAR INGESTIÓN"}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-muted/10 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground border-b border-border">
              <tr>
                <th className="px-8 py-4 whitespace-nowrap">Timestamp</th>
                <th className="px-8 py-4 whitespace-nowrap">Hora</th>
                <th className="px-8 py-4 whitespace-nowrap">Red</th>
                <th className="px-8 py-4 whitespace-nowrap">Inyección</th>
                <th className="px-8 py-4 whitespace-nowrap hidden sm:table-cell">Metadata</th>
                <th className="px-8 py-4 whitespace-nowrap hidden sm:table-cell">
                  Variables Conservadas
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sample.map((r, i) => (
                <tr key={i} className="hover:bg-muted/30 transition-colors">
                  <td className="px-8 py-4 text-[13px] font-mono font-medium text-muted-foreground">
                    {r.fecha}
                  </td>
                  <td className="px-8 py-4 text-[13px] font-mono font-medium text-muted-foreground">
                    {r.hora}
                  </td>
                  <td className="px-8 py-4 text-[14px] font-bold text-foreground">{r.loteria}</td>
                  <td className="px-8 py-4">
                    <span className="font-mono text-[16px] font-extrabold text-foreground bg-muted px-3 py-1 rounded-[8px] border border-border">
                      {String(r.numero).padStart(2, "0")}
                    </span>
                  </td>
                  <td className="px-8 py-4 text-[12px] text-muted-foreground truncate max-w-[200px] hidden sm:table-cell font-medium">
                    {r.observacion ?? "—"}
                  </td>
                  <td className="px-8 py-4 hidden sm:table-cell">
                    {(() => {
                      const ma = (r.extra as { manual_analysis?: Record<string, unknown> })
                        .manual_analysis;
                      if (!ma || Object.keys(ma).length === 0) {
                        return (
                          <span className="text-muted-foreground/30 font-mono text-[11px] font-bold">
                            —
                          </span>
                        );
                      }
                      return (
                        <span className="inline-flex items-center rounded-lg bg-emerald-50 border border-emerald-200 px-2 py-1 text-[10px] font-bold tracking-widest uppercase text-emerald-700">
                          {Object.keys(ma).length} fields
                        </span>
                      );
                    })()}
                  </td>
                </tr>
              ))}
              {sample.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-muted-foreground bg-muted/10">
                    <AlertCircle className="size-8 text-orange-400 mx-auto mb-3 opacity-50" />
                    <div className="text-[14px] font-bold text-orange-800">
                      NULL SET. MAPEO INCORRECTO.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {built.errors.length > 0 && (
        <div className="bg-white rounded-[24px] border border-orange-200 overflow-hidden shadow-sm">
          <div className="px-8 py-5 border-b border-orange-200 bg-orange-50 flex items-center gap-3">
            <div className="size-8 rounded-full bg-white flex items-center justify-center text-orange-500 shadow-sm">
              <AlertCircle className="size-4" />
            </div>
            <h3 className="text-[14px] font-bold text-orange-900">
              {built.errors.length} Bloques de Datos Corrompidos
            </h3>
          </div>
          <div className="max-h-64 overflow-y-auto custom-scrollbar bg-white">
            <table className="w-full text-left">
              <tbody className="divide-y divide-border">
                {built.errors.slice(0, 50).map((e, i) => (
                  <tr key={i} className="hover:bg-muted/30">
                    <td className="py-3 px-8 text-[12px] font-mono font-bold text-muted-foreground w-24 whitespace-nowrap">
                      Row {e.index + 2}
                    </td>
                    <td className="py-3 px-8 text-[13px] font-medium text-foreground">
                      {e.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {built.errors.length > 50 && (
              <div className="p-4 text-center text-[11px] font-bold text-muted-foreground uppercase bg-muted/50 border-t border-border">
                + {built.errors.length - 50} corrupciones omitidas
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number;
  tone: "success" | "warning" | "muted";
  icon?: React.ReactNode;
}) {
  const isS = tone === "success";
  const isW = tone === "warning";

  return (
    <div
      className={cn(
        "rounded-[24px] p-6 lg:p-8 flex flex-col justify-between shadow-sm border",
        isS
          ? "bg-emerald-50 border-emerald-100"
          : isW
            ? "bg-orange-50 border-orange-100"
            : "bg-white border-border",
      )}
    >
      <div className="flex justify-between items-start mb-6">
        <div
          className={cn(
            "text-[12px] font-bold uppercase tracking-[0.1em]",
            isS ? "text-emerald-800" : isW ? "text-orange-800" : "text-muted-foreground",
          )}
        >
          {label}
        </div>
        {icon && (
          <div
            className={cn(
              "size-10 rounded-[12px] bg-white shadow-sm flex items-center justify-center",
              isS ? "text-emerald-500" : isW ? "text-orange-500" : "text-muted-foreground",
            )}
          >
            {icon}
          </div>
        )}
      </div>
      <div
        className={cn(
          "text-[40px] font-extrabold tabular-nums leading-none",
          isS ? "text-emerald-700" : isW ? "text-orange-700" : "text-foreground",
        )}
      >
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
    <div className="bg-white rounded-[32px] border border-border shadow-sm overflow-hidden mt-8">
      <div className="px-8 py-6 border-b border-border bg-muted/20">
        <h3 className="text-[15px] font-bold tracking-tight text-foreground flex items-center gap-3">
          <Terminal className="size-5 text-muted-foreground/60" /> System Logs (Ingestiones Pasadas)
        </h3>
      </div>
      {imports.length === 0 ? (
        <div className="p-16 text-center text-[13px] font-bold text-muted-foreground/50 border-2 border-dashed border-border rounded-[24px] m-8">
          NO HAY LOGS DOCUMENTADOS
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-muted/10 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground border-b border-border">
              <tr>
                <th className="px-8 py-4 whitespace-nowrap">Payload</th>
                <th className="px-8 py-4 whitespace-nowrap">Nodes Inserted</th>
                <th className="px-8 py-4 whitespace-nowrap">Dups Bypass</th>
                <th className="px-8 py-4 whitespace-nowrap">Errors</th>
                <th className="px-8 py-4 whitespace-nowrap">Estado</th>
                <th className="px-8 py-4 whitespace-nowrap">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {imports.map((r) => {
                const ok = r.estado === "completado";
                return (
                  <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-8 py-4 text-[13px] font-bold text-foreground">{r.archivo}</td>
                    <td className="px-8 py-4 text-[14px] font-mono font-semibold text-muted-foreground tabular-nums">
                      {r.registros_importados.toLocaleString("es")}
                    </td>
                    <td className="px-8 py-4 text-[14px] font-mono font-semibold text-muted-foreground tabular-nums">
                      {r.registros_duplicados}
                    </td>
                    <td className="px-8 py-4 text-[14px] font-mono font-bold text-orange-600 tabular-nums">
                      {r.errores}
                    </td>
                    <td className="px-8 py-4">
                      <span
                        className={cn(
                          "inline-flex items-center gap-2 rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest border",
                          ok
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-orange-50 text-orange-700 border-orange-200",
                        )}
                      >
                        {ok ? (
                          <CheckCircle2 className="size-3.5" />
                        ) : (
                          <AlertCircle className="size-3.5" />
                        )}
                        {ok ? "Success" : "Dirty"}
                      </span>
                    </td>
                    <td className="px-8 py-4 text-[12px] font-medium text-muted-foreground tabular-nums">
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
    <div className="bg-white border border-border shadow-sm rounded-[32px] p-8 relative overflow-hidden mb-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 gap-4">
        <div>
          <h3 className="text-[18px] font-bold text-foreground flex items-center gap-3">
            <Server className="size-5 text-primary" /> Blocks Estructurales ({parsed.blocks.length})
          </h3>
          <p className="text-[14px] text-muted-foreground mt-2 max-w-2xl leading-relaxed">
            Múltiples sub-grupos detectados. El importador unificará y paralelizará este batch
            masivo inteligentemente.
          </p>
        </div>
        <div className="text-[13px] font-bold bg-muted px-4 py-2 rounded-xl border border-border tabular-nums text-foreground">
          {parsed.totalRows.toLocaleString("es")} Total Nodes
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-64 overflow-y-auto custom-scrollbar pr-2">
        {parsed.blocks.map((b, i) => (
          <div
            key={i}
            className="bg-muted/30 rounded-[16px] border border-border p-4 text-xs flex flex-col justify-between hover:bg-muted/60 transition-colors"
          >
            <div className="font-bold text-foreground truncate text-[13px] font-mono mb-4 bg-white px-2 py-1 rounded inline-flex shadow-sm border border-border/50">
              {b.label}
            </div>
            <div className="flex items-center justify-between mt-auto">
              <span className="text-[13px] font-bold text-muted-foreground tabular-nums">
                {b.rows.length} rows
              </span>
              {b.contextoFecha && (
                <span className="tabular-nums text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md">
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
