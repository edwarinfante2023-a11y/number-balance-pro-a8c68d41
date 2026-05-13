## Objetivo

Hacer que las carteras se **regeneren automáticamente cada vez que sale un sorteo nuevo**, para que las próximas horas del día siempre jueguen con la data más fresca posible.

---

## Cómo funciona hoy (problema)

```
00:02 → cron genera TODAS las carteras del día (con data de ayer)
12:00 → sale sorteo → scraper lo guarda → llama evaluate-results
15:00 → juega cartera generada a las 00:02 (NO sabe que salió el de las 12:00)
```

Las 4 señales del motor (frecuencia por hora, balance ALTO/BAJO, balance PAR/IMPAR, patrones) **no se actualizan** durante el día.

---

## Cómo va a funcionar (solución)

```
12:00 → sale sorteo → scraper lo guarda
12:00:05 → scraper llama evaluate-results (ya lo hace hoy)
12:00:06 → scraper llama generate-carteras  ← NUEVO
         → recalcula SOLO las horas futuras (15:00, 18:00, 21:00…)
         → upsert idempotente sobre carteras existentes
15:00 → juega cartera FRESCA con data hasta las 12:00
```

---

## Cambios concretos (2 archivos)

### 1. `src/routes/api/public/hooks/generate-carteras.ts`

Agregar filtro de horas futuras antes del loop de generación:

- Calcular `ahora` en formato `HH:mm` (zona horaria del servidor — confirmar con vos cuál usar).
- Filtrar `horas` para quedarse solo con `h > ahora`.
- Aceptar un parámetro opcional `?force=true` para que el cron de las 00:02 siga generando TODO el día (caso inicial).
- Devolver en la respuesta cuántas horas se saltaron por ser pasadas (para debugging).

**No cambia:** la lógica de `buildCartera`, el upsert idempotente sobre `(fecha, hora, estrategia)`, ni el manejo de errores por hora.

### 2. `supabase/functions/sync-web/index.ts`

Después del bloque que llama a `evaluate-results` (línea ~326), agregar un bloque gemelo que llame a `generate-carteras`:

```ts
if (summary.nuevasInsertadas > 0) {
  // ... evaluate-results existente ...

  // NUEVO: regenerar carteras de horas futuras
  try {
    const genUrl = "https://project--eaae42aa-34c4-457c-a07c-36f8131c182e.lovable.app/api/public/hooks/generate-carteras";
    const genRes = await fetch(genUrl, { method: "POST", headers: {...}, body: "{}" });
    summary.detalle.push(`↻ generate-carteras: ${...}`);
  } catch (err) { ... }
}
```

**No cambia:** el resto del scraper, la inserción de draws, el sync_logs.

---

## Garantías de seguridad

- **Idempotente:** la tabla `carteras` tiene `unique(fecha, hora, estrategia)`. El upsert sobreescribe la futura, nunca la pasada.
- **Cero riesgo de pisar resultados ya evaluados:** filtramos por `hora > ahora`, así que carteras ya jugadas no se tocan.
- **El cron diario de las 00:02 sigue funcionando** (con `?force=true` para generar el día entero al arrancar).
- **Si el scraper falla:** el cron diario de las 00:02 + el de cada hora siguen siendo red de seguridad.

---

## Lo que NO incluye este plan

- Cron extra de "seguridad cada 15min" → lo dejamos para después si vemos que el scraper falla seguido. Hoy con el trigger del scraper alcanza.
- Cambios en `buildCartera` ni en los pesos de las 4 señales → eso sería otra optimización aparte (la mencioné antes).
- UI nueva → todo invisible para el usuario, solo mejora la calidad de las carteras.

---

## Validación post-deploy

1. Esperar a que salga el próximo sorteo del día.
2. Verificar en `sync_logs.detalle` que aparece la línea `↻ generate-carteras: ...`.
3. Ver en `/cartera` que la cartera de la próxima hora tiene un `created_at` reciente (no de las 00:02).
4. Trackear el hit rate durante 2 semanas y comparar con el 55% actual.

---

## Pregunta antes de implementar

**Zona horaria:** ¿el servidor corre en UTC o en hora local? Si las horas en `lottery_draws.hora` están en hora local Argentina/Colombia/etc, necesito calcular `ahora` en esa misma zona para que el filtro `hora > ahora` funcione bien. Decime qué zona usás y arranco.