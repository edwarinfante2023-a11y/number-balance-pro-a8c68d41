import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
  LogOut,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean };
const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/historial", label: "Historial", icon: History },
  { to: "/importar", label: "Importar Excel", icon: FileSpreadsheet },
  { to: "/captura", label: "Captura manual", icon: PencilLine },
  { to: "/reglas", label: "Reglas y patrones", icon: ScrollText },
  { to: "/analisis-hora", label: "Análisis por hora", icon: Clock },
  { to: "/reportes", label: "Reportes", icon: FileBarChart },
  { to: "/configuracion", label: "Configuración", icon: Settings },
];

export function AppLayout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { session, isAdmin, loading } = useAuth();

  // No proteger /auth
  const isAuthRoute = location.pathname === "/auth";

  useEffect(() => {
    if (!loading && !session && !isAuthRoute) {
      navigate({ to: "/auth" });
    }
  }, [loading, session, isAuthRoute, navigate]);

  if (isAuthRoute) {
    return <Outlet />;
  }

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return null; // redirigiendo
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen grid place-items-center bg-background px-4">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-warning/10">
            <ShieldAlert className="size-6 text-warning" />
          </div>
          <h1 className="text-xl font-semibold">Acceso restringido</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tu cuenta no tiene permisos de administrador. Pide al admin del sistema que te asigne
            el rol <code className="px-1 py-0.5 rounded bg-muted">admin</code> en la tabla{" "}
            <code className="px-1 py-0.5 rounded bg-muted">user_roles</code>.
          </p>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              toast.success("Sesión cerrada");
            }}
            className="mt-5 inline-flex items-center gap-2 h-9 px-4 rounded-md border border-border bg-card text-sm hover:bg-accent"
          >
            <LogOut className="size-4" /> Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

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
            "fixed lg:static inset-y-0 left-0 z-40 w-72 border-r border-border bg-card transition-transform lg:translate-x-0 flex flex-col",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="hidden lg:flex items-center gap-2.5 px-6 h-16 border-b border-border shrink-0">
            <div className="size-8 rounded-lg bg-foreground text-background grid place-items-center">
              <Sparkles className="size-4" />
            </div>
            <div className="leading-tight">
              <div className="font-semibold tracking-tight">Cuadrante</div>
              <div className="text-xs text-muted-foreground">Análisis de sorteos</div>
            </div>
          </div>
          <nav className="p-3 space-y-0.5 flex-1 overflow-y-auto">
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
          <div className="p-4 border-t border-border bg-card shrink-0">
            <div className="rounded-lg bg-muted px-3 py-2.5 mb-2">
              <div className="text-xs font-medium truncate">{session.user.email}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Administrador</div>
            </div>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                toast.success("Sesión cerrada");
              }}
              className="w-full inline-flex items-center justify-center gap-2 h-9 rounded-md border border-border bg-card text-xs hover:bg-accent"
            >
              <LogOut className="size-3.5" /> Cerrar sesión
            </button>
          </div>
        </aside>

        {open && (
          <div
            onClick={() => setOpen(false)}
            className="lg:hidden fixed inset-0 z-30 bg-foreground/20"
          />
        )}

        <main className="flex-1 min-w-0">
          <div className="mx-auto max-w-7xl px-4 lg:px-8 py-6 lg:py-10">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
