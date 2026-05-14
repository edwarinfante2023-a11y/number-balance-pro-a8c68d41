## Qué pidió el cliente

Que el sistema **deje de adivinar por compensación** ("ya vinieron muchos BAJO → ahora toca ALTO") y en su lugar **siga el comportamiento real** del sorteo en vivo. Si la hora viene corriendo BAJO_IMPAR, la cartera tiene que pesar BAJO_IMPAR mientras esa racha se mantenga, y recién cambiar cuando el comportamiento cambie.

Modo elegido: **Momentum puro** (sigue la racha de los últimos sorteos).
Reglas/patrones de compensación: **se mantienen pero con peso bajo**.

---

## Cambios a hacer

### 1. `src/lib/carteraEngine.ts` — invertir el bloque de Equilibrio

**Hoy (líneas ~95-115):** detecta el lado sub-representado y lo boostea (compensación).

**Nuevo:** reemplazar ese bloque por un **bloque de Momentum**:
- Tomar los últimos **5 sorteos** de esa hora (orden cronológico desc).
- Contar cuántos son ALTO vs BAJO y PAR vs IMPAR en esa ventana.
- El lado **dominante en la racha** recibe el boost (no el opuesto).
- Boost máximo +20 por eje (mismo techo que hoy), proporcional a qué tan marcada viene la racha (ej. 5/5 = boost máximo, 3/5 = boost medio).
- Si la ventana está empatada (3-2 / 2-3) → boost mínimo o cero, no forzamos dirección.

Nuevas razones que aparecerán en `reasons`: `+momentum BAJO (4/5)`, `+momentum IMPAR (5/5)`.

### 2. `src/lib/carteraEngine.ts` — bajar peso de reglas y patrones de compensación

Reglas y patrones siguen activos pero con peso reducido **solo cuando son de tipo compensación**:
- Boost base de reglas: `15` → `7` para reglas con `tipo='compensacion'` (queda 15 para `racha`/`patron`/`bloqueo`).
- Boost base de patrones: `10` → `5` cuando el patrón describe compensación (heurística: si el `resultado_esperado` es opuesto al cuadrante dominante actual de los últimos 5).

Esto cumple "dejarlos pero con peso bajo" sin tener que apagarlos en la base.

### 3. `supabase/functions/_shared/opportunityEngine.ts` — alinear el ranking con momentum

El score de oportunidad por hora hoy también asume compensación vía `computeEscenarioProbablePorHora`. Cambios mínimos:
- Reemplazar el cálculo de "escenario probable" por un escenario derivado del **momentum de los últimos 5 sorteos de esa hora**.
- La "Confianza base" pasa a medir **qué tan consistente viene la racha** (5/5 = alta, 3/2 = baja), no qué tan desbalanceado está el histórico.

### 4. `src/lib/lottery.ts` (compartido) — nueva función `computeMomentum`

Helper puro y testeado:
```
computeMomentum(draws, hora, ventana = 5)
  → { rangoDom, paridadDom, fuerzaRango (0-1), fuerzaParidad (0-1), ventanaReal }
```

Se usa desde `carteraEngine.ts` y `opportunityEngine.ts` para no duplicar lógica.

### 5. UI: mostrar el cambio al usuario

En la página de Cartera (`src/routes/cartera.tsx`) y en el badge de razones de cada número, los textos de "compensación pendiente" pasan a "siguiendo racha". Cambio cosmético para que el cliente entienda que el motor dejó de adivinar.

---

## Lo que NO se toca

- **Frecuencia histórica por hora** (bloque 1) — sigue igual, es señal robusta.
- **Histórico agregado de `lottery_stats`** (bloque 5) — sigue igual.
- **Cron de generación de carteras** — la lógica nueva entra automáticamente en el próximo ciclo horario.
- **Schema de DB** — cero migraciones.
- **Datos históricos** — todas las carteras pasadas quedan tal cual.

---

## Cómo verificar que funciona

1. Después de aplicar, mirar la cartera de la próxima hora y revisar las `reasons` de los top 25 → tienen que aparecer `+momentum X` en vez de `+balance X`.
2. Si los últimos 5 sorteos de las 14:00 fueron mayormente BAJO_IMPAR, los números BAJO_IMPAR (0-49 impares) tienen que dominar el top.
3. Comparar manualmente con la cartera anterior para confirmar el giro de comportamiento.

---

## Sección técnica (detalles para implementación)

- `computeMomentum` ordena por `fecha desc, hora desc` (ya filtrado por hora) y toma los primeros 5; tolera ventanas de 1-4 si hay menos histórico, ajustando proporcionalmente la fuerza.
- En `carteraEngine.ts`, el nuevo bloque queda determinista: misma input → misma output (mantiene el contrato actual del archivo).
- `_meta` y el campo `contexto` de `CarteraResult` se amplían con `momentum: { rango, paridad, fuerzaRango, fuerzaParidad }` para debug y UI.
- El detector de "patrón de compensación" en el paso 2 usa una regla simple: si el `resultado_esperado` del patrón es el **opuesto** del cuadrante dominante en la ventana de momentum, se considera compensación → peso reducido.
