import type { HourOpportunity, OpportunityRanking } from "./opportunityEngine.ts";
import type { AlertInsertExterno as AlertInsert, AlertRowExterno as AlertRow } from "./types.ts";

export type { AlertInsert, AlertRow };

/**
 * Escanea el ranking actual de Nivel 5 y empaqueta alertas potenciales.
 * Se concentra en horas de Nivel ALTO o con Score >= 75 para testeo inicial.
 */
export function generateAlertsFromRanking(ranking: OpportunityRanking): AlertInsert[] {
  const alerts: AlertInsert[] = [];
  const today = new Date().toISOString().slice(0, 10);

  for (const opp of ranking.ranking) {
    if (opp.nivel === "ALTO" || opp.score >= 75) {
      alerts.push(buildAlertMessage(opp, today));
    }
  }

  return alerts;
}

/**
 * Filtra alertas generadas contra las que ya existen en la base de datos
 * para el mismo día y misma hora, evitando duplicación en menos de 24h.
 */
export function dedupeAlerts(generated: AlertInsert[], existing: AlertRow[]): AlertInsert[] {
  return generated.filter((gen) => {
    // Si ya existe una alerta para este día, esta hora y el score de la generada no es significativamente mayor, la descartamos.
    // Esto evita flood si el score baila de 80 a 81.
    const isDuplicate = existing.some((ex) => {
      const isSameSlot = ex.fecha === gen.fecha && ex.hora === gen.hora;
      // Consideramos "escalada de alerta" si el score saltó 10 pts más que la alerta anterior de hoy
      const isEscalation = (gen.score || 0) > (ex.score + 10);
      
      return isSameSlot && !isEscalation;
    });

    return !isDuplicate;
  });
}

/**
 * Construye la alerta de BD basada en el opp
 */
function buildAlertMessage(opp: HourOpportunity, today: string): AlertInsert {
  let tipo = "confluencia_fuerte";
  if (opp.patronesActivos > 0) tipo = "patron_detectado";
  else if (opp.reglasActivas > 0) tipo = "multiples_razones";

  const isCritical = opp.score >= 90;
  
  // Limpiamos el json para no meter referencias cíclicas
  const contextoSafely = JSON.parse(JSON.stringify(opp._meta));

  return {
    tipo,
    descripcion: `Oportunidad detectada a las ${opp.hora} con score ${opp.score}. Resumen rápido: ${opp.resumen.slice(0, 3).join(" | ")}`,
    nivel: isCritical ? "critical" : "warning",
    score: opp.score,
    hora: opp.hora,
    fecha: today,
    estado: "new",
    activa: true,
    contexto: contextoSafely,
  };
}
