// Lógica central de clasificación y datos demo

export type AltoBajo = "ALTO" | "BAJO";
export type ParImpar = "PAR" | "IMPAR";
export type Subcuadrante = "ALTO_PAR" | "ALTO_IMPAR" | "BAJO_PAR" | "BAJO_IMPAR";
export type Origen = "scraper" | "manual" | "excel";

/** Columnas de análisis manual extraídas del Excel del cliente y guardadas en draws.extra.manual_analysis */
export interface ManualAnalysis {
  escenario_probable?: string | number | null;
  rango?: string | number | null;
  paridad?: string | number | null;
  cuadrante?: string | number | null;
  racha_cuadr?: string | number | null;
  racha_rango?: string | number | null;
  racha_paridad?: string | number | null;
  bajo_acum?: string | number | null;
  alto_acum?: string | number | null;
  par_acum?: string | number | null;
  impar_acum?: string | number | null;
  deuda_rango?: string | number | null;
  deuda_paridad?: string | number | null;
  tend_rango_hora?: string | number | null;
  tend_paridad_hora?: string | number | null;
  [key: string]: unknown;
}

/** Campo JSONB extra del draw — contenedor tipado para manual_analysis e internos */
export interface DrawExtra {
  manual_analysis?: ManualAnalysis;
  _meta?: { bloque?: string; [key: string]: unknown };
  [key: string]: unknown;
}

export interface ClassificationConfig {
  /** Rango inferior inclusivo (ej. 0) */
  rangeMin: number;
  /** Rango superior inclusivo (ej. 99) */
  rangeMax: number;
  /** Umbral: números >= este valor son ALTO */
  altoThreshold: number;
}

export const defaultConfig: ClassificationConfig = {
  rangeMin: 0,
  rangeMax: 99,
  altoThreshold: 50,
};

export interface Sorteo {
  id: string;
  fecha: string; // YYYY-MM-DD
  hora: string; // HH:mm
  loteria: string;
  numero: number;
  altoBajo: AltoBajo;
  parImpar: ParImpar;
  subcuadrante: Subcuadrante;
  observacion?: string;
  movimiento?: string;
  origen: Origen;
  patronDetectado?: string;
  /** Datos extra — incluye manual_analysis importado del Excel */
  extra?: DrawExtra | null;
}

export function classify(numero: number, cfg: ClassificationConfig = defaultConfig) {
  const altoBajo: AltoBajo = numero >= cfg.altoThreshold ? "ALTO" : "BAJO";
  const parImpar: ParImpar = numero % 2 === 0 ? "PAR" : "IMPAR";
  const subcuadrante = `${altoBajo}_${parImpar}` as Subcuadrante;
  return { altoBajo, parImpar, subcuadrante };
}

export const subcuadranteLabel: Record<Subcuadrante, string> = {
  ALTO_PAR: "Alto Par",
  ALTO_IMPAR: "Alto Impar",
  BAJO_PAR: "Bajo Par",
  BAJO_IMPAR: "Bajo Impar",
};

// ---------- Demo data ----------

const LOTERIAS_DEMO = ["Quiniela Diaria", "Sorteo Horario", "Tarde Express"];

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

export function generateDemoHistory(days = 30, cfg: ClassificationConfig = defaultConfig): Sorteo[] {
  const rand = seededRandom(42);
  const horas = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00"];
  const out: Sorteo[] = [];
  const today = new Date();

  for (let d = days - 1; d >= 0; d--) {
    const date = new Date(today);
    date.setDate(today.getDate() - d);
    const fecha = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

    for (const hora of horas) {
      // Sólo hasta la hora actual si es hoy
      if (d === 0) {
        const [hh] = hora.split(":");
        if (parseInt(hh) > today.getHours()) continue;
      }
      for (const loteria of LOTERIAS_DEMO) {
        const numero = Math.floor(rand() * (cfg.rangeMax - cfg.rangeMin + 1)) + cfg.rangeMin;
        const c = classify(numero, cfg);
        out.push({
          id: `${fecha}-${hora}-${loteria}-${numero}`,
          fecha,
          hora,
          loteria,
          numero,
          ...c,
          origen: d > 7 ? "excel" : d > 1 ? "scraper" : "manual",
        });
      }
    }
  }
  return out;
}

// ---------- Análisis ----------

export interface BalanceStats {
  altos: number;
  bajos: number;
  pares: number;
  impares: number;
  total: number;
  pctAltos: number;
  pctBajos: number;
  pctPares: number;
  pctImpares: number;
}

