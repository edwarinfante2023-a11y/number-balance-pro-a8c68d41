import * as XLSX from "xlsx";

export type RawRow = Record<string, unknown>;

export interface ParsedFile {
  fileName: string;
  headers: string[];
  rows: RawRow[];
  totalRows: number;
}

/** Lee un archivo .xlsx/.xls/.csv y devuelve filas como objetos. */
export async function parseSpreadsheet(file: File): Promise<ParsedFile> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const firstSheet = wb.SheetNames[0];
  if (!firstSheet) throw new Error("El archivo no contiene hojas");
  const ws = wb.Sheets[firstSheet];

  // defval: "" para mantener columnas vacías; raw:false para que fechas vengan formateadas
  const rows = XLSX.utils.sheet_to_json<RawRow>(ws, { defval: "", raw: false });
  const headers = rows.length
    ? Object.keys(rows[0])
    : (XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 })[0] ?? []);

  return {
    fileName: file.name,
    headers,
    rows,
    totalRows: rows.length,
  };
}

// ---------- Mapeo / detección automática ----------

export type FieldKey =
  | "fecha"
  | "hora"
  | "loteria"
  | "numero"
  // columnas opcionales que se guardan como referencia manual
  | "rango"
  | "paridad"
  | "cuadrante_manual"
  | "bajo_acum"
  | "alto_acum"
  | "deuda_rango"
  | "escenario_probable"
  | "racha_cuadr"
  | "observacion"
  | "movimiento";

export interface FieldDef {
  key: FieldKey;
  label: string;
  required: boolean;
  /** Patrones de nombre de columna (lowercase, sin acentos) */
  aliases: string[];
  /** Si es una columna de "análisis manual" se guarda en extra/observacion */
  manual?: boolean;
}

export const FIELD_DEFS: FieldDef[] = [
  { key: "fecha", label: "Fecha", required: true, aliases: ["fecha", "date", "dia", "día"] },
  { key: "hora", label: "Hora", required: true, aliases: ["hora", "time", "hr"] },
  {
    key: "loteria",
    label: "Lotería",
    required: true,
    aliases: ["loteria", "lotería", "sorteo", "juego", "lottery"],
  },
  {
    key: "numero",
    label: "Número",
    required: true,
    aliases: [
      "numero",
      "número",
      "primer premio",
      "primero",
      "ganador",
      "resultado",
      "number",
      "num",
    ],
  },
  { key: "rango", label: "Rango (manual)", required: false, manual: true, aliases: ["rango", "range"] },
  {
    key: "paridad",
    label: "Paridad (manual)",
    required: false,
    manual: true,
    aliases: ["paridad", "par/impar", "par impar", "parity"],
  },
  {
    key: "cuadrante_manual",
    label: "Cuadrante (manual)",
    required: false,
    manual: true,
    aliases: ["cuadrante", "quadrant", "cuadr"],
  },
  {
    key: "bajo_acum",
    label: "Bajo acum.",
    required: false,
    manual: true,
    aliases: ["bajo acum", "bajo acumulado", "bajos acum", "acum bajo"],
  },
  {
    key: "alto_acum",
    label: "Alto acum.",
    required: false,
    manual: true,
    aliases: ["alto acum", "alto acumulado", "altos acum", "acum alto"],
  },
  {
    key: "deuda_rango",
    label: "Deuda rango",
    required: false,
    manual: true,
    aliases: ["deuda rango", "deuda", "debt"],
  },
  {
    key: "escenario_probable",
    label: "Escenario probable",
    required: false,
    manual: true,
    aliases: ["escenario probable", "escenario", "probable", "scenario"],
  },
  {
    key: "racha_cuadr",
    label: "Racha cuadrante",
    required: false,
    manual: true,
    aliases: ["racha cuadr", "racha cuadrante", "racha", "streak"],
  },
  {
    key: "observacion",
    label: "Observación",
    required: false,
    aliases: ["observacion", "observación", "nota", "comentario", "obs"],
  },
  {
    key: "movimiento",
    label: "Movimiento",
    required: false,
    aliases: ["movimiento", "mov", "movement"],
  },
];

function normalize(s: string): string {
  return s
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Devuelve un mapeo {fieldKey: columnaDelExcel} basado en aliases. */
export function autoDetectMapping(headers: string[]): Partial<Record<FieldKey, string>> {
  const norm = headers.map((h) => ({ original: h, n: normalize(h) }));
  const map: Partial<Record<FieldKey, string>> = {};
  for (const def of FIELD_DEFS) {
    const found = norm.find((h) => def.aliases.some((a) => h.n === normalize(a)));
    const partial = !found
      ? norm.find((h) => def.aliases.some((a) => h.n.includes(normalize(a))))
      : found;
    if (partial && !Object.values(map).includes(partial.original)) {
      map[def.key] = partial.original;
    }
  }
  return map;
}

// ---------- Normalización de valores ----------

/** Convierte cualquier valor de fecha (Date, string, número Excel) a YYYY-MM-DD */
export function normalizeFecha(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    return v.toISOString().slice(0, 10);
  }
  if (typeof v === "number") {
    // Serial Excel
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return `${d.y.toString().padStart(4, "0")}-${d.m.toString().padStart(2, "0")}-${d.d.toString().padStart(2, "0")}`;
  }
  const s = String(v).trim();
  // formatos comunes: dd/mm/yyyy, yyyy-mm-dd, dd-mm-yyyy
  const ymd = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(s);
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, "0")}-${ymd[3].padStart(2, "0")}`;
  const dmy = /^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/.exec(s);
  if (dmy) {
    let y = dmy[3];
    if (y.length === 2) y = (parseInt(y) > 50 ? "19" : "20") + y;
    return `${y}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

