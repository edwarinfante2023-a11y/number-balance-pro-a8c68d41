/**
 * Tipos compartidos limpios para el motor sin dependencia del frontend
 */
export interface SorteoExterno {
  id?: string;
  fecha: string;
  hora: string;
  numeros: number[];
  super_x: string | null;
}

export interface RuleExterno {
  id?: string;
  nombre: string;
  descripcion?: string | null;
  tipo: "racha" | "compensacion" | "patron" | "bloqueo" | "otro";
  condiciones: any;
  resultado_esperado?: string | null;
  activo: boolean;
  ocurrencias?: number;
  aciertos?: number;
  efectividad?: number;
}

export interface PatternExterno {
  id?: string;
  nombre: string;
  descripcion: string;
  tipo: string;
  condiciones: any;
  resultado_esperado?: string | null;
  ocurrencias: number;
  aciertos: number;
  efectividad: number;
  estado?: string;
  activa?: boolean;
  hora?: string | null;
  source?: string;
}

// Para alertas
export interface AlertInsertExterno {
  tipo: string;
  descripcion: string;
  nivel: "info" | "warning" | "critical";
  estado: string;
  score: number;
  hora: string;
  fecha: string;
  activa: boolean;
  contexto?: any;
}

export interface AlertRowExterno extends AlertInsertExterno {
  id: string;
  created_at: string;
}
