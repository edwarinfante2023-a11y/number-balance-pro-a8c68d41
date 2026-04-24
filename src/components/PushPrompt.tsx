import { useState, useEffect } from "react";
import { X, BellRing, ShieldAlert, Loader2 } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { cn } from "@/lib/utils";

export function PushPrompt() {
  const { isSupported, permission, isSubscribed, subscribe, isLoading } = usePushNotifications();
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Si no está soportado, o si ya se denegó o ya se suscribió, no mostrar.
    if (!isSupported || permission === "denied" || isSubscribed) {
      setShowPrompt(false);
      return;
    }

    // Chequear localStorage para saber si ya lo cerramos antes
    const hasDismissed = localStorage.getItem("push_prompt_dismissed");
    if (!hasDismissed) {
      // Pequeño delay para que no salga instantáneamente y asuste
      const timer = setTimeout(() => setShowPrompt(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [isSupported, permission, isSubscribed]);

  if (!showPrompt) return null;

  const dismiss = () => {
    localStorage.setItem("push_prompt_dismissed", "true");
    setShowPrompt(false);
  };

  const handleSubscribe = async () => {
    const success = await subscribe();
    if (success) {
      setShowPrompt(false);
    } else {
      // Si falla (o deniega), marcamos dismiss para no molestarlo otra vez.
      dismiss();
    }
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:w-[380px] z-[100] animate-in slide-in-from-bottom-5 fade-in duration-300">
      <div className="bg-white rounded-[24px] border border-border shadow-[0_20px_40px_rgba(0,0,0,0.12)] p-5 relative overflow-hidden">
        {/* Banner ad-style */}
        <div className="absolute top-0 right-0 w-[150px] h-[150px] bg-primary/10 rounded-full blur-[40px] pointer-events-none -translate-y-1/2 translate-x-1/3" />
        
        <button 
          onClick={dismiss}
          className="absolute top-3 right-3 size-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors z-10"
        >
          <X className="size-4" />
        </button>

        <div className="flex gap-4 relative z-10">
          <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
            <BellRing className="size-6 text-primary" />
          </div>
          <div className="pt-1">
            <h4 className="text-[15px] font-bold text-foreground leading-tight">
              Activar Notificaciones
            </h4>
            <p className="text-[12.5px] text-muted-foreground leading-relaxed mt-1">
              Recibe alertas push nativas cuando el motor detecte oportunidades de nivel alto.
            </p>
          </div>
        </div>

        <div className="flex gap-2 mt-5 relative z-10">
          <button
            onClick={dismiss}
            className="flex-1 h-10 rounded-[12px] bg-muted/50 text-muted-foreground text-[13px] font-bold hover:bg-muted transition-colors"
          >
            Más tarde
          </button>
          <button
            onClick={handleSubscribe}
            disabled={isLoading}
            className="flex-[2] h-10 rounded-[12px] bg-primary text-white text-[13px] font-bold shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading && <Loader2 className="size-4 animate-spin" />}
            Permitir Alertas
          </button>
        </div>
      </div>
    </div>
  );
}
