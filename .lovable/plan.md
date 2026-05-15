
# Revisión de Crons + Repo

## 1. Crons activos (8 jobs)

| # | Job | Schedule (UTC) | Destino | Estado |
|---|---|---|---|---|
| 1 | `sync-anguilla-auto` | `*/3 * * * *` | Edge Function `sync-web` | ✅ corre OK |
| 2 | `scan-opportunities-5min` | `*/5 * * * *` | hook `scan-opportunities` | ✅ |
| 3 | `generate-carteras-hourly` | `2 * * * *` | hook `generate-carteras` | ✅ |
| 4 | `evaluate-results-hourly` | `5 * * * *` | hook `evaluate-results` | ✅ |
| 5 | `evaluate-carteras-hourly` | `5 * * * *` | **SQL directo** (INSERT a `cartera_resultados`) | ⚠️ duplicado lógico con #4 |
| 6 | `learn-patterns-daily` | `0 2 * * *` | hook (vía `ana-liza.xyz`) | ⚠️ depende de dominio |
| 7 | `mine-patterns-weekly` | `0 3 * * 0` | hook (vía `ana-liza.xyz`) | ⚠️ depende de dominio |
| 8 | `sync-lottery-stats-daily` | `0 6 * * *` | hook `sync-lottery-stats` | ✅ |

Últimas 25 ejecuciones: **todas `succeeded`**. El sistema corre limpio.

## 2. Hallazgos importantes

### 🔴 A. Duplicación en evaluación horaria (#4 vs #5)
Los dos corren a `:05`. `evaluate-carteras-hourly` hace un `INSERT ... ON CONFLICT DO NOTHING` directo en SQL, y `evaluate-results-hourly` llama al hook que probablemente hace lo mismo + lógica adicional (actualización de efectividad de reglas, etc.). Esto provoca:
- Carrera entre los dos (el SQL puede ganar y dejar al hook sin filas que insertar).
- El hook puede no estar contabilizando aciertos para reglas/patrones porque el INSERT ya ocurrió.

**Recomendación:** eliminar el job #5 (SQL crudo). El hook ya cubre el caso y hace más cosas.

### 🟡 B. URLs inconsistentes
- 5 jobs usan `project--eaae42aa-...lovable.app` (estable, recomendado).
- 2 jobs usan `https://ana-liza.xyz` (dominio custom — si lo cambias o expira, los crons mueren silenciosamente).
- 1 job usa la URL directa de Supabase Edge Functions.

**Recomendación:** unificar todo a `project--eaae42aa-34c4-457c-a07c-36f8131c182e.lovable.app`. Es inmutable.

### 🟡 C. Crons corren 24/7 pero los sorteos son 8am–10pm AST
Tu cliente confirmó horario 8am–10pm. En UTC eso es ~12:00–02:00.
- `sync-anguilla-auto` cada 3 min × 24h = **480 invocaciones/día**, de las cuales ~200 son fuera de horario sin sorteos nuevos.
- `scan-opportunities-5min` igual: ~288/día, ~120 ociosas.

**Recomendación:** restringir a la ventana útil. Ejemplo cron:
- `*/3 12-23,0-2 * * *` para sync (ahorra ~40% de invocaciones).
- `*/5 12-23,0-2 * * *` para scan-opportunities.

`generate-carteras` ya filtra internamente con `horas > ahora`, así que no urge tocarlo, pero podrías limitarlo a `2 11-23 * * *` para evitar la corrida de 03:00–10:00 UTC.

### 🟢 D. Lo que está bien
- Todos los jobs idempotentes (upsert / on conflict).
- Headers con `apikey` correcto, según el patrón canónico de Lovable.
- `sync-lottery-stats` con `timeout_milliseconds: 120000` — bien pensado para queries pesadas.
- Últimas 25 ejecuciones todas `succeeded`, sin retries fallidos.

## 3. Sobre los commits recientes

Los últimos ~20 commits son toda la línea **AI Phase 3 → Phase 14** (Quadrant Architecture, Deep Miner, Rolling Miner, Sniper, Auto-Learner, Chaos Miner, Genetic Algorithm, Infinite Chaos Hacker, Hybrid Brain, Ultimate Battle, Streak Breaker, Dual System, God Mode recalibration). Más los fixes recientes de UI (aciertos por día, WeekRadar humanizado).

Observaciones:
- Mucho código en `scripts/*.ts` (auto-learner, deep-miner, genetic, etc.) que **no está en producción** — son scripts de exploración/backtesting que corres manualmente. Bien separados, no contaminan el bundle.
- El sistema dual (God Mode + clásico) ya está integrado al cron de `generate-carteras` (commit `505321d`).
- El cambio reciente que acabamos de hacer (momentum puro reemplazando compensación) **aún no tiene commit propio** — el último visible es `3de9ed1 "Work in progress"`.

## 4. Acciones que recomiendo (en orden)

1. **Borrar el cron #5** (`evaluate-carteras-hourly`) — es ruido y compite con el hook.
2. **Unificar URLs** de #6 y #7 al dominio estable de Lovable.
3. **Restringir ventana horaria** de #1 y #2 a 12–02 UTC (8am–10pm AST).
4. (Opcional) Hacer commit limpio de los cambios de momentum para cerrar el WIP.

¿Aplico estos cambios?
