## Plan — Flujo de oportunidades en tiempo real

### Objetivo del flujo (lo que vas a vivir como usuario)

```text
┌──────────────────────────────────────────────────────────────┐
│ Cada 5 min, el sistema mira: ¿hay alguna hora cuyo sorteo   │
│ ocurre en los próximos 25–35 min con cartera ya generada    │
│ Y con internalScore ≥ 70 Y sin resultado todavía?           │
└──────────┬───────────────────────────────────────────────────┘
           │ SÍ
           ▼
┌──────────────────────────────────────────────────────────────┐
│  T-30min antes del sorteo te llega:                          │
│  ① Push del navegador (incluso con la app cerrada)           │
│  ② Banner persistente arriba de toda la app                  │
│  ③ Sonido corto (si la app está abierta)                     │
│                                                              │
│  Texto: "🔥 Oportunidad 17:00 · score 84/100 · 25 números"  │
│  → Click te lleva a /cartera con esa hora cargada            │
└──────────────────────────────────────────────────────────────┘
```

Una alerta por (fecha, hora) — nunca se repite. Si más tarde sube el score de la misma hora, no vuelve a notificar.

---

### Decisiones aprobadas
- **Anticipación:** 30 min antes del sorteo (con tolerancia de ±5 min para alinear con el cron)
- **Canales:** push del navegador + banner persistente in-app + sonido corto
- **Disparo:** `internalScore ≥ 70` Y todavía no existe resultado en `cartera_resultados`

---

### Arquitectura

```text
pg_cron (cada 5 min)
       │
       ▼
/api/public/hooks/scan-opportunities  ── busca horas que cumplen criterio
       │                                  e inserta en opportunity_alerts
       ▼
opportunity_alerts (tabla nueva)         (UNIQUE por fecha+hora — anti-spam)
       │
       ├──→ Edge function: send-opportunity-push
       │         └──→ Web Push a todos los push_subscriptions activos
       │                 └──→ Service Worker → notificación nativa
       │
       └──→ Cliente (Realtime subscription)
                 └──→ OpportunityWatcher (componente sin UI):
                          ① toast persistente con botón "Ver cartera"
                          ② banner sticky arriba de la app
                          ③ play() de un .wav corto
```

---

### Detalles técnicos

#### 1. Tablas nuevas (migración idempotente)

**`push_subscriptions`** (no existe — el edge function ya la referencia pero la tabla nunca se creó):
- `id uuid PK`, `user_id uuid` (FK → auth.users), `endpoint text UNIQUE`, `p256dh text`, `auth text`, `created_at`, `last_seen_at`
- RLS: usuario solo ve/escribe sus propias subs

**`opportunity_alerts`**:
- `id uuid PK`, `fecha date`, `hora text`, `cartera_id uuid` (FK → carteras), `internal_score int`, `top_mean numeric`, `gap numeric`, `notified_at timestamptz`, `dismissed_at timestamptz NULL`, `created_at`
- `UNIQUE (fecha, hora)` — garantiza una sola alerta por slot
- RLS admin como el resto

#### 2. Lead-time y "ventana de aviso"

El cron corre cada 5 min y busca horas cuyo `hora` (HH:MM) caiga en la ventana **`[ahora+25min, ahora+35min]`**. Eso te da el aviso ~30 min antes con margen para que el cron no falle un ciclo.

#### 3. Endpoint cron `/api/public/hooks/scan-opportunities` (TanStack server route)

```text
1. fecha = hoy, ahora = NOW
2. ventana = [ahora+25min, ahora+35min]
3. SELECT carteras del día con hora ∈ ventana
4. Filtrar:
   - contexto.confidence.internalScore ≥ 70
   - NO existe cartera_resultados para esa cartera
   - NO existe ya opportunity_alert para (fecha, hora)
5. Para cada match: INSERT en opportunity_alerts
6. Disparar edge function send-opportunity-push con la lista
```

