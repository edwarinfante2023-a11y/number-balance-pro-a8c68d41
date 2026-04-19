import * as XLSX from "xlsx";

export type RawRow = Record<string, unknown>;
export type Cell = unknown;

export interface SheetMatrix {
  sheetName: string;
  /** Matriz cruda completa (array de arrays). Se usa para detectar bloques. */
  matrix: Cell[][];
}

export interface DetectedBlock {
  /** Nombre identificativo (ej: "Bloque 19-feb-26" o "Hoja 1") */
  label: string;
  sheetName: string;
  /** Índice (0-based) de la fila de encabezados dentro de la matriz original */
  headerRowIndex: number;
  /** Índice (0-based) primera fila de datos */
  dataStartIndex: number;
  /** Índice (0-based) última fila de datos (inclusive) */
  dataEndIndex: number;
  /** Encabezados normalizados de este bloque */
  headers: string[];
  /** Filas como objetos {header: value} */
  rows: RawRow[];
  /** Fecha contextual detectada arriba del bloque (ej: "19-feb-26") */
  contextoFecha?: string;
}

export interface ParsedFile {
  fileName: string;
  /** Bloques detectados (uno o varios). */
  blocks: DetectedBlock[];
  /** Encabezados unificados (unión de todos los bloques) usado para mapeo. */
  headers: string[];
  /** Filas combinadas de TODOS los bloques (con _bloque y _fechaCtx incrustadas). */
  rows: RawRow[];
  totalRows: number;
}

// ---------- Lectura cruda ----------

function readSheetMatrix(file: File): Promise<SheetMatrix[]> {
  return file.arrayBuffer().then((buf) => {
    const wb = XLSX.read(buf, { type: "array", cellDates: true });
    return wb.SheetNames.map((name) => {
      const ws = wb.Sheets[name];
      const matrix = XLSX.utils.sheet_to_json<Cell[]>(ws, {
        header: 1,
        defval: "",
        raw: false,
        blankrows: true,
      });
      return { sheetName: name, matrix };
    });
  });
}

// ---------- Detección de bloques ----------

/** Tokens que típicamente aparecen en la fila de encabezados real */
const HEADER_TOKENS = [
  "hora",
  "primer premio",
  "primero",
  "numero",
  "número",
  "rango",
  "paridad",
  "cuadrante",
];

const DATE_REGEX =
  /(\d{1,2})[-/\s](?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic|january|february|march|april|may|june|july|august|september|october|november|december|\d{1,2})[-/\s]?(\d{2,4})?/i;