export function computeBalance(sorteos: Sorteo[]): BalanceStats {
  const altos = sorteos.filter((s) => s.altoBajo === "ALTO").length;
  const bajos = sorteos.length - altos;
  const pares = sorteos.filter((s) => s.parImpar === "PAR").length;
  const impares = sorteos.length - pares;
  const total = sorteos.length || 1;
  return {
    altos,
    bajos,
    pares,
    impares,
    total: sorteos.length,
    pctAltos: (altos / total) * 100,
    pctBajos: (bajos / total) * 100,
    pctPares: (pares / total) * 100,
    pctImpares: (impares / total) * 100,
  };
}

export interface Racha {
  tipo: string;
  valor: string;
  longitud: number;
}

export function computeRachas(sorteos: Sorteo[]): Racha[] {
  if (sorteos.length === 0) return [];
  const ordered = [...sorteos].sort((a, b) =>
    `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`),
  );
  const last = ordered[ordered.length - 1];
  const out: Racha[] = [];

  // Racha alto/bajo
  let n = 1;
  for (let i = ordered.length - 2; i >= 0; i--) {
    if (ordered[i].altoBajo === last.altoBajo) n++;
    else break;
  }
  if (n >= 2) out.push({ tipo: "Alto/Bajo", valor: last.altoBajo, longitud: n });

  // Racha par/impar
  let m = 1;
  for (let i = ordered.length - 2; i >= 0; i--) {
    if (ordered[i].parImpar === last.parImpar) m++;
    else break;
  }
  if (m >= 2) out.push({ tipo: "Par/Impar", valor: last.parImpar, longitud: m });

  // Repetición de subcuadrante
  let k = 1;
  for (let i = ordered.length - 2; i >= 0; i--) {
    if (ordered[i].subcuadrante === last.subcuadrante) k++;
    else break;
  }
  if (k >= 2) out.push({ tipo: "Cuadrante", valor: subcuadranteLabel[last.subcuadrante], longitud: k });

  return out;
}

export interface FrecuenciaItem {
  numero: number;
  count: number;
  ultimaAparicion?: string;
}

export function computeFrecuencias(sorteos: Sorteo[], cfg = defaultConfig): FrecuenciaItem[] {
  const map = new Map<number, FrecuenciaItem>();
  for (let n = cfg.rangeMin; n <= cfg.rangeMax; n++) {
    map.set(n, { numero: n, count: 0 });
  }
  const ordered = [...sorteos].sort((a, b) =>
    `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`),
  );
  for (const s of ordered) {
    const item = map.get(s.numero);
    if (item) {
      item.count++;
      item.ultimaAparicion = `${s.fecha} ${s.hora}`;
    }
  }
  return Array.from(map.values());
}

export interface EscenarioProbable {
  escenario: string;
  porcentaje: number;
  razones: string[];
}

export function computeEscenarioProbable(sorteos: Sorteo[]): EscenarioProbable {
  const balance = computeBalance(sorteos.slice(-20));
  const razones: string[] = [];
  let lean: { ab: AltoBajo; pi: ParImpar } = { ab: "BAJO", pi: "PAR" };
  let score = 50;

  if (balance.pctAltos > 60) {
    lean.ab = "BAJO";
    score += 12;
    razones.push(`Exceso de ALTOS detectado (${balance.pctAltos.toFixed(0)}%) en últimos 20 sorteos`);
  } else if (balance.pctBajos > 60) {
    lean.ab = "ALTO";
    score += 12;
    razones.push(`Exceso de BAJOS detectado (${balance.pctBajos.toFixed(0)}%) en últimos 20 sorteos`);
  }
  if (balance.pctPares > 60) {
    lean.pi = "IMPAR";
    score += 10;
    razones.push(`Exceso de PARES (${balance.pctPares.toFixed(0)}%) — compensación esperada`);
  } else if (balance.pctImpares > 60) {
    lean.pi = "PAR";
    score += 10;
    razones.push(`Exceso de IMPARES (${balance.pctImpares.toFixed(0)}%) — compensación esperada`);
  }

  const rachas = computeRachas(sorteos);
  for (const r of rachas) {
    if (r.longitud >= 3) {
      razones.push(`Racha activa de ${r.longitud} ${r.valor} consecutivos — patrón histórico 7/10 sugiere ruptura`);
      score = Math.min(score + 6, 88);
    }
  }
  if (razones.length === 0) {
    razones.push("Comportamiento equilibrado actual; sin señales fuertes en últimos 20 sorteos");
  }

  return {
    escenario: `${lean.ab === "BAJO" ? "Bajo" : "Alto"} + ${lean.pi === "PAR" ? "Par" : "Impar"}`,
    porcentaje: Math.min(score, 88),
    razones,
  };
}
