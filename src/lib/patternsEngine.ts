import type { Sorteo } from "./lottery";
import type { InsertPattern } from "@/hooks/usePatterns";
import type { Database } from "@/integrations/supabase/types";

// Engine configuration
const MIN_OCCURRENCES = 5;
const MIN_WINRATE = 0.6; // 60%

type TargetField = "altoBajo" | "parImpar" | "subcuadrante";

interface SequenceRecord {
  field: TargetField;
  sequenceString: string; // e.g. "ALTO,ALTO"
  expectedNext: string;   // e.g. "BAJO"
  occurrences: number;
  hits: number;
}

export function minePatterns(draws: Sorteo[], activeHour: string | null = null): InsertPattern[] {
  // Ordered from oldest to newest
  const sortedDraws = [...draws].sort((a, b) => 
    `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`)
  );

  const tracker = new Map<string, SequenceRecord>();
  const fieldsToMine: TargetField[] = ["altoBajo", "parImpar", "subcuadrante"];
  const sequenceLengths = [2, 3]; // Support finding patterns of 2 or 3 repeating identical states

  for (const field of fieldsToMine) {
    for (const seqLen of sequenceLengths) {
      // Sweeping
      for (let i = 0; i < sortedDraws.length - seqLen; i++) {
        const window = sortedDraws.slice(i, i + seqLen);
        const states = window.map(d => {
            const v = (d as any)[field] || (d as any)[field.replace("Bajo", "_bajo").replace("Impar", "_impar")];
            return (v || "").toUpperCase();
        });
        
        // Only look at pure consecutive identical repeating states (e.g. 3 BAJOs)
        const isPureSequence = states.every(s => s === states[0]);
        if (!isPureSequence || !states[0]) continue;

        const nextDraw = sortedDraws[i + seqLen];
        const nextState = (nextDraw as any)[field] || (nextDraw as any)[field.replace("Bajo", "_bajo").replace("Impar", "_impar")];
        const nextValue = (nextState || "").toUpperCase();
        
        if (!nextValue) continue;

        // Since we don't know yet what the highest probabilistic "NEXT" is, 
        // we track all combinations: [ALTO, ALTO] -> ALTO, and [ALTO, ALTO] -> BAJO
        const signature = `${field}|${seqLen}|${states[0]}|${nextValue}`;

        if (!tracker.has(signature)) {
          tracker.set(signature, {
            field,
            sequenceString: states[0],
            expectedNext: nextValue,
            occurrences: 0,
            hits: 0
          });
        }
        
        const rec = tracker.get(signature)!;
        rec.hits++; // the sequence matched and the result matched
      }
      
      // Wait, to calculate global "occurrences" of the *premise* 
      // (how many times [ALTO, ALTO] happened in total, so we can divide hits/occurrences)
      // We must tally occurrences properly.
      let totalPremiseCounts = new Map<string, number>();
      for (let i = 0; i < sortedDraws.length - seqLen; i++) {
        const window = sortedDraws.slice(i, i + seqLen);
        const states = window.map(d => {
            const v = (d as any)[field] || (d as any)[field.replace("Bajo", "_bajo").replace("Impar", "_impar")];
            return (v || "").toUpperCase();
        });
        if (states.every(s => s === states[0]) && states[0]) {
           const premSig = `${field}|${seqLen}|${states[0]}`;
           totalPremiseCounts.set(premSig, (totalPremiseCounts.get(premSig) || 0) + 1);
        }
      }

      // Sync occurrences to tracker
      tracker.forEach((val, key) => {
         const parts = key.split("|");
         const premSig = `${parts[0]}|${parts[1]}|${parts[2]}`;
         val.occurrences = totalPremiseCounts.get(premSig) || 0;
      });
    }
  }

  // Filter and build DB representations
  const patternsDB: InsertPattern[] = [];
  
  for (const [key, metrics] of tracker.entries()) {
      if (metrics.occurrences < MIN_OCCURRENCES) continue;
      
      const winrate = metrics.hits / metrics.occurrences;
      if (winrate >= MIN_WINRATE) {
          const parts = key.split("|");
          const seqLen = parts[1];
          const stateValue = parts[2];
          
          let descripcion = `Después de ${seqLen} ${stateValue} seguidos, viene ${metrics.expectedNext}`;
          let nombre = `Auto: ${seqLen}x ${stateValue} -> ${metrics.expectedNext}`;
          if (activeHour) {
              descripcion += ` (Histórico ${activeHour} hrs)`;
              nombre += ` [${activeHour}]`;
          }

          patternsDB.push({
             nombre: nombre,
             descripcion,
             tipo: "patron",
             condiciones: {
                campo: metrics.field,
                operador: "===",
                valor: stateValue,
                min_veces: seqLen
             },
             resultado_esperado: metrics.expectedNext,
             ocurrencias: metrics.occurrences,
             aciertos: metrics.hits,
             efectividad: Math.round(winrate * 100),
             hora: activeHour,
             source: "auto",
             estado: "activo",
             activa: true
          });
      }
  }

  // Deduplicate conflicting ones (if two branches somehow meet criteria, pick highest winrate)
  // E.g. Can't have >=60% for BOTH ALTO and BAJO (since sum is 100%), so conflict is impossible mathematically at 60%
  // But just for clean sorting:
  return patternsDB.sort((a, b) => (b.efectividad || 0) - (a.efectividad || 0));
}

// Active pattern detection
export function getActivePatterns(patterns: Database["public"]["Tables"]["patterns"]["Row"][], subset: Sorteo[]): Array<{pattern: Database["public"]["Tables"]["patterns"]["Row"], mensaje: string}> {
    const active = [];
    const latestWindow = [...subset].sort((a, b) => 
       `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`)
    );
    if (latestWindow.length === 0) return [];

    for (const pat of patterns) {
        if (!pat.activa || pat.estado !== "activo") continue;
        const conds = pat.condiciones as Record<string, any>;
        if (!conds || !conds.campo || !conds.min_veces) continue;

        const campo = conds.campo as string;
        const mappedCampo = campo === "alto_bajo" ? "altoBajo" : campo === "par_impar" ? "parImpar" : campo;
        const valorObj = conds.valor;
        const minVeces = parseInt(conds.min_veces, 10);

        let currentStreak = 0;
        for (let i = latestWindow.length - 1; i >= 0; i--) {
            const v = (latestWindow[i] as any)[mappedCampo] || (latestWindow[i] as any)[campo];
            if ((v || "").toUpperCase() === valorObj) {
                currentStreak++;
            } else {
                break;
            }
        }

        if (currentStreak === minVeces) {
            // Triggered! Exactly the precipice of the pattern
            active.push({
                pattern: pat,
                mensaje: `Secuencia detectada: ${currentStreak}x ${valorObj}. Históricamente sigue ${pat.resultado_esperado} con ${pat.efectividad}% efectividad.`
            });
        }
    }
    return active;
}