/** Convierte hora a HH:mm (24h). Acepta "9:00", "9:00 AM", "21:30", número decimal, etc. */
export function normalizeHora(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) {
    return `${v.getHours().toString().padStart(2, "0")}:${v.getMinutes().toString().padStart(2, "0")}`;
  }
  if (typeof v === "number") {
    // Excel time fraction
    const total = Math.round(v * 24 * 60);
    const hh = Math.floor(total / 60) % 24;
    const mm = total % 60;
    return `${hh.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}`;
  }
  const s = String(v).trim().toUpperCase();
  const ampm = /^(\d{1,2})(?::(\d{1,2}))?\s*(AM|PM)$/.exec(s);
  if (ampm) {
    let h = parseInt(ampm[1]);
    const m = ampm[2] ? parseInt(ampm[2]) : 0;
    if (ampm[3] === "PM" && h < 12) h += 12;
    if (ampm[3] === "AM" && h === 12) h = 0;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  }
  const hm = /^(\d{1,2}):(\d{1,2})/.exec(s);
  if (hm) return `${hm[1].padStart(2, "0")}:${hm[2].padStart(2, "0")}`;
  const onlyH = /^(\d{1,2})$/.exec(s);
  if (onlyH) return `${onlyH[1].padStart(2, "0")}:00`;
  return null;
}

export function normalizeNumero(v: unknown, min = 0, max = 99): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseInt(String(v).replace(/\D/g, ""), 10);
  if (!Number.isFinite(n)) return null;
  if (n < min || n > max) return null;
  return Math.trunc(n);
}

// ---------- Construcción de filas para insertar ----------

export interface BuildOptions {
  mapping: Partial<Record<FieldKey, string>>;
  loteriaFallback?: string;
  rangeMin: number;
  rangeMax: number;
}

export interface BuiltRow {
  fecha: string;
  hora: string;
  loteria: string;
  numero: number;
  observacion: string | null;
  movimiento: string | null;
  extra: Record<string, unknown>;
}

export interface BuildError {
  index: number;
  message: string;
  raw: RawRow;
}

export interface BuildResult {
  valid: BuiltRow[];
  errors: BuildError[];
}

const MANUAL_KEYS: FieldKey[] = [
  "rango",
  "paridad",
  "cuadrante_manual",
  "bajo_acum",
  "alto_acum",
  "deuda_rango",
  "escenario_probable",
  "racha_cuadr",
];

export function buildRows(rows: RawRow[], opts: BuildOptions): BuildResult {
  const valid: BuiltRow[] = [];
  const errors: BuildError[] = [];
  const { mapping } = opts;

  rows.forEach((row, i) => {
    const fechaRaw = mapping.fecha ? row[mapping.fecha] : null;
    const horaRaw = mapping.hora ? row[mapping.hora] : null;
    const numRaw = mapping.numero ? row[mapping.numero] : null;
    const lotRaw = mapping.loteria ? row[mapping.loteria] : null;

    const fecha = normalizeFecha(fechaRaw);
    const hora = normalizeHora(horaRaw);
    const numero = normalizeNumero(numRaw, opts.rangeMin, opts.rangeMax);
    const loteria = (lotRaw ? String(lotRaw).trim() : "") || opts.loteriaFallback || "";

    if (!fecha) {
      errors.push({ index: i, message: `Fecha inválida (${String(fechaRaw)})`, raw: row });
      return;
    }
    if (!hora) {
      errors.push({ index: i, message: `Hora inválida (${String(horaRaw)})`, raw: row });
      return;
    }
    if (numero == null) {
      errors.push({
        index: i,
        message: `Número inválido o fuera de rango ${opts.rangeMin}-${opts.rangeMax} (${String(numRaw)})`,
        raw: row,
      });
      return;
    }
    if (!loteria) {
      errors.push({ index: i, message: "Lotería vacía y sin valor por defecto", raw: row });
      return;
    }

    // Recolectar columnas manuales en `extra`
    const extra: Record<string, unknown> = {};
    for (const k of MANUAL_KEYS) {
      const col = mapping[k];
      if (col && row[col] !== "" && row[col] != null) extra[k] = row[col];
    }
    // Construir observación legible si hay escenario / racha manuales
    const obsParts: string[] = [];
    if (mapping.observacion && row[mapping.observacion]) {
      obsParts.push(String(row[mapping.observacion]));
    }
    if (extra.escenario_probable) obsParts.push(`Esc: ${extra.escenario_probable}`);
    if (extra.racha_cuadr) obsParts.push(`Racha: ${extra.racha_cuadr}`);

    valid.push({
      fecha,
      hora,
      loteria,
      numero,
      observacion: obsParts.length ? obsParts.join(" · ") : null,
      movimiento: mapping.movimiento && row[mapping.movimiento] ? String(row[mapping.movimiento]) : null,
      extra,
    });
  });

  return { valid, errors };
}
