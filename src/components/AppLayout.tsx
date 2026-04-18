import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { useState } from "react";
import {
  LayoutDashboard,
  History,
  FileSpreadsheet,
  PencilLine,
  ScrollText,
  Clock,
  FileBarChart,
  Settings,
  Menu,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/historial", label: "Historial", icon: History },
  { to: "/importar", label: "Importar Excel", icon: FileSpreadsheet },
  { to: "/captura", label: "Captura manual", icon: PencilLine },
  { to: "/reglas", label: "Reglas y patrones", icon: ScrollText },
  { to: "/analisis-hora", label: "Análisis por hora", icon: Clock },
  { to: "/reportes", label: "Reportes", icon: FileBarChart },
  { to: "/configuracion", label: "Configuración", icon: Settings },
] as const;

export function AppLayout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/80 backdrop-blur px-4 h-14">
        <button
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center justify-center rounded-md p-2 hover:bg-accent"
          aria-label="Abrir menú"
        >
          <Menu className="size-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-lg bg-foreground text-background grid place-items-center">
            <Sparkles className="size-4" />
          </div>
          <span className="font-semibold tracking-tight">Cuadrante</span>
        </div>
        <div className="w-9" />
      </header>

      <div className="lg:flex">
        {/* Sidebar */}
        <aside
          className={cn(
            "fixed lg:static inset-y-0 left-0 z-40 w-72 border-r border-border bg-card transition-transform lg:translate-x-0",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="hidden lg:flex items-center gap-2.5 px-6 h-16 border-b border-border">
            <div className="size-8 rounded-lg bg-foreground text-background grid place-items-center">
              <Sparkles className="size-4" />
            </div>
            <div className="leading-tight">
              <div className="font-semibold tracking-tight">Cuadrante</div>
              <div className="text-xs text-muted-foreground">Análisis de sorteos</div>
            </div>
          </div>
          <nav className="p-3 space-y-0.5">
            {NAV.map((item) => {
              const active = item.exact
                ? location.pathname === item.to
                : location.pathname.startsWith(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-foreground text-background font-medium"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border bg-card">
            <div className="rounded-lg bg-muted px-3 py-2.5">
              <div className="text-xs font-medium">Modo demo</div>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                Datos simulados. Conecta importación o scraper para datos reales.
              </p>
            </div>
          </div>
        </aside>

        {/* Backdrop */}
        {open && (
          <div
            onClick={() => setOpen(false)}
            className="lg:hidden fixed inset-0 z-30 bg-foreground/20"
          />
        )}

        {/* Main */}
        <main className="flex-1 min-w-0">
          <div className="mx-auto max-w-7xl px-4 lg:px-8 py-6 lg:py-10">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
