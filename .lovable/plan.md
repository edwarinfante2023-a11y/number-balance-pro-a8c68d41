## Objetivo
Saber **qué señal del motor está aportando más aciertos reales** — frecuencia por hora, balance, reglas o patrones — para poder subir/bajar pesos de forma informada.

## Cómo funciona la atribución (concepto)

Cuando una cartera acierta, el `numero_ganador` es uno de los 25 elegidos. Ese número tiene guardado en `carteras.contexto.reasons["N"]` un array tipo:

```
["+freq hora ×7", "+balance BAJO", "+regla X", "+patrón Y"]
```

Cada string empieza con un **prefijo identificable** (`+freq`, `+balance`, `+regla`, `+patrón`). Agrupando por prefijo a través de todos los aciertos históricos, se puede calcular:

- **Aciertos atribuidos por señal** — cuántas veces cada señal "tocó" un número ganador
- **Peso de score atribuido** — qué % del score del ganador venía de cada señal
- **Hit-rate por señal** — de las veces que una señal estaba presente en el top 25, cuántas pegó

Esto NO requiere cambiar el motor — solo leer datos ya guardados.

## Cambios

### 1. Hook nuevo `useAttributionStats`
Archivo: `src/hooks/useAttributionStats.ts`

Query que cruza `cartera_resultados` (acierto=true) con `carteras.contexto.reasons` y `carteras.scores`. Por cada acierto:
- Lee `reasons[String(numero_ganador)]`
- Clasifica cada string por prefijo en una de 4 categorías: `freq | balance | regla | patron`
- Acumula contadores

Devuelve:
```ts
{
  totalAciertos: number,
  porSenal: Array<{
    senal: 'freq'|'balance'|'regla'|'patron',
    aciertosTocados: number,    // # aciertos donde esta señal contribuyó
    pctAciertos: number,         // % de aciertos donde estaba presente
    presenciasEnTop: number,     // # veces que estaba en algún número del top 25 (denominador)
    hitRateSenal: number,        // aciertosTocados / presenciasEnTop
  }>,
  topPatrones: Array<{ nombre: string, aciertos: number }>,  // patrones específicos más efectivos
  topReglas:   Array<{ nombre: string, aciertos: number }>,
}
```

### 2. Componente nuevo `AttributionSection`
Archivo: `src/components/AttributionSection.tsx`

Sección visual con:
- **4 cards tipo KPI** (una por señal): icono + nombre + `% aciertos` + barra de progreso + hit-rate vs baseline 25%
- **Mini-leaderboard**: top 5 patrones y top 5 reglas que más aciertos tocaron (con su nombre real desde DB)
- **Insight automático**: una línea tipo *"La señal que más está aportando es **frecuencia por hora** (presente en 80% de tus aciertos, hit-rate 32%)"*

Usa solo tokens semánticos (`bg-card`, `text-primary`, etc.) — sin colores hardcodeados.

### 3. Integración
Agregar `<AttributionSection />` en `/cartera`, debajo de las KPIs de rentabilidad que ya existen. Banner sutil si `totalAciertos < 5`: *"Necesitamos más aciertos evaluados para que estos números sean estables."*

## Lo que NO incluye este plan
- Cambiar pesos del motor (lo dejamos como paso 2 cuando ya veas qué señal manda)
- Cambios al schema de DB (todo se calcula desde campos existentes)
- Backfill de carteras viejas

## Resultado esperado
En `/cartera` vas a ver de un vistazo: *"de los 2 aciertos de hoy, el ganador venía con score alto principalmente por **freq hora + patrón [Auto: 3x ALTO -> BAJO]**"*. Cuando lleguen 20-30 aciertos, tendrás señal estadística clara de qué subir y qué bajar.
