import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * 🤖 Robot Jefe — Auditoría Autónoma de Reglas Humanas
 *
 * Evalúa TODAS las reglas activas (tabla `rules`) contra el historial
 * completo de sorteos y:
 *   1. Corrige efectividades infladas (si el humano declaró 80% pero
 *      el historial muestra 45%, se actualiza a 45%)
 *   2. Veta reglas perdedoras (≤35% de efectividad real → desactivada)
 *   3. Genera alertas en `alerts` para cada acción tomada
 *
 * Programado: Lunes a las 4:00 AM (después de la minería de datos)
 *
 * POST /api/public/hooks/audit-rules
 */

// ─── Helpers ──────────────────────────────────────────────────────

const isAlto = (n: number) => n >= 50;
const isPar = (n: number) => n % 2 === 0;

function matchesTarget(n: number, target: string): boolean {
  if (!target) return false;
  const ab = isAlto(n) ? "ALTO" : "BAJO";
  const pi = isPar(n) ? "PAR" : "IMPAR";
  const cuad = `${ab}_${pi}`;
  if (target === ab || target === pi || target === cuad) return true;
  if (target.includes(ab) && target.includes(pi)) return true;
  // Soporte para resultado_esperado numérico (ej. "23")
  const numTarget = parseInt(target, 10);
  if (!isNaN(numTarget) && numTarget === n) return true;
  return false;
}

/** Formatear fecha actual en ISO corto */
function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

// ─── Configuración ───────────────────────────────────────────────

const VETO_THRESHOLD = 35;      // ≤35% → vetar
const CORRECTION_GAP = 20;     // Si difiere ≥20 puntos → corregir
const MIN_DRAWS_FOR_AUDIT = 50; // Mínimo de sorteos donde la regla aplica

// ─── Endpoint ─────────────────────────────────────────────────────

