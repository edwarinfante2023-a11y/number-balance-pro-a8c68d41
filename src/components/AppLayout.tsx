import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { OpportunityBanner } from "@/components/OpportunityBanner";
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
  LogOut,
  Loader2,
  ShieldAlert,
  X,
  Search,
  Bell,
  TrendingUp,
  Scale,
  Briefcase,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useAlerts } from "@/hooks/useAlerts";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SyncStatusBadge } from "@/components/SyncStatusBadge";
import { PushPrompt } from "@/components/PushPrompt";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  section?: string;
  badge?: number;
};

const NAV: NavItem[] = [
  { to: "/", label: "Panel Principal", icon: LayoutDashboard, exact: true, section: "MENU", badge: 12 },
  { to: "/alertas", label: "Centro de Alertas", icon: Bell, section: "MENU" },
  { to: "/historial", label: "Registro Histórico", icon: History, section: "MENU" },
  { to: "/analisis-hora", label: "Análisis por hora", icon: Clock, section: "MENU" },
  { to: "/oportunidades", label: "Oportunidades", icon: TrendingUp, section: "MENU" },
  { to: "/equilibrio", label: "Equilibrio", icon: Scale, section: "MENU" },
  { to: "/cartera", label: "Cartera 25 (MVP)", icon: Briefcase, section: "MENU" },
  { to: "/simulador", label: "Simulador", icon: Activity, section: "MENU" },
  { to: "/comparativa", label: "Manual vs Real", icon: FileBarChart, section: "MENU" },
  { to: "/reglas", label: "Reglas Lógicas", icon: ScrollText, section: "MENU" },
  { to: "/importar", label: "Ingestión de Datos", icon: FileSpreadsheet, section: "DATA" },
  { to: "/captura", label: "Captura Manual", icon: PencilLine, section: "DATA" },
  { to: "/reportes", label: "Exportar Reportes", icon: FileBarChart, section: "DATA" },
  { to: "/estado-sync", label: "Estado del Sync", icon: Activity, section: "DATA" },
  { to: "/configuracion", label: "Configuración", icon: Settings, section: "GENERAL" },
];

const SECTIONS = ["MENU", "DATA", "GENERAL"];