function normalizeText(s: unknown): string {
  if (s == null) return "";
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isHeaderRow(row: Cell[]): boolean {
  const cells = row.map((c) => normalizeText(c)).filter((c) => c.length > 0);
  if (cells.length < 3) return false;
  const score = cells.reduce(
    (acc, c) => acc + (HEADER_TOKENS.some((t) => c === t || c.includes(t)) ? 1 : 0),
    0,
  );
  return score >= 2; // al menos 2 tokens conocidos
}

function isHourCell(v: unknown): boolean {
  if (v == null || v === "") return false;
  if (v instanceof Date) return true;
  if (typeof v === "number") return v > 0 && v < 1; // fracción Excel
  const s = String(v).trim().toUpperCase();
  return /^\d{1,2}(:\d{1,2})?(\s*(AM|PM))?$/.test(s);
}

function findContextDate(matrix: Cell[][], beforeRow: number): string | undefined {
  for (let i = beforeRow - 1; i >= Math.max(0, beforeRow - 6); i--) {
    const row = matrix[i] ?? [];
    for (const c of row) {
      if (c instanceof Date && !isNaN(c.getTime())) {
        return c.toISOString().slice(0, 10);
      }
      const s = String(c ?? "").trim();
      if (s && DATE_REGEX.test(s)) return s;
    }
  }
  return undefined;
}

/** Detecta uno o varios bloques de tabla dentro de la matriz. */
export function detectBlocks(matrix: Cell[][], sheetName: string): DetectedBlock[] {
  const blocks: DetectedBlock[] = [];
  let i = 0;
  let blockIdx = 0;
  while (i < matrix.length) {
    const row = matrix[i] ?? [];
    if (!isHeaderRow(row)) {
      i++;
      continue;
    }
    // Encontramos cabecera
    const headerRowIndex = i;
    const headers = row.map((c, idx) => {
      const v = String(c ?? "").trim();
      return v || `col_${idx + 1}`;
    });
    // Filas de datos hasta encontrar otra cabecera o sección sin hora
    let dataStart = i + 1;
    let dataEnd = dataStart - 1;
    let blanks = 0;
    let j = dataStart;
    for (; j < matrix.length; j++) {
      const r = matrix[j] ?? [];
      // Otra cabecera empieza un nuevo bloque
      if (isHeaderRow(r)) break;
      const allEmpty = r.every((c) => c == null || String(c).trim() === "");
      if (allEmpty) {
        blanks++;
        if (blanks >= 3) break; // 3 vacías seguidas cierra bloque
        continue;
      }
      blanks = 0;
      // Validamos que tenga pinta de fila de datos: primera o segunda celda parece hora
      const hasHour = isHourCell(r[0]) || isHourCell(r[1]);
      // Si no hay hora pero hay número en la 2da columna, también lo aceptamos
      const hasNum = r.slice(0, 5).some((c) => /^\d{1,4}$/.test(String(c ?? "").trim()));
      if (!hasHour && !hasNum) {
        // probablemente fila decorativa o resumen → la saltamos
        continue;
      }
      dataEnd = j;
    }

    if (dataEnd >= dataStart) {
      const contextoFecha = findContextDate(matrix, headerRowIndex);
      const rows: RawRow[] = [];
      for (let k = dataStart; k <= dataEnd; k++) {
        const r = matrix[k] ?? [];
        const allEmpty = r.every((c) => c == null || String(c).trim() === "");
        if (allEmpty) continue;
        const hasHour = isHourCell(r[0]) || isHourCell(r[1]);
        const hasNum = r.slice(0, 5).some((c) => /^\d{1,4}$/.test(String(c ?? "").trim()));
        if (!hasHour && !hasNum) continue;

        const obj: RawRow = {};
        headers.forEach((h, idx) => {
          obj[h] = r[idx] ?? "";
        });
        // Inyectar metadata para uso posterior
        obj["__bloque"] = `${sheetName} #${blockIdx + 1}`;
        if (contextoFecha) obj["__fechaCtx"] = contextoFecha;
        rows.push(obj);
      }

      if (rows.length > 0) {
        blocks.push({
          label: contextoFecha
            ? `${sheetName} · ${contextoFecha}`
            : `${sheetName} · bloque ${blockIdx + 1}`,
          sheetName,
          headerRowIndex,
          dataStartIndex: dataStart,
          dataEndIndex: dataEnd,
          headers,
          rows,
          contextoFecha,
        });
        blockIdx++;
      }
    }
    i = j; // continuar desde donde paramos
  }
  return blocks;
}

/** Lee un .xlsx/.xls/.csv y detecta bloques diarios automáticamente. */
export async function parseSpreadsheet(file: File): Promise<ParsedFile> {
  const sheets = await readSheetMatrix(file);
  const allBlocks: DetectedBlock[] = [];
  for (const s of sheets) {
    const blocks = detectBlocks(s.matrix, s.sheetName);
    allBlocks.push(...blocks);
  }

  // Fallback: si no detectamos ningún bloque, tratar primera hoja como tabla plana
  if (allBlocks.length === 0 && sheets[0]) {
    const m = sheets[0].matrix;
    const headerIdx = m.findIndex((r) => r.some((c) => String(c ?? "").trim() !== ""));
    if (headerIdx >= 0) {
      const headers = (m[headerIdx] ?? []).map((c, i) => String(c ?? "").trim() || `col_${i + 1}`);
      const rows: RawRow[] = [];
      for (let k = headerIdx + 1; k < m.length; k++) {
        const r = m[k] ?? [];
        if (r.every((c) => c == null || String(c).trim() === "")) continue;
        const obj: RawRow = {};
        headers.forEach((h, idx) => (obj[h] = r[idx] ?? ""));
        obj["__bloque"] = sheets[0].sheetName;
        rows.push(obj);
      }
      allBlocks.push({
        label: `${sheets[0].sheetName} (tabla plana)`,
        sheetName: sheets[0].sheetName,
        headerRowIndex: headerIdx,
        dataStartIndex: headerIdx + 1,
        dataEndIndex: m.length - 1,
        headers,
        rows,
      });
    }
  }

  if (allBlocks.length === 0) throw new Error("No se detectaron bloques de datos en el archivo");

  // Unificar headers (preservando orden de aparición)
  const headerSet = new Set<string>();
  for (const b of allBlocks) for (const h of b.headers) headerSet.add(h);
  const headers = Array.from(headerSet);

  const rows: RawRow[] = allBlocks.flatMap((b) => b.rows);

  return {
    fileName: file.name,
    blocks: allBlocks,
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
  // columnas de análisis manual (preservadas en extra/observación)
  | "rango"
  | "paridad"
  | "cuadrante_manual"
  | "bajo_acum"
  | "alto_acum"
  | "par_acum"
  | "impar_acum"
  | "deuda_rango"
  | "deuda_paridad"
  | "tend_rango_hora"
  | "tend_paridad_hora"
  | "escenario_probable"
  | "racha_cuadr"
  | "racha_rango"
  | "racha_paridad"
  | "observacion"
  | "movimiento";

export interface FieldDef {
  key: FieldKey;
  label: string;
  required: boolean;
  aliases: string[];
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
  { key: "rango", label: "Rango", required: false, manual: true, aliases: ["rango", "range"] },
  {
    key: "paridad",
    label: "Paridad",
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
    key: "par_acum",
    label: "Par acum.",
    required: false,
    manual: true,
    aliases: ["par acum", "par acumulado", "pares acum"],
  },
  {
    key: "impar_acum",
    label: "Impar acum.",
    required: false,
    manual: true,
    aliases: ["impar acum", "impar acumulado", "impares acum"],
  },
  {
    key: "deuda_rango",
    label: "Deuda rango",
    required: false,
    manual: true,
    aliases: ["deuda rango", "deuda r", "debt range"],
  },
  {
    key: "deuda_paridad",
    label: "Deuda paridad",
    required: false,
    manual: true,
    aliases: ["deuda paridad", "deuda p"],
  },
  {
    key: "tend_rango_hora",
    label: "Tend. rango hora",
    required: false,
    manual: true,
    aliases: ["tend rango hora", "tendencia rango hora", "tend rango"],
  },
  {
    key: "tend_paridad_hora",
    label: "Tend. paridad hora",
    required: false,
    manual: true,
    aliases: ["tend paridad hora", "tendencia paridad hora", "tend paridad"],
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
    aliases: ["racha cuadr", "racha cuadrante", "racha c", "streak cuadr"],
  },
  {
    key: "racha_rango",
    label: "Racha rango",
    required: false,
    manual: true,
    aliases: ["racha rango", "racha r", "streak range"],
  },
  {
    key: "racha_paridad",
    label: "Racha paridad",
    required: false,
    manual: true,
    aliases: ["racha paridad", "racha p", "streak parity"],
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
  return normalizeText(s);
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

export function normalizeFecha(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    return v.toISOString().slice(0, 10);
  }
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return `${d.y.toString().padStart(4, "0")}-${d.m.toString().padStart(2, "0")}-${d.d.toString().padStart(2, "0")}`;
  }
  const s = String(v).trim();
  const ymd = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(s);
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, "0")}-${ymd[3].padStart(2, "0")}`;
  const dmy = /^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/.exec(s);
  if (dmy) {
    let y = dmy[3];
    if (y.length === 2) y = (parseInt(y) > 50 ? "19" : "20") + y;
    return `${y}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }
  // dd-mes-yy (español: 19-feb-26)
  const monthNames: Record<string, number> = {
    ene: 1,
    enero: 1,
    feb: 2,
    febrero: 2,
    mar: 3,
    marzo: 3,
    abr: 4,
    abril: 4,
    may: 5,
    mayo: 5,
    jun: 6,
    junio: 6,
    jul: 7,
    julio: 7,
    ago: 8,
    agosto: 8,
    sep: 9,
    sept: 9,
    septiembre: 9,
    oct: 10,
    octubre: 10,
    nov: 11,
    noviembre: 11,
    dic: 12,
    diciembre: 12,
  };
  const dmes = /^(\d{1,2})[-/\s]([a-záéíóú]+)[-/\s]?(\d{2,4})?$/i.exec(s);
  if (dmes) {
    const day = parseInt(dmes[1]);
    const monKey = normalize(dmes[2]).slice(0, 4);
    const monShort = normalize(dmes[2]).slice(0, 3);
    const m = monthNames[normalize(dmes[2])] ?? monthNames[monKey] ?? monthNames[monShort];
    if (m) {
      let y = dmes[3] ? parseInt(dmes[3]) : new Date().getFullYear();
      if (y < 100) y = (y > 50 ? 1900 : 2000) + y;
      return `${y.toString().padStart(4, "0")}-${m.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
    }
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

export function normalizeHora(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) {
    return `${v.getHours().toString().padStart(2, "0")}:${v.getMinutes().toString().padStart(2, "0")}`;
  }
  if (typeof v === "number") {
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
  "par_acum",
  "impar_acum",
  "deuda_rango",
  "deuda_paridad",
  "tend_rango_hora",
  "tend_paridad_hora",
  "escenario_probable",
  "racha_cuadr",
  "racha_rango",
  "racha_paridad",
];

export function buildRows(rows: RawRow[], opts: BuildOptions): BuildResult {
  const valid: BuiltRow[] = [];
  const errors: BuildError[] = [];
  const { mapping } = opts;
  const seenKeys = new Set<string>();

  rows.forEach((row, i) => {
    const fechaRaw = mapping.fecha ? row[mapping.fecha] : null;
    const horaRaw = mapping.hora ? row[mapping.hora] : null;
    const numRaw = mapping.numero ? row[mapping.numero] : null;
    const lotRaw = mapping.loteria ? row[mapping.loteria] : null;

    // Si no hay fecha en la fila, usar la fecha contextual del bloque
    const fecha = normalizeFecha(fechaRaw) ?? normalizeFecha(row["__fechaCtx"]) ?? null;
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

    // Duplicados dentro del mismo archivo
    const key = `${fecha}|${hora}|${loteria}`;
    if (seenKeys.has(key)) {
      errors.push({
        index: i,
        message: `Duplicado en archivo: ${fecha} ${hora} ${loteria}`,
        raw: row,
      });
      return;
    }
    seenKeys.add(key);

    // manual_analysis: solo las columnas analíticas del cliente
    const manualAnalysis: Record<string, unknown> = {};
    for (const k of MANUAL_KEYS) {
      const col = mapping[k];
      if (col && row[col] !== "" && row[col] != null) {
        manualAnalysis[k] = row[col];
      }
    }

    // extra: contenedor que separa manual_analysis del metadata interno
    const extra: Record<string, unknown> = {};
    if (Object.keys(manualAnalysis).length > 0) {
      extra.manual_analysis = manualAnalysis;
    }
    if (row["__bloque"]) {
      extra._meta = { bloque: row["__bloque"] };
    }

    // Resumen humano legible para el campo observacion
    const obsParts: string[] = [];
    if (mapping.observacion && row[mapping.observacion]) {
      obsParts.push(String(row[mapping.observacion]));
    }
    if (manualAnalysis.escenario_probable) {
      obsParts.push(`Esc: ${manualAnalysis.escenario_probable}`);
    }
    if (manualAnalysis.racha_cuadr) obsParts.push(`R.cuadr: ${manualAnalysis.racha_cuadr}`);
    if (manualAnalysis.racha_rango) obsParts.push(`R.rango: ${manualAnalysis.racha_rango}`);
    if (manualAnalysis.racha_paridad) obsParts.push(`R.par: ${manualAnalysis.racha_paridad}`);

    valid.push({
      fecha,
      hora,
      loteria,
      numero,
      observacion: obsParts.length ? obsParts.join(" · ") : null,
      movimiento:
        mapping.movimiento && row[mapping.movimiento] ? String(row[mapping.movimiento]) : null,
      extra,
    });
  });

  return { valid, errors };
}
