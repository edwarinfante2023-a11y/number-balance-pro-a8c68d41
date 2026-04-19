# Anguila — Sistema de Análisis de Lotería

Aplicación web para registrar, importar y analizar sorteos de la lotería **Anguila** (con sorteos por horario: 08:00 a 21:00) y otras loterías. Incluye captura manual, importación desde Excel, clasificación automática (Alto/Bajo, Par/Impar, Cuadrantes), reglas, patrones y reportes.

> Proyecto desarrollado en [Lovable](https://lovable.dev) con sincronización a GitHub para edición externa (VS Code, Cursor, Claude Code, etc.).

---

## 🧱 Stack

- **Frontend:** React 19 + TypeScript + Vite 7
- **Routing:** TanStack Router (file-based, en `src/routes/`)
- **Estado server:** TanStack Query
- **UI:** Tailwind CSS v4 + shadcn/ui (New York) + Radix
- **Backend:** Lovable Cloud (Supabase administrado por Lovable)
  - PostgreSQL con RLS
  - Auth (email + Google)
  - Edge Functions (cuando aplique)
- **Build / Deploy:** Cloudflare Workers vía `@cloudflare/vite-plugin`

---

## 🗂️ Estructura del proyecto

```
src/
├── routes/                    # Rutas (file-based, TanStack Router)
│   ├── __root.tsx             # Layout raíz (providers, QueryClient)
│   ├── index.tsx              # Dashboard
│   ├── auth.tsx               # Login / Signup
│   ├── captura.tsx            # Captura manual de sorteos
│   ├── importar.tsx           # Importación desde Excel
│   ├── historial.tsx          # Historial de sorteos
│   ├── analisis-hora.tsx      # Análisis por horario
│   ├── reglas.tsx             # Reglas de detección
│   ├── reportes.tsx           # Reportes
│   └── configuracion.tsx      # Loterías + sorteos por horario
├── components/                # Componentes reutilizables
│   ├── ui/                    # shadcn/ui (no editar a mano)
│   ├── AppLayout.tsx
│   ├── BalanceBar.tsx
│   ├── ClassificationBadge.tsx
│   ├── PageHeader.tsx
│   └── StatCard.tsx
├── hooks/                     # Custom hooks (data fetching, auth)
│   ├── useAuth.ts
│   ├── useDraws.ts
│   ├── useImports.ts
│   ├── useLotteries.ts
│   └── useSettings.ts
├── lib/                       # Lógica de negocio y utilidades
│   ├── lottery.ts             # Tipos y clasificación
│   ├── drawAdapter.ts         # Adaptador DB ↔ dominio
│   ├── excelParser.ts         # Parser de Excel
│   ├── format.ts
│   └── queryClient.ts
├── integrations/supabase/     # ⚠️ AUTO-GENERADO — NO EDITAR
│   ├── client.ts              # Cliente browser (anon key)
│   ├── client.server.ts       # Cliente server (service role)
│   ├── types.ts               # Tipos de la BD
│   └── auth-middleware.ts
├── styles.css                 # Tokens de diseño (Tailwind v4 + oklch)
├── router.tsx                 # Configuración del router
└── routeTree.gen.ts           # ⚠️ AUTO-GENERADO — NO EDITAR

supabase/
├── config.toml                # Config del proyecto Supabase
└── migrations/                # ⚠️ AUTO-GESTIONADO por Lovable
```

---

## 🔐 Variables de entorno

El archivo **`.env`** lo gestiona Lovable automáticamente y **no se sube a GitHub** (está en `.gitignore`). Si trabajas fuera de Lovable, copia `.env.example` a `.env` y rellena los valores reales.

| Variable                        | Dónde se usa                        | Cómo obtenerla                            |
| ------------------------------- | ----------------------------------- | ----------------------------------------- |
| `VITE_SUPABASE_URL`             | Cliente browser                     | Lovable Cloud → Backend → Connect         |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Cliente browser (anon key, pública) | Lovable Cloud → Backend → Connect         |
| `VITE_SUPABASE_PROJECT_ID`      | Referencia interna                  | Lovable Cloud → Backend → Connect         |
| `SUPABASE_URL`                  | Server / SSR                        | Igual que `VITE_SUPABASE_URL`             |
| `SUPABASE_PUBLISHABLE_KEY`      | Server / SSR                        | Igual que `VITE_SUPABASE_PUBLISHABLE_KEY` |
| `SUPABASE_SERVICE_ROLE_KEY`     | **Solo server**, bypass de RLS      | Lovable Cloud → Backend → Connect         |

> ⚠️ **Nunca** expongas `SUPABASE_SERVICE_ROLE_KEY` al cliente. Solo úsala en `client.server.ts` o edge functions.

### Secretos adicionales (gestionados en Lovable Cloud)

- `LOVABLE_API_KEY` — para Lovable AI Gateway
- `SUPABASE_DB_URL` — conexión directa a Postgres

---

## 🚀 Workflow Lovable + GitHub + edición externa

1. **Edita en Lovable** → cambios se pushean automáticamente a GitHub.
2. **Edita local** (VS Code / Claude Code) → `git push` → cambios bajan a Lovable en segundos.
3. **No edites el mismo archivo en paralelo** en ambos lados para evitar conflictos.

### Correr local

```bash
bun install         # o npm install
bun run dev         # http://localhost:5173
```

Para que arranque local necesitas crear un `.env` con las variables de arriba.

### Build

```bash
bun run build
bun run preview
```

---

## ⚠️ Archivos que NO debes editar manualmente

Estos se regeneran automáticamente y editarlos romperá la sincronización:

- `src/integrations/supabase/client.ts`
- `src/integrations/supabase/client.server.ts`
- `src/integrations/supabase/types.ts`
- `src/routeTree.gen.ts`
- `supabase/migrations/*` (usar la herramienta de migraciones de Lovable)
- `.env` (lo regenera Lovable Cloud)
- `bun.lockb`, `package-lock.json`

---

## 🗄️ Modelo de datos (resumen)

- **`lotteries`** — Loterías madre (ej: Anguila)
- **`lottery_draws`** — Sorteos por horario dentro de una lotería (ej: Anguila 08:00, 09:00, …)
- **`draws`** — Resultados individuales (`sorteo_id` → `lottery_draws.id`)
- **`imports`** — Historial de importaciones desde Excel
- **`rules`** / **`patterns`** / **`alerts`** — Análisis y detección
- **`settings`** — Configuración global (umbrales de clasificación, etc.)
- **`user_roles`** — Roles (admin/user), separado de `auth.users` por seguridad

Toda la BD usa **RLS** con función `has_role(user_id, role)` para autorizar acceso admin.

---

## 📦 Dependencias clave

Instala/elimina con `bun add <pkg>` / `bun remove <pkg>`. Si trabajas desde Lovable, usa el flujo del editor.

---

## 🔗 Enlaces

- **Proyecto Lovable:** https://lovable.dev/projects/eaae42aa-34c4-457c-a07c-36f8131c182e
- **Docs Lovable:** https://docs.lovable.dev
- **Docs TanStack Start:** https://tanstack.com/start

<!-- sync-check: GitHub ↔ Lovable verificado -->
