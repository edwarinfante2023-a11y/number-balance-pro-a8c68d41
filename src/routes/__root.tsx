import {
  Outlet,
  Link,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

import appCss from "../styles.css?url";

interface RouterContext {
  queryClient: QueryClient;
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página no encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          La página que buscas no existe o fue movida.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Ir al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0",
      },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { title: "Cuadrante — Análisis inteligente de sorteos" },
      {
        name: "description",
        content:
          "Plataforma de análisis estructurado de sorteos por hora. Patrones, rachas, equilibrio y escenarios probables.",
      },
      { name: "author", content: "Cuadrante" },
      { property: "og:title", content: "Cuadrante — Análisis inteligente de sorteos" },
      {
        property: "og:description",
        content: "Patrones, rachas, equilibrio y escenarios probables basados en histórico.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Cuadrante — Análisis inteligente de sorteos" },
      { name: "description", content: "Pattern Predictor Pro analyzes historical lottery draw data to identify patterns and trends." },
      { property: "og:description", content: "Pattern Predictor Pro analyzes historical lottery draw data to identify patterns and trends." },
      { name: "twitter:description", content: "Pattern Predictor Pro analyzes historical lottery draw data to identify patterns and trends." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/80f13517-6453-48b1-92a5-48a80f4820f7/id-preview-8a0ce4e1--eaae42aa-34c4-457c-a07c-36f8131c182e.lovable.app-1776717448323.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/80f13517-6453-48b1-92a5-48a80f4820f7/id-preview-8a0ce4e1--eaae42aa-34c4-457c-a07c-36f8131c182e.lovable.app-1776717448323.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'draws',
        },
        () => {
          // Invalidamos la query de 'draws' para que las tablas y dashboard se actualicen al instante
          queryClient.invalidateQueries({ queryKey: ["draws"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <AppLayout />
      <Toaster position="top-right" richColors closeButton />
    </QueryClientProvider>
  );
}