export function AppLayout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { session, isAdmin, loading } = useAuth();
  const { unreadCount } = useAlerts();

  const isAuthRoute = location.pathname === "/auth";

  useEffect(() => {
    if (!loading && !session && !isAuthRoute) {
      navigate({ to: "/auth" });
    }
  }, [loading, session, isAuthRoute, navigate]);

  // Modificamos el badge de NAV dynamically
  const dynamicNav = NAV.map(n => 
    n.to === "/alertas" && unreadCount > 0 ? { ...n, badge: unreadCount } : n
  );

  if (isAuthRoute) return <Outlet />;

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="size-16 rounded-[24px] surface-elevated grid place-items-center">
           <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!session) return null;

  if (!isAdmin) {
    return (
      <div className="min-h-screen grid place-items-center bg-background px-4">
        <div className="max-w-md text-center surface-raised p-10 rounded-[32px]">
          <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-[20px] bg-warning/10">
            <ShieldAlert className="size-8 text-warning" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mb-3">Acceso restringido</h1>
          <p className="text-[14px] text-muted-foreground leading-relaxed mb-8">
            Su cuenta no cuenta con los privilegios administrativos requeridos para ingresar al hub analítico.
          </p>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              toast.success("Conexión terminada");
            }}
            className="inline-flex items-center gap-2 h-12 px-8 rounded-full bg-foreground text-[14px] font-semibold text-white transition-all hover:shadow-lg hover:-translate-y-0.5"
          >
            <LogOut className="size-4" /> Desconectar
          </button>
        </div>
      </div>
    );
  }

  const currentPage = NAV.find((n) =>
    n.exact ? location.pathname === n.to : location.pathname.startsWith(n.to),
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex relative font-sans overflow-hidden">
      
      {/* Global Fallback CSS Background & Lottery Image */}
      <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#418523] via-[#1E431B] to-[#0A1A08]">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('/fondo.jpg.png')] bg-cover bg-center opacity-100 mix-blend-overlay" />
        {/* Glow effect */}
        <div className="absolute -bottom-64 -left-64 w-[600px] h-[600px] bg-[#66C52A] rounded-full mix-blend-screen filter blur-[120px] opacity-30 animate-pulse pointer-events-none" />
      </div>

      {/* ─── Sidebar (Pristine White) ───────────────────────────────────────────── */}
      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-[60] w-[280px] m-4 lg:my-6 lg:ml-6 flex flex-col shrink-0 bg-white rounded-[32px] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] lg:translate-x-0 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.1)] lg:shadow-[0_10px_30px_-10px_rgba(0,0,0,0.05)] border border-black/[0.04]",
          open ? "translate-x-0" : "-translate-x-[120%] lg:translate-x-0"
        )}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-8 h-[88px] shrink-0">
          <div className="flex size-[32px] items-center justify-center rounded-full bg-primary/10 border border-primary/20">
            <div className="size-3 rounded-full bg-primary" />
          </div>
          <div className="leading-none flex items-center gap-1.5">
            <span className="text-[20px] font-black text-foreground tracking-tighter">
              LOTTERY
            </span>
          </div>
          {/* Logout fast-access (always visible, no scroll needed) */}
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              toast.success("Conexión terminada");
            }}
            title="Cerrar sesión"
            className="ml-auto size-9 hidden lg:flex items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors outline-none cursor-pointer"
          >
            <LogOut className="size-4" />
          </button>
          {/* Close on mobile */}
          <button
            onClick={() => setOpen(false)}
            className="lg:hidden ml-auto size-8 flex items-center justify-center rounded-full bg-muted text-muted-foreground outline-none cursor-pointer hover:bg-muted/80 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-5 py-2 space-y-8 custom-scrollbar">
          {SECTIONS.map((section) => {
            const items = dynamicNav.filter((n) => n.section === section);
            if (!items.length) return null;
            return (
              <div key={section} className="space-y-4">
                <div className="px-3 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground/60">
                  {section === "MENU" ? "Menú Principal" : section === "DATA" ? "Procesamiento" : "Preferencias"}
                </div>
                <div className="space-y-1.5">
                  {items.map((item) => {
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
                          "group relative flex items-center justify-between rounded-xl px-4 py-3 text-[14px] font-bold transition-all duration-300 outline-none overflow-hidden",
                          active
                            ? "text-primary bg-primary/[0.08] shadow-[inset_0_1px_1px_rgba(0,0,0,0.02)]"
                            : "text-muted-foreground hover:text-foreground hover:bg-black/[0.02]",
                        )}
                      >
                        {/* The green active bar on the left */}
                        {active && (
                           <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[4px] h-3/5 rounded-r-full bg-primary" />
                        )}
                        
                        <div className="flex items-center gap-3 relative z-10 transition-transform duration-200 group-hover:translate-x-1">
                          <Icon className={cn("size-[18px]", active ? "text-primary" : "text-muted-foreground/70 group-hover:text-foreground")} />
                          <span>{item.label}</span>
                        </div>
                        
                        {item.badge && (
                           <div className="px-2 py-0.5 rounded-[6px] bg-foreground text-background text-[10px] font-bold relative z-10">
                             {item.badge}+
                           </div>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Compact footer with logout */}
        <div className="p-4 mt-auto border-t border-black/[0.04]">
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              toast.success("Conexión terminada");
            }}
            className="w-full flex items-center justify-center gap-2 h-11 rounded-[14px] bg-foreground text-white text-[13px] font-bold hover:bg-foreground/90 transition-colors"
          >
            <LogOut className="size-4" /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="lg:hidden fixed inset-0 z-50 bg-black/20 backdrop-blur-sm transition-opacity"
        />
      )}

      {/* ─── Main area ──────────────────────────────────────────── */}
      <div className="relative flex-1 flex flex-col min-w-0 z-10 lg:my-6 lg:mr-6">
        
        {/* Top Header (SearchBar + Profile) */}
        <header className="hidden lg:flex items-center gap-4 px-5 lg:px-8 h-[88px] shrink-0">

          {/* Search bar mock */}
          <div className="hidden md:flex items-center h-12 bg-white/90 backdrop-blur-md border border-black/[0.04] rounded-full px-4 w-full max-w-[400px] shadow-[0_4px_20px_-5px_rgba(0,0,0,0.05)] transition-shadow focus-within:ring-2 focus-within:ring-primary/20 focus-within:bg-white">
             <Search className="size-4 text-muted-foreground mr-3" />
             <input type="text" placeholder="Search analytics..." className="bg-transparent border-none outline-none flex-1 text-[14px] text-foreground placeholder:text-muted-foreground font-medium" />
             <div className="flex items-center justify-center p-1 px-2 rounded-md bg-muted text-[10px] font-bold text-muted-foreground ml-2">
               ⌘ F
             </div>
          </div>

          <div className="flex-1" />

           {/* Profile Cluster */}
           <div className="flex items-center gap-3">
             <SyncStatusBadge />
             <Link to="/alertas" className="relative hidden sm:flex size-12 items-center justify-center rounded-full bg-white border border-black/[0.04] shadow-[0_4px_20px_-5px_rgba(0,0,0,0.05)] text-muted-foreground hover:text-foreground transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 hover:bg-black/[0.02]">
                <Bell className="size-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-2.5 right-2.5 flex items-center justify-center min-w-4 h-4 px-1 text-[10px] font-bold text-primary-foreground bg-primary rounded-full border-2 border-white">
                    {unreadCount}
                  </span>
                )}
             </Link>
             
             <div className="flex items-center gap-3 h-12 bg-white rounded-full pl-2 pr-5 cursor-pointer hover:bg-white/90 transition-colors border border-black/[0.04] shadow-[0_4px_20px_-5px_rgba(0,0,0,0.05)]">
               <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                  <span className="text-[12px] font-black text-primary">
                    {(session.user.email ?? "A")[0].toUpperCase()}
                  </span>
               </div>
               <div className="hidden lg:flex flex-col justify-center">
                 <span className="text-[13px] font-bold text-foreground leading-none tracking-wide">{session.user.email?.split("@")[0] || "Administrador"}</span>
                 <span className="text-[11px] text-muted-foreground mt-1 leading-none">{session.user.email}</span>
               </div>
             </div>
          </div>
         </header>

        {/* ─── MOBILE NATIVE TOP HEADER ─── */}
        <header className="flex lg:hidden sticky top-0 z-40 h-[64px] items-center justify-between px-5 bg-white/95 backdrop-blur-xl border-b border-black/[0.04] rounded-b-3xl mx-2 mt-2 shadow-sm">
           <div className="flex items-center gap-2.5">
             <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 border border-primary/20">
               <div className="size-2 rounded-full bg-primary" />
             </div>
             <span className="text-[17px] font-black text-foreground tracking-tighter">LOTTERY</span>
           </div>
           <div className="flex items-center gap-2">
             <SyncStatusBadge compact />
             <Link to="/alertas" className="relative size-9 flex items-center justify-center rounded-full bg-black/5 border border-black/[0.04] text-foreground hover:bg-black/10 transition-colors outline-none cursor-pointer">
               <Bell className="size-[17px]" />
               {unreadCount > 0 && <span className="absolute top-1 right-1.5 size-2.5 rounded-full bg-primary border border-white" />}
             </Link>
             <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
               <span className="text-[12px] font-black text-primary">
                 {(session.user.email ?? "A")[0].toUpperCase()}
               </span>
             </div>
           </div>
        </header>

        {/* Page content */}
        <main className="flex-1 min-w-0 relative">
          <OpportunityBanner />
          <div className="mx-auto h-full px-4 lg:px-8 pb-32 lg:pb-10 animate-fade-in relative z-10">
            <Outlet />
          </div>
        </main>
      </div>

      {/* ─── NATIVE FLOATING BOTTOM NAVIGATION (Mobile Only) ─── */}
      <nav className="fixed lg:hidden bottom-[calc(env(safe-area-inset-bottom)+1rem)] left-4 right-4 z-50">
        <div className="flex items-center justify-around h-[70px] px-2 bg-white/95 backdrop-blur-xl border border-black/[0.04] shadow-[0_20px_40px_-10px_rgba(0,0,0,0.15)] rounded-[24px]">
          {[
            { to: "/", icon: LayoutDashboard, label: "Home" },
            { to: "/captura", icon: PencilLine, label: "Captura" },
            { to: "/analisis-hora", icon: Clock, label: "Análisis" },
            { to: "/historial", icon: History, label: "Historial" },
            { isMenuTrigger: true, icon: Menu, label: "Menú" },
          ].map((item, idx) => {
            const active = item.to ? (item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to)) : open;
            const Icon = item.icon;
            
            const content = (
              <>
                {/* Floating Icon Base */}
                <div className={cn(
                   "relative flex items-center justify-center rounded-[18px] transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]",
                   active 
                     ? "size-[44px] bg-primary text-primary-foreground shadow-[0_8px_20px_-4px_var(--color-primary)] -translate-y-[10px]" 
                     : "size-[40px] bg-transparent text-muted-foreground group-hover:bg-muted/50 group-hover:text-foreground"
                )}>
                   <Icon className={cn("size-[22px]", active ? "stroke-[2.5px] drop-shadow-sm" : "stroke-[1.75px]")} />
                </div>
                
                {/* Label that slides up when active */}
                <span className={cn(
                   "absolute bottom-[2px] text-[9.5px] font-extrabold uppercase tracking-widest transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]",
                   active 
                     ? "opacity-100 translate-y-0 text-primary" 
                     : "opacity-0 translate-y-2 pointer-events-none"
                )}>
                  {item.label}
                </span>

                {/* Subtle bottom indicator dot */}
                {active && (
                   <span className="absolute -bottom-2 size-[4px] rounded-full bg-primary/30" />
                )}
              </>
            );

            if (item.isMenuTrigger) {
              return (
                <button
                  key={`btn-${idx}`}
                  onClick={() => setOpen(true)}
                  className="relative flex flex-col items-center justify-center w-full h-[60px] outline-none select-none group cursor-pointer"
                >
                  {content}
                </button>
              );
            }

            return (
              <Link
                key={item.to}
                to={item.to}
                className="relative flex flex-col items-center justify-center w-full h-[60px] outline-none select-none group"
              >
                {content}
              </Link>
            );
          })}
        </div>
      </nav>

      <PushPrompt />
    </div>
  );
}
