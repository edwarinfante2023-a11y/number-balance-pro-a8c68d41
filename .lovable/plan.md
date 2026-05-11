## Objetivo
Cerrar el loop **generar cartera → cargar ganador → evaluar acierto** para que las métricas de precisión/recall/F1 (y `/oportunidades`) tengan datos reales con los que validar el score.

## Estado actual detectado
- ✅ `generate-carteras.ts` ya existe y es idempotente por `(fecha, hora, estrategia)`.
- ❌ **No hay evaluador**: nada inserta en `cartera_resultados` cuando entra un `draw` ganador.
- ⚠️ Solo hay **1 cartera y 1 resultado** en DB → el cron de generate-carteras no está activo (o nunca corrió).
- ⚠️ `cartera_resultados.cartera_id` no tiene índice único → riesgo de duplicados en evaluaciones repetidas.
- ⚠️ El scraper carga `draws` automáticamente, pero la evaluación no se dispara desde ahí.

## Cambios

### 1. Garantizar idempotencia en `cartera_resultados`
- Agregar `UNIQUE (cartera_id)` para que el evaluador pueda hacer `upsert` sin duplicar.

### 2. Endpoint evaluador `/api/public/hooks/evaluate-results`
Server route POST que:
- Lee todos los `draws` de las últimas 48 h con su `lottery_draws.hora` (ventana corta para que sea barato y robusto).
- Para cada `(fecha, hora, numero_ganador)`, busca las `carteras` correspondientes que aún no tengan resultado.
- Inserta/upsert `cartera_resultados { cartera_id, numero_ganador, acierto: numeros.includes(numero_ganador) }`.
- Devuelve resumen `{ evaluadas, aciertos, errores }`.

### 3. Activar pg_cron para los dos hooks
Vía la herramienta `insert` (no migración):
- `generate-carteras` → cada hora a `*/1 * * * *` con minuto `:02`. *(Nota: cron mínimo es por minuto; usaremos `2 * * * *` = cada hora a los :02).*
- `evaluate-results` → `5 * * * *` (cada hora a los :05, después de que el scraper haya tenido tiempo de cargar draws nuevos).
- Headers con `apikey` (anon key) apuntando a `https://project--eaae42aa-34c4-457c-a07c-36f8131c182e.lovable.app`.

### 4. Botón "Re-evaluar ahora" en `/oportunidades`
Pequeño botón al lado del header de **Histórico de oportunidades** que llama al evaluador on-demand. Útil para no esperar al cron mientras debuggeás. Toast con el resumen.

### 5. Mejora UX: indicador de cobertura
En la sección de validación de score, agregar un mini-banner que avise cuando hay <20 carteras evaluadas: *"Las métricas necesitan más datos para ser confiables. Las carteras se generan automáticamente cada hora."*

## Lo que NO incluye este plan (lo dejo para después)
- **Backfill histórico walk-forward** (regenerar carteras retroactivas con corte temporal correcto). Es laborioso y pesado; mejor lo abordamos como paso 2 una vez que el loop "vivo" funcione y veas cómo se comportan las métricas con datos reales día a día.
- Cambios al engine de generación o al motor de oportunidades.

## Detalles técnicos
- **Migración**: `ALTER TABLE cartera_resultados ADD CONSTRAINT cartera_resultados_cartera_id_unique UNIQUE (cartera_id);` (con `DROP CONSTRAINT IF EXISTS` antes para idempotencia).
- **Evaluador**: usa `supabaseAdmin` (bypassa RLS porque corre desde cron), lee draws con join a `lottery_draws`, agrupa por `(fecha, hora)`, hace un solo `upsert` masivo a `cartera_resultados`.
- **Cron SQL** vía `insert` tool, no migración (contiene anon key específica del proyecto).
- **Botón manual**: `fetch("/api/public/hooks/evaluate-results", { method: "POST" })` desde el componente, sin auth porque está bajo `/api/public/`.

## Resultado esperado
Tras el primer ciclo del cron (≤1 hora) y a medida que entren draws ganadores:
- `carteras` se llena con una entrada por hora activa por día.
- `cartera_resultados.acierto` se llena automáticamente.
- Las cards de la sección **"Validación del score"** dejan de mostrar "—" y empiezan a mostrar precisión, recall, F1 y lift reales.
- El selector de umbral (60/70/80/90) funciona con datos.