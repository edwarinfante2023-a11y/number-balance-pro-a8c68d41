import type { Sorteo } from "./lottery";
import type { Database } from "@/integrations/supabase/types";

export type Rule = Database["public"]["Tables"]["rules"]["Row"];

export interface RuleEvaluationResult {
  ocurrencias: number;
  aciertos: number;
  efectividad: number;
}

function matchExpectedResult(draw: Sorteo & Record<string, any>, expected: string): boolean {
  expected = expected.toUpperCase().trim();
  const ab = (draw.altoBajo || draw.alto_bajo || "").toUpperCase();
  const pi = (draw.parImpar || draw.par_impar || "").toUpperCase();
  const quad = (draw.subcuadrante || "").toUpperCase();
  
  return ab === expected || pi === expected || quad === expected;
}

export function evaluateRule(rule: Rule, draws: Sorteo[]): RuleEvaluationResult {
  let ocurrencias = 0;
  let aciertos = 0;

  const condiciones = rule.condiciones as Record<string, any>;
  if (!condiciones || !condiciones.campo || !condiciones.valor) {
    return { ocurrencias: 0, aciertos: 0, efectividad: 0 };
  }
  
  const campo = condiciones.campo as keyof Sorteo;
  const valorObj = condiciones.valor;
  
  // draws usually comes sorted newest to oldest. We reverse it for historic forward traversal.
  const sortedDraws = [...draws].sort((a, b) => 
     `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`)
  );

  if (rule.tipo === "racha") {
    const min_veces = parseInt(condiciones.min_veces as string, 10) || 3;
    let currentStreak = 0;
    
    for (let i = 0; i < sortedDraws.length - 1; i++) {
        const curr = sortedDraws[i] as Sorteo & Record<string, any>;
        // Support both snake_case (DB schema) and camelCase (Sorteo interface) field mappings
        const mappedCampo = campo === "alto_bajo" ? "altoBajo" : campo === "par_impar" ? "parImpar" : campo;
        if (curr[mappedCampo] === valorObj || curr[campo] === valorObj) {
            currentStreak++;
            if (currentStreak >= min_veces) {
               ocurrencias++;
               const nextDraw = sortedDraws[i + 1];
               if (rule.resultado_esperado && matchExpectedResult(nextDraw, rule.resultado_esperado)) {
                   aciertos++;
               }
               // Reset streak counter to evaluate pure isolated incidents, ensuring we don't spam 10 hits if a streak hits 13.
               currentStreak = 0; 
            }
        } else {
            currentStreak = 0;
        }
    }
  } else {
     // Dominancia, Compensacion, Patron, Cuadrante Dominante (Threshold Based)
     const threshold = parseFloat(condiciones.threshold as string) || 0.6;
     const windowSize = parseInt(condiciones.window as string, 10) || 10;
     
     // Sliding window execution
     for (let i = windowSize; i < sortedDraws.length; i++) {
        const windowDraws = sortedDraws.slice(i - windowSize, i);
        const mappedCampo = campo === "alto_bajo" ? "altoBajo" : campo === "par_impar" ? "parImpar" : campo;
        const matches = windowDraws.filter(d => {
           const val = (d as Sorteo & Record<string, any>)[mappedCampo] || (d as Sorteo & Record<string, any>)[campo];
           return val === valorObj;
        }).length;
        const ratio = matches / windowSize;
        
        if (ratio >= threshold) {
            ocurrencias++;
            const nextDraw = sortedDraws[i]; // 'i' is the draw physically AFTER the slice
            if (rule.resultado_esperado && matchExpectedResult(nextDraw, rule.resultado_esperado)) {
                aciertos++;
            }
        }
     }
  }
  
  const efectividad = ocurrencias > 0 ? Math.round((aciertos / ocurrencias) * 100) : 0;
  return { ocurrencias, aciertos, efectividad };
}

export interface ActiveRuleDetection {
  rule: Rule;
  mensaje: string;
}

export function getActiveRulesForSubset(rules: Rule[], subset: Sorteo[]): ActiveRuleDetection[] {
   const activeDetections: ActiveRuleDetection[] = [];
   
   // subset ordered oldest -> newest
   const latestWindow = [...subset].sort((a, b) => 
       `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`)
   );
   
   if (latestWindow.length === 0) return activeDetections;

   for (const rule of rules) {
       if (!rule.activo) continue;
       const condiciones = rule.condiciones as Record<string, any>;
       if (!condiciones || !condiciones.campo || !condiciones.valor) continue;

       const campo = condiciones.campo as keyof Sorteo;
       const valorObj = condiciones.valor;

       if (rule.tipo === "racha") {
           const min_veces = parseInt(condiciones.min_veces as string, 10) || 3;
           let currentStreak = 0;
           // trace backwards from the most recent draw (the tip)
           const mappedCampo = campo === "alto_bajo" ? "altoBajo" : campo === "par_impar" ? "parImpar" : campo;
           for (let i = latestWindow.length - 1; i >= 0; i--) {
               const val = (latestWindow[i] as Sorteo & Record<string, any>)[mappedCampo] || (latestWindow[i] as Sorteo & Record<string, any>)[campo];
               if (val === valorObj) {
                   currentStreak++;
               } else {
                   break;
               }
           }
           if (currentStreak >= min_veces) {
               activeDetections.push({
                   rule,
                   mensaje: `Racha viva: ${currentStreak}x ${valorObj} (Activada a partir de ${min_veces})`
               });
           }
       } else {
           // Threshold based
           const threshold = parseFloat(condiciones.threshold as string) || 0.6;
           const windowSize = parseInt(condiciones.window as string, 10) || 10;
           const mappedCampo = campo === "alto_bajo" ? "altoBajo" : campo === "par_impar" ? "parImpar" : campo;
           
           if (latestWindow.length >= windowSize) {
               const tipWindow = latestWindow.slice(-windowSize);
               const count = tipWindow.filter(d => {
                  const val = (d as Sorteo & Record<string, any>)[mappedCampo] || (d as Sorteo & Record<string, any>)[campo];
                  return val === valorObj;
               }).length;
               const ratio = count / windowSize;
               
               if (ratio >= threshold) {
                   activeDetections.push({
                       rule,
                       mensaje: `Tensión activa: dominancia del ${(ratio * 100).toFixed(0)}% de ${valorObj} en últimos ${windowSize}`
                   });
               }
           }
       }
   }
   
   return activeDetections;
}