export const Route = createFileRoute("/api/public/hooks/audit-rules")({
  server: {
    handlers: {
      OPTIONS: async () => {
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        });
      },
      POST: async () => {
        const startTime = Date.now();

        // 1. Cargar todas las reglas (activas e inactivas para auditar)
        const { data: rules, error: e1 } = await supabaseAdmin
          .from("rules")
          .select("*");

        if (e1) {
          return Response.json({ ok: false, error: e1.message }, { status: 500 });
        }

        // 2. Cargar historial completo de draws
        const { data: rawDraws, error: e2 } = await supabaseAdmin
          .from("draws")
          .select("numero, fecha, lottery_draws!inner(hora)")
          .order("fecha", { ascending: true })
          .limit(20000);

        if (e2) {
          return Response.json({ ok: false, error: e2.message }, { status: 500 });
        }

        const draws = ((rawDraws ?? []) as any[]).map((r) => ({
          numero: r.numero as number,
          fecha: r.fecha as string,
          hora: (r.lottery_draws?.hora ?? "00:00") as string,
        }));

        if (draws.length < MIN_DRAWS_FOR_AUDIT) {
          return Response.json({
            ok: true,
            skipped: true,
            reason: `Solo hay ${draws.length} sorteos. Se necesitan al menos ${MIN_DRAWS_FOR_AUDIT} para auditar.`,
          });
        }

        // 3. Auditar cada regla
        const vetoed: string[] = [];
        const corrected: string[] = [];
        const validated: string[] = [];
        const log: Array<{
          id: string;
          nombre: string;
          action: "vetoed" | "corrected" | "validated";
          declared_ef: number;
          real_ef: number;
          total_evaluated: number;
          total_hits: number;
          reason: string;
        }> = [];

        for (const rule of rules ?? []) {
          const target = (rule.resultado_esperado ?? "").toUpperCase().trim();
          if (!target) {
            validated.push(rule.id);
            continue; // No se puede auditar sin resultado esperado
          }

          // Evaluar contra el historial completo
          let totalMatched = 0;
          let totalHits = 0;

          for (const d of draws) {
            // Para cada sorteo, verificar si el target coincide
            if (matchesTarget(d.numero, target)) {
              totalHits++;
            }
            totalMatched++;
          }

          if (totalMatched < MIN_DRAWS_FOR_AUDIT) {
            validated.push(rule.id);
            continue;
          }

          const realEf = Math.round((totalHits / totalMatched) * 100);
          const declaredEf = Number(rule.efectividad ?? 0);
          const efDiff = Math.abs(declaredEf - realEf);

          if (realEf <= VETO_THRESHOLD && rule.activo) {
            // ─── VETAR: regla perdedora ───────────────────────
            const { error: ue } = await supabaseAdmin
              .from("rules")
              .update({ activo: false, efectividad: realEf })
              .eq("id", rule.id);

            if (!ue) {
              vetoed.push(rule.id);

              // Crear alerta crítica
              await supabaseAdmin.from("alerts").insert({
                tipo: "veto_robot",
                descripcion: `🤖 VETO: Regla "${rule.nombre}" desactivada. Declaraba ${declaredEf}% de efectividad, pero el análisis de ${totalMatched.toLocaleString()} sorteos muestra solo ${realEf}%. Resultado esperado "${target}" es estadísticamente perdedor.`,
                nivel: "critical" as any,
                score: 100 - realEf,
                fecha: todayStr(),
                contexto: {
                  rule_id: rule.id,
                  rule_nombre: rule.nombre,
                  declared_ef: declaredEf,
                  real_ef: realEf,
                  total_evaluated: totalMatched,
                  total_hits: totalHits,
                  action: "vetoed",
                },
              });

              log.push({
                id: rule.id,
                nombre: rule.nombre,
                action: "vetoed",
                declared_ef: declaredEf,
                real_ef: realEf,
                total_evaluated: totalMatched,
                total_hits: totalHits,
                reason: `Efectividad real ${realEf}% ≤ ${VETO_THRESHOLD}%. Regla desactivada por seguridad financiera.`,
              });
            }
          } else if (efDiff >= CORRECTION_GAP) {
            // ─── CORREGIR: efectividad inflada ────────────────
            const { error: ue } = await supabaseAdmin
              .from("rules")
              .update({ efectividad: realEf })
              .eq("id", rule.id);

            if (!ue) {
              corrected.push(rule.id);

              // Crear alerta de advertencia
              await supabaseAdmin.from("alerts").insert({
                tipo: "correccion_robot",
                descripcion: `🔧 CORRECCIÓN: Regla "${rule.nombre}" tenía ${declaredEf}% declarado, pero el historial de ${totalMatched.toLocaleString()} sorteos muestra ${realEf}%. Efectividad actualizada automáticamente.`,
                nivel: "warning" as any,
                score: efDiff,
                fecha: todayStr(),
                contexto: {
                  rule_id: rule.id,
                  rule_nombre: rule.nombre,
                  declared_ef: declaredEf,
                  real_ef: realEf,
                  total_evaluated: totalMatched,
                  action: "corrected",
                },
              });

              log.push({
                id: rule.id,
                nombre: rule.nombre,
                action: "corrected",
                declared_ef: declaredEf,
                real_ef: realEf,
                total_evaluated: totalMatched,
                total_hits: totalHits,
                reason: `Efectividad corregida de ${declaredEf}% a ${realEf}% (diferencia de ${efDiff} puntos).`,
              });
            }
          } else {
            validated.push(rule.id);
            log.push({
              id: rule.id,
              nombre: rule.nombre,
              action: "validated",
              declared_ef: declaredEf,
              real_ef: realEf,
              total_evaluated: totalMatched,
              total_hits: totalHits,
              reason: `Efectividad verificada: ${realEf}% (declarada: ${declaredEf}%). Dentro del margen aceptable.`,
            });
          }
        }

        const elapsedMs = Date.now() - startTime;

        // 4. Guardar log del último audit
        await supabaseAdmin.from("settings").upsert(
          [
            {
              clave: "rule_audit_last_run",
              valor: {
                ranAt: new Date().toISOString(),
                drawsAnalyzed: draws.length,
                rulesEvaluated: (rules ?? []).length,
                vetoed: vetoed.length,
                corrected: corrected.length,
                validated: validated.length,
                elapsedMs,
                log: log.slice(0, 30),
              } as any,
            },
          ],
          { onConflict: "clave" },
        );

        return Response.json(
          {
            ok: true,
            drawsAnalyzed: draws.length,
            rulesEvaluated: (rules ?? []).length,
            vetoed: vetoed.length,
            corrected: corrected.length,
            validated: validated.length,
            elapsedMs,
            log,
          },
          {
            headers: {
              "Access-Control-Allow-Origin": "*",
            },
          },
        );
      },
    },
  },
});
