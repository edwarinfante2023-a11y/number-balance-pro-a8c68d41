import type { HourOpportunity, OpportunityRanking } from "./opportunityEngine.ts";
import type { AlertInsertExterno as AlertInsert, AlertRowExterno as AlertRow } from "./types.ts";
import { APP_TIME_ZONE, formatDateInTimeZone } from "./timezone.ts";

export type { AlertInsert, AlertRow };

// ─── Configuración del engine de alertas ─────────────────────────────────────

export interface AlertEngineConfig {
  /** Score mínimo para generar alerta (default: 75) */
  minScore: number;
  /** Máximo de alertas por corrida para evitar spam (default: 5) */
  maxAlertsPerRun: number;
  /** Diferencia mínima de score para considerar una escalación (default: 10) */
  escalationThreshold: number;
  /** Máximo de escalaciones permitidas por slot/día (default: 2) */
  maxEscalationsPerSlot: number;
  /** Zona horaria operativa de la lotería */
  timeZone: string;
}

export const DEFAULT_ALERT_CONFIG: AlertEngineConfig = {
  minScore: 75,
  maxAlertsPerRun: 5,
  escalationThreshold: 10,
  maxEscalationsPerSlot: 2,
  timeZone: APP_TIME_ZONE,
};

// ─── Utilidad de fecha con timezone correcto ─────────────────────────────────

/**
 * Devuelve la fecha local "yyyy-MM-dd" ajustada a la zona horaria configurada.
 * Evita el bug donde UTC devuelve la fecha del día siguiente después de las 8pm AST.
 */
export function getTodayLocal(timeZone: string = APP_TIME_ZONE): string {
  return formatDateInTimeZone(new Date(), timeZone);
}

// ─── Generación de alertas ───────────────────────────────────────────────────

/**
 * Escanea el ranking actual de Nivel 5 y empaqueta alertas potenciales.
 * Respeta el umbral configurable y limita la cantidad por corrida.
 */
export function generateAlertsFromRanking(
  ranking: OpportunityRanking,
  config: AlertEngineConfig = DEFAULT_ALERT_CONFIG,
): AlertInsert[] {
  const today = getTodayLocal(config.timeZone);

  const candidates = ranking.ranking
    .filter((opp) => opp.nivel === "ALTO" || opp.score >= config.minScore)
    .sort((a, b) => b.score - a.score) // Priorizar los de mayor score
    .slice(0, config.maxAlertsPerRun);  // Cap para evitar spam

  return candidates.map((opp) => buildAlertMessage(opp, today));
}

// ─── Deduplicación ───────────────────────────────────────────────────────────

/**
 * Filtra alertas generadas contra las que ya existen en la base de datos
 * para el mismo día y misma hora, evitando duplicación en menos de 24h.
 * 
 * Lógica de escalación: permite una nueva alerta para el mismo slot solo si
 * el score subió significativamente Y no se ha excedido el límite de escalaciones.
 */
export function dedupeAlerts(
  generated: AlertInsert[],
  existing: AlertRow[],
  config: AlertEngineConfig = DEFAULT_ALERT_CONFIG,
): AlertInsert[] {
  return generated.filter((gen) => {
    // Alertas existentes para este mismo slot (fecha + hora)
    const sameSlot = existing.filter(
      (ex) => ex.fecha === gen.fecha && ex.hora === gen.hora,
    );

    // Si no hay ninguna alerta previa para este slot, pasa directo
    if (sameSlot.length === 0) return true;

    // Si ya se alcanzó el límite de escalaciones para este slot, bloquear
    if (sameSlot.length >= config.maxEscalationsPerSlot) return false;

    // Solo permitir si es una escalación real (score subió significativamente
    // respecto al score MÁS ALTO que ya existe para este slot)
    const maxExistingScore = Math.max(...sameSlot.map((ex) => ex.score));
    const isEscalation = (gen.score || 0) > maxExistingScore + config.escalationThreshold;

    return isEscalation;
  });
}

// ─── Construcción del mensaje ────────────────────────────────────────────────

/**
 * Clasifica el tipo de alerta basado en las señales activas.
 * Lógica corregida: la confluencia requiere MÚLTIPLES señales,
 * no es el fallback por defecto.
 */
function classifyAlertType(opp: HourOpportunity): string {
  const hasPatterns = opp.patronesActivos > 0;
  const hasRules = opp.reglasActivas > 0;

  if (hasPatterns && hasRules) return "confluencia_fuerte";  // Ambas señales = confluencia real
  if (hasPatterns) return "patron_detectado";
  if (hasRules) return "multiples_razones";
  return "score_elevado"; // Solo score alto, sin señales específicas
}

/**
 * Construye la alerta de BD basada en el opp.
 */
function buildAlertMessage(opp: HourOpportunity, today: string): AlertInsert {
  const tipo = classifyAlertType(opp);
  const isCritical = opp.score >= 90;

  // Limpiamos el json para no meter referencias cíclicas.
  // Null-check para evitar crash si _meta es undefined.
  const contextoSafely = opp._meta
    ? JSON.parse(JSON.stringify(opp._meta))
    : {};

  // Resumen seguro (puede venir vacío si no hay razones detectadas)
  const resumenText = opp.resumen?.length > 0
    ? opp.resumen.slice(0, 3).join(" | ")
    : "Score elevado sin señales adicionales";

  return {
    tipo,
    descripcion: `Oportunidad detectada a las ${opp.hora} con score ${opp.score}. Resumen rápido: ${resumenText}`,
    nivel: isCritical ? "critical" : "warning",
    score: opp.score,
    hora: opp.hora,
    fecha: today,
    estado: "new",
    activa: true,
    contexto: contextoSafely,
  };
}
