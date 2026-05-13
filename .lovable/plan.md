## Objetivo
Que el sistema sepa cuándo un número de la cartera salió en **2do** o **3er** lugar (no solo 1ro), para ver cobros adicionales (pagos 10x y 4x). **La lógica de generación y evaluación principal sigue basada solo en el 1er premio** — los otros dos son métricas extra, no afectan scoring, patrones, ni alertas.

Bonus: pagos editables desde Configuración (hoy hardcoded 70/25).

---

## 1. Datos: capturar los 3 premios

El RSS ya trae los 3 (`: XX-YY-ZZ`) — solo extraemos el 1ro hoy.

**Cambios:**
- `supabase/functions/sync-web/index.ts`: nueva función `extractAllPrizes(title) → {primero, segundo, tercero}`. Sigue insertando `draws.numero = primero` (sin tocar la lógica), pero guarda los 3 en `draws.extra: { segundo, tercero }`.
- Migración mínima: ninguna en `draws` (ya tiene `extra: jsonb`).

## 2. Schema: ampliar `cartera_resultados`

Migración idempotente:
```sql
ALTER TABLE public.cartera_resultados
  ADD COLUMN IF NOT EXISTS numero_segundo INTEGER,
  ADD COLUMN IF NOT EXISTS numero_tercero INTEGER,
  ADD COLUMN IF NOT EXISTS acierto_segundo BOOLEAN,
  ADD COLUMN IF NOT EXISTS acierto_tercero BOOLEAN;
```
Nullables → backfill no requerido. `acierto` (1ro) sigue igual.

## 3. Evaluador

`src/routes/api/public/hooks/evaluate-results.ts`:
- Leer `draws.extra` además de `numero`.
- Para cada cartera, calcular `acierto_segundo` y `acierto_tercero` (numeros incluye el segundo/tercero respectivamente).
- Upsert con las 4 columnas nuevas.
- **No cambia** ningún cálculo de patrones, scoring, ni el `acierto` principal.

## 4. Configuración de pagos

Nueva clave en `settings`: `payouts` con shape:
```json
{ "apuesta": 25, "pago1": 70, "pago2": 10, "pago3": 4 }
```

- Hook `useSettings` ya lee/escribe `settings`. Agregar getter `usePayouts()`.
- `src/routes/configuracion.tsx`: nueva sección "Pagos por posición" con 4 inputs numéricos.
- Reemplazar las constantes hardcoded `APUESTA = 25 / PAYOUT = 70` en:
  - `src/routes/cartera.tsx`
  - `src/components/BankrollSimSection.tsx`
  - `src/hooks/useBankrollSim.ts`

## 5. UI: mostrar 2do/3ro

**`src/routes/cartera.tsx`** (tabla del día por hora):
- Nuevas columnas chiquitas: `2do` y `3ro` con badge ✓/✗ + número ganador en cada posición.
- KPI extra arriba: "Cobrado extra (2do+3ro): $X" usando los pagos configurados.

**`src/components/BankrollSimSection.tsx`**:
- En el desglose, agregar:
  - `Aciertos 2do: N × pago2 = $X`
  - `Aciertos 3ro: N × pago3 = $X`
  - `P&L total = (cobro1 + cobro2 + cobro3) − costo`
- En la tabla "ver una por una", agregar 2 columnas (2do, 3ro) con ✓/✗.
- Filtro tabla: agregar opciones "✓ 2do" y "✓ 3ro".

**`src/hooks/useBankrollSim.ts`**:
- Traer `acierto_segundo` y `acierto_tercero`.
- Calcular `cobrado_total = a1*pago1 + a2*pago2 + a3*pago3`, `pl` por fila combinando los 3.

## 6. Backfill (opcional, recomendado)

Script one-off: para draws de los últimos 30 días, re-fetch RSS o (más simple) dejar que se llenen hacia adelante. Para evaluaciones existentes, correr el evaluador una vez con la nueva lógica → re-evalúa todo (es upsert). Las carteras viejas tendrán `numero_segundo/tercero = null` hasta que llegue nueva data — eso está bien, aparecen como "—" en la UI.

---

## Lo que NO cambia (importante)
- `carteraEngine.ts` — generación intacta.
- Patrones, reglas, alertas, oportunidades — siguen leyendo solo `acierto` (1ro).
- `cartera_resultados.acierto` sigue siendo el "acierto real" para todo el sistema.

## Archivos tocados
- `supabase/migrations/<nuevo>.sql` (4 columnas nuevas)
- `supabase/functions/sync-web/index.ts` (extraer 3)
- `src/routes/api/public/hooks/evaluate-results.ts` (evaluar 3)
- `src/hooks/useSettings.ts` (helper payouts)
- `src/routes/configuracion.tsx` (UI pagos)
- `src/hooks/useBankrollSim.ts` (P&L combinado)
- `src/components/BankrollSimSection.tsx` (UI desglose + tabla)
- `src/routes/cartera.tsx` (columnas 2do/3ro + KPI)

## Riesgos / edge cases
- RSS sin 2do/3ro → guardamos null, UI muestra "—".
- Patterns/cron viejos → no tocados, siguen funcionando igual.
- Pagos viejos (eventos ya evaluados) se recalculan en frontend con los pagos actuales — si cambias pagos, los KPI históricos cambian. Aceptable para MVP.