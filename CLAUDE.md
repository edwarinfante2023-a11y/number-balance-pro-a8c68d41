# CLAUDE.md — Guía para Claude Code

Instrucciones específicas para trabajar este repo desde **Claude Code** (o cualquier IDE externo) manteniendo compatibilidad con **Lovable + Lovable Cloud (Supabase)**.

> **Regla de oro:** la fuente de verdad del schema es la base de datos en Lovable Cloud — NO los archivos de `supabase/migrations/`. Antes de escribir código que toque una tabla, consulta `src/integrations/supabase/types.ts` (auto-generado desde la DB real).

---

## 1. Stack y arquitectura

- **Framework:** TanStack Start v1 (React 19 + Vite 7, SSR en Cloudflare Worker)
- **Routing:** file-based en `src/routes/` (auto-genera `routeTree.gen.ts`)
- **Estado server:** TanStack Query (`src/lib/queryClient.ts`)
- **Backend:** Supabase vía Lovable Cloud (auth + DB + RLS)
- **Estilos:** Tailwind v4 con tokens semánticos en `src/styles.css` (oklch)
- **Package manager:** Bun (`bun install`, `bun run dev`)

---

## 2. Archivos AUTO-GENERADOS — NO EDITAR JAMÁS

Editar cualquiera de estos rompe la sincronización con Lovable o el build:

| Archivo | Generado por | Notas |
|---|---|---|
| `src/integrations/supabase/client.ts` | Lovable | Cliente Supabase con env vars |
| `src/integrations/supabase/types.ts` | Supabase CLI / Lovable | Refleja el schema **real** de la DB |
| `src/routeTree.gen.ts` | TanStack Router Vite plugin | Se regenera en cada build |
| `supabase/migrations/*.sql` | Lovable migration tool | Solo agregar nuevas vía `supabase migration` o desde Lovable |
| `.env` | Lovable | Variables de Supabase auto-inyectadas |
| `bun.lock` / `package-lock.json` | Bun / npm | Lock files |

**Si necesitas cambiar el schema:** créalo desde Lovable (que aplica la migración a Cloud) o vía Supabase CLI con la DB conectada — luego `types.ts` se regenera. Nunca edites `types.ts` a mano.

---

## 3. Schema REAL de la base de datos (⚠️ leer antes de tocar tablas)

Hay diferencias importantes entre los nombres "intuitivos" en español y los nombres reales de las columnas. **Si te equivocas, el build TypeScript falla.**

### `rules` — tabla de reglas lógicas

```ts
{
  id: uuid
  nombre: text                 // NOT NULL
  tipo: enum 'rule_tipo'       // ⚠️ ENUM, no string libre
  condiciones: jsonb           // ⚠️ PLURAL — NO es 'condicion'
  resultado_esperado: text | null   // ⚠️ NULLABLE
  descripcion: text | null     // ⚠️ NULLABLE
  efectividad: numeric         // default 0
  aciertos: integer            // default 0
  ocurrencias: integer         // default 0
  activo: boolean              // ⚠️ MASCULINO — NO es 'activa'
  created_at, updated_at: timestamptz
}
```

**Enum `rule_tipo`:** `'racha' | 'compensacion' | 'patron' | 'bloqueo' | 'otro'` (todo minúscula).

```ts
// ✅ CORRECTO
import type { Database } from "@/integrations/supabase/types";
type RuleTipo = Database["public"]["Enums"]["rule_tipo"];

await supabase.from("rules").insert({
  nombre: "Mi regla",
  tipo: "racha",            // enum value, no "Racha"
  condiciones: { ... },     // PLURAL
  activo: true,             // masculino
  resultado_esperado: "ALTO",
});

// ❌ INCORRECTO (errores TS)
await supabase.from("rules").insert({
  tipo: "Racha",            // ❌ no matchea enum
  condicion: { ... },       // ❌ singular
  activa: true,             // ❌ femenino
});
```

### `lotteries` y `lottery_draws` — relación 1:N

- `lotteries`: lotería madre (`nombre`, `descripcion`, `horarios: jsonb`, `activa: boolean`)
- `lottery_draws`: sorteos de cada lotería (`loteria_id` FK, `nombre`, `hora: text`, `activa`)

### `draws` — sorteos capturados

- `sorteo_id` apunta a `lottery_draws.id` (NO a `lotteries.id`)
- `numero: integer`, `fecha: date`
- `alto_bajo`, `par_impar`, `cuadrante` se calculan automáticamente vía trigger `auto_classify_draw` — pasa placeholders al insertar y el trigger los sobreescribe
- `subcuadrante: text | null` (espejo de `cuadrante` por compatibilidad)
- `extra: jsonb | null` — campo libre, casteado a `DrawExtra` en el frontend (ver `src/lib/lottery.ts`)
- `origen: enum draw_origen` = `'manual' | 'scraper' | 'excel'`

Para hacer queries con join completo (lottery_draws → lotteries) usa `useDraws()` en `src/hooks/useDraws.ts` — ya está mapeado a un tipo `Draw` enriquecido.

### `imports`, `alerts`, `patterns`, `settings`

- `imports.detalle_errores: jsonb` (default `[]`)
- `alerts.nivel: enum alert_nivel` = `'info' | 'warning' | 'critical'`
- `settings.clave/valor` — clave-valor genérico (ej. `clave='classification'` controla `altoThreshold`)

### `user_roles` — roles separados (NO en `profiles`)