Schedule pg_cron: `*/5 * * * *`.

#### 4. Edge function `send-opportunity-push` (reutiliza `webPush.ts` existente)

- Recibe `{ alerts: [{ id, hora, internal_score }] }`
- Lee `push_subscriptions` activas
- Envía payload `{ title, body, url: "/cartera?hora=HH:MM", tag: "opp-HH:MM" }` a cada sub
- Maneja 404/410 → cleanup de la sub expirada (igual que `generate-alerts` ya hace)

#### 5. Service Worker (`public/sw.js`)

Ya existe para push. Verificar que el handler `notificationclick` use el `url` del payload para abrir `/cartera?hora=...`.

#### 6. Cliente — `OpportunityWatcher.tsx` (nuevo componente sin UI)

Se monta en `__root.tsx` junto a `BalanceAlertsWatcher`. Hace:
- Realtime subscription a `opportunity_alerts` (`postgres_changes` INSERT)
- Al recibir nueva alerta:
  - `toast()` con duración indefinida + acción "Ver cartera"
  - Set state global → `OpportunityBanner` visible
  - `new Audio("/notification.wav").play().catch(()=>{})` (silencioso si autoplay bloqueado)

#### 7. `OpportunityBanner.tsx` (nuevo, en AppLayout)

Banner sticky `top-0` amarillo/primary cuando hay alertas activas (no dismissed):
```text
🔥 Oportunidad 17:00 · score 84/100 · cierra en 28 min  [Ver]  [×]
```
El [×] hace UPDATE `dismissed_at = now()`. Si hay >1, muestra "+N más" expandible.

#### 8. Página `/oportunidades` (extender la existente)

Tabla histórica de todas las `opportunity_alerts`: fecha, hora, score, si fue acertada (join con `cartera_resultados`), tasa de acierto solo de las alertadas vs todas.

---

### Anti-spam y casos borde

| Caso | Comportamiento |
|---|---|
| Cron corre 2 veces seguidas y ve la misma hora | UNIQUE constraint la rechaza, no notifica de nuevo |
| Score sube de 65 a 78 después de la primera detección | Como ya existe la fila, no se re-notifica (ok) |
| Usuario sin push permission | Solo recibe banner + sonido (degradación graceful) |
| Sorteo ya ocurrió mientras se procesaba | Filtro `NOT EXISTS cartera_resultados` lo excluye |
| Hora de madrugada cuando estás durmiendo | El push igual llega, el banner aparece al abrir la app |

---

### Orden de implementación (1 sesión)

1. Migración: `push_subscriptions` + `opportunity_alerts` + RLS
2. Edge function `send-opportunity-push` (reutiliza `webPush.ts`)
3. Server route `src/routes/api/public/hooks/scan-opportunities.ts`
4. Schedule pg_cron `scan-opportunities` cada 5 min
5. `OpportunityWatcher.tsx` (Realtime + toast + sonido) en `__root.tsx`
6. `OpportunityBanner.tsx` sticky en `AppLayout`
7. Asset `public/notification.wav` (sonido corto, ~1seg)
8. Verificar `sw.js` maneja `notificationclick` con la URL del payload
9. Extender `/oportunidades` con tabla histórica + tasa de acierto de las alertadas

---

### Lo que NO se hace en esta fase
- Configuración por usuario del lead-time (queda hardcoded a 30 min ±5)
- Snooze / silenciamiento por hora
- Stats avanzadas (lift de las alertadas vs no alertadas — sale solo cuando haya datos)
- Email de respaldo
- Alertas predictivas multi-sorteo

---

### Cómo se valida que funciona

1. Generar manualmente una cartera para una hora ~30 min en el futuro con score forzado ≥ 70
2. Esperar el siguiente ciclo de cron (≤5 min)
3. Verificar: fila en `opportunity_alerts`, push recibido, banner visible, sonido reproducido
4. Click en la notificación → debe abrir `/cartera?hora=HH:MM` con esa hora pre-cargada