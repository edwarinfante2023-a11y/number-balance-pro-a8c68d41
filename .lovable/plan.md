## Plan técnico: MVP Fase 1 — Motor de Cartera de 25 Números

### Objetivo del MVP
Validar **una sola hipótesis** en 90 días: ¿una cartera de 25 números, seleccionada con la señal compuesta que ya tenemos, supera consistentemente al baseline aleatorio (25/100 = 25% hit-rate esperado)?

Todo lo demás (ML, optimización multi-objetivo, auto-tuning) queda fuera. Si el lift no aparece con lo simple, no va a aparecer con lo complejo.

---

### Alcance INCLUIDO

1. **Generador de cartera por hora** — input: hora objetivo. Output: lista de 25 números rankeados con score y razón.
2. **Registro de carteras propuestas** — cada cartera generada se persiste antes del sorteo (no se puede editar después).
3. **Evaluación automática post-sorteo** — cuando llega el resultado real, marcar hit/miss y guardar métricas.
4. **Dashboard de performance rolling** — hit-rate cartera vs baseline 25%, lift acumulado, gráfico por hora y por día.
5. **Una sola estrategia activa** — la señal compuesta actual (reglas + patrones + equilibrio). Sin variantes.

### Alcance EXCLUIDO (Fase 2+)
- Multi-estrategia / A/B testing de algoritmos
- Auto-aprendizaje / retraining
- Optimización de tamaño de cartera (siempre 25)
- Carteras manuales editables
- Notificaciones push de carteras
- Backtesting histórico masivo (eso va en Fase 1.5 si Fase 1 muestra señal)

---

### Arquitectura

```text
┌─────────────────────────────────────────────────┐
│  scraper (existe) → draws table                 │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  carteraEngine (nuevo, server-side)             │
│  - lee draws + rules + patterns                 │
│  - score por número (0-100) usando señal actual │
│  - selecciona top 25                            │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  carteras (tabla nueva) — propuesta inmutable   │
└────────────────┬────────────────────────────────┘
                 │  (cuando llega resultado real)
                 ▼
┌─────────────────────────────────────────────────┐
│  evaluator (cron) → cartera_resultados          │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  /cartera (UI) — generador + dashboard rolling  │
└─────────────────────────────────────────────────┘
```

---

### Schema (2 tablas nuevas)

**`carteras`** — propuesta inmutable
- `id uuid PK`
- `fecha date NOT NULL`
- `hora text NOT NULL`
- `numeros integer[] NOT NULL` — los 25 elegidos
- `scores jsonb NOT NULL` — `{ "23": 87, "47": 82, ... }`
- `estrategia text NOT NULL DEFAULT 'composite_v1'`
- `contexto jsonb` — snapshot de reglas/patrones que justificaron la selección
- `created_at timestamptz`
- UNIQUE(`fecha`, `hora`, `estrategia`) — una cartera por hora/estrategia

**`cartera_resultados`** — evaluación post-sorteo
- `id uuid PK`
- `cartera_id uuid FK → carteras`
- `numero_ganador integer NOT NULL`
- `acierto boolean NOT NULL` — `numero_ganador IN cartera.numeros`
- `evaluated_at timestamptz`
- UNIQUE(`cartera_id`)

Ambas con RLS `has_role(auth.uid(), 'admin')` (mismo patrón que el resto).

---

### Componentes técnicos

**1. `supabase/functions/_shared/carteraEngine.ts`**
- Función pura: `buildCartera(sorteos, rules, patterns, hora) → { numeros, scores, contexto }`
- Score por número: combina (a) frecuencia ajustada por hora, (b) señal de equilibrio (compensación pendiente), (c) match con reglas activas, (d) match con patrones de esa hora.
- Determinista: misma input → mismo output (clave para auditoría).

**2. Server function: `src/lib/cartera.functions.ts`**
- `generateCartera({ hora })` — protegida con `requireSupabaseAuth`. Llama al engine, persiste en `carteras`, devuelve la propuesta.
- `getCarteraStats({ días })` — devuelve hit-rate rolling, lift vs baseline, breakdown por hora.

**3. Cron de evaluación: `src/routes/api/public/hooks/evaluate-carteras.ts`**
- Corre cada hora. Busca carteras sin resultado cuyo sorteo ya ocurrió (`draws` con misma fecha+hora). Inserta en `cartera_resultados`.

**4. UI: `src/routes/cartera.tsx`**
- Selector de hora → botón "Generar cartera"
- Grid 5×5 con los 25 números, cada uno con badge de score y tooltip con razón
- Sección inferior: dashboard rolling 30/60/90 días
  - KPI: Hit-rate cartera vs 25% baseline, lift absoluto, sample size (N sorteos evaluados)
  - Línea: hit-rate por día (últimos 90)
  - Barra: hit-rate por hora (qué franjas funcionan mejor)
  - Banda de confianza para distinguir señal real de ruido (Wilson score interval)

**5. Hook: `src/hooks/useCartera.ts`** — wrappers de las server fns con TanStack Query.

---

### Lo que NO hay que construir todavía

- Edge functions complejas con ML
- Sistema de versionado de estrategias (lo agregamos en Fase 2 cuando exista una segunda estrategia)
- UI para editar carteras (la inmutabilidad ES la feature — sin trampa al evaluar)
- Notificaciones push de carteras (primero validar que la señal existe)
- Reportes PDF / exportación

---

### Cómo se valida el éxito

Después de **90 días corriendo en producción** con generación automática hora a hora:

| Métrica | Umbral mínimo para seguir |
|---|---|
| Sample size | ≥ 500 carteras evaluadas |
| Hit-rate observado | ≥ 28% (baseline 25% + 3pp de lift) |
| Wilson lower bound 95% | > 25% |
| Estabilidad | Lift positivo en ≥ 60% de las semanas |

Si los 4 se cumplen → Fase 2 (auto-tuning, multi-estrategia).
Si no → la lotería es genuinamente aleatoria y el sistema te lo dice honestamente. Igualmente valioso.

---

### Orden de implementación (1 sola entrega)

1. Migración: `carteras` + `cartera_resultados` (idempotente, patrón del CLAUDE.md)
2. `carteraEngine.ts` compartido + tests básicos
3. Server functions `generateCartera` + `getCarteraStats`
4. Cron `evaluate-carteras` + agendar pg_cron horario
5. Ruta `/cartera` con generador + dashboard
6. Entrada en sidebar de `AppLayout`

Estimado: 1 sesión de implementación. Sin tocar lo existente (scraper, alertas, equilibrio, etc.).

---

¿Apruebas el plan así o quieres ajustar alcance antes de implementar?