- Enum `app_role`: `'admin' | 'user'`
- Función SECURITY DEFINER `has_role(_user_id, _role)` — **úsala en RLS**, nunca consultes `user_roles` directamente desde una policy (causa recursión)
- Toda RLS en este proyecto usa `has_role(auth.uid(), 'admin'::app_role)`

---

## 4. Variables de entorno

Lovable inyecta automáticamente `.env`. Para trabajar fuera de Lovable, copia `.env.example` → `.env`:

```bash
# Cliente (browser, prefijo VITE_)
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_PROJECT_ID

# Server / SSR
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY

# Server-only (NUNCA exponer al cliente)
SUPABASE_SERVICE_ROLE_KEY
```

**Secretos en Lovable Cloud** (no van a `.env`, se acceden desde edge functions vía `process.env`):
- `LOVABLE_API_KEY` — para Lovable AI Gateway
- `SUPABASE_DB_URL` — conexión directa a Postgres

---

## 5. Design system — tokens, NO colores hardcoded

**Regla:** nunca uses `bg-white`, `text-black`, `bg-blue-500`, etc. en componentes. Usa siempre tokens semánticos definidos en `src/styles.css`:

```tsx
// ✅ CORRECTO
<div className="bg-background text-foreground border-border">
<button className="bg-primary text-primary-foreground hover:bg-primary/90">

// ❌ INCORRECTO
<div className="bg-white text-gray-900 border-gray-200">
<button className="bg-blue-500 text-white">
```

**Tokens disponibles** (definidos como variables `oklch()` en `src/styles.css`):
- Surfaces: `background`, `foreground`, `card`, `card-foreground`, `muted`, `muted-foreground`, `popover`, `popover-foreground`
- Acción: `primary`, `primary-foreground`, `secondary`, `secondary-foreground`, `accent`, `accent-foreground`, `destructive`, `destructive-foreground`
- UI: `border`, `input`, `ring`

**Theme actual:** light SaaS premium ("Donezo") con tipografía bold, esquinas redondeadas (`rounded-[16px]`, `rounded-[24px]`, `rounded-[32px]`), sombras suaves (`shadow-sm`, `shadow-md`).

**Si necesitas un color nuevo:** agrégalo como variable oklch en `:root` dentro de `src/styles.css` y úsalo vía `bg-[var(--mi-token)]` o extiende el config de Tailwind.

---

## 6. Convenciones de código

### Componentes
- `src/components/` para reusables, `src/components/ui/` para primitivos shadcn (no editar a la ligera)
- Hooks personalizados en `src/hooks/` con prefijo `use*`
- Helpers puros en `src/lib/`
- Cada ruta en `src/routes/` exporta `Route = createFileRoute(...)` y un componente

### TanStack Router
- Importa SIEMPRE de `@tanstack/react-router` (NO `react-router-dom`)
- Cada ruta nueva = nuevo archivo en `src/routes/` (el plugin regenera `routeTree.gen.ts`)
- No edites `routeTree.gen.ts`
- Evita slashes finales en rutas (`/reglas`, NO `/reglas/`)

### TanStack Query
- `queryKey` siempre un array (`["draws", opts]`)
- Invalida con `qc.invalidateQueries({ queryKey: [...] })`
- Mutaciones que cambian datos → invalidar las queries afectadas en `onSuccess`

### Supabase
- Importa el cliente: `import { supabase } from "@/integrations/supabase/client"`
- Tipos: `import type { Database } from "@/integrations/supabase/types"`
- Para queries con join, tipa la respuesta cruda con un interface y mapea a un tipo enriquecido (ver `useDraws.ts` como ejemplo canónico)

---

## 7. Flujo de trabajo Lovable ↔ GitHub ↔ Claude Code

1. **Editar en Lovable:** los cambios se pushean automáticamente al repo de GitHub conectado
2. **Editar localmente / Claude Code:**
   ```bash
   git pull              # trae cambios de Lovable
   # ... edita ...
   git add .
   git commit -m "..."
   git push              # Lovable detecta el push y refresca su preview
   ```
3. **Cambios de schema:** SIEMPRE hazlos desde Lovable (UI o agente) para que la migración se aplique a la DB real y `types.ts` se regenere. Si haces SQL local, vas a desincronizar.
4. **Conflictos en `routeTree.gen.ts`:** acepta cualquier versión y deja que el siguiente `bun run dev` lo regenere.

---

## 8. Comandos útiles

```bash
bun install                  # instalar deps
bun run dev                  # dev server (localhost:8080)
bun run build                # build de producción
bunx tsc --noEmit            # typecheck (correr SIEMPRE antes de push)
bunx eslint .                # lint
```

> Antes de cada push desde Claude Code, corre `bunx tsc --noEmit` — el build de Lovable es estricto y cualquier error TS bloquea el deploy.

---

## 9. Checklist antes de hacer push

- [ ] `bunx tsc --noEmit` pasa sin errores
- [ ] No edité ningún archivo de la sección **2** (auto-generados)
- [ ] No usé colores hardcoded (revisar diff)
- [ ] Si toqué tablas, los nombres de columnas matchean el schema de la sección **3**
- [ ] Si agregué una ruta, el archivo está en `src/routes/` con la convención correcta
- [ ] No commité secrets ni el `.env` real

---

**Última actualización del schema:** 2026-04-19. Si `src/integrations/supabase/types.ts` cambió, esta guía puede estar desactualizada — la DB siempre gana.
