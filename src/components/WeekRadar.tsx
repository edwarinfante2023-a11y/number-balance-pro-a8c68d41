import { useDualSystemGlobal } from "@/hooks/useDualSystem";
import { cn } from "@/lib/utils";
import { Shield, Crosshair, Zap, Loader2, Eye } from "lucide-react";

/**
 * WeekRadar — Semáforo Semanal del Sistema Dual AI.
 * Muestra en tiempo real si la semana es Matemática (Verde/Francotirador)
 * o Caótica (Rojo/Modo Dios), con el estado del Motor activo.
 */
export function WeekRadar() {
  const { data: state, isLoading } = useDualSystemGlobal();

  if (isLoading) {
    return (
      <div className="rounded-[24px] bg-white/95 backdrop-blur-md border border-black/[0.04] p-6 shadow-sm animate-pulse">
        <div className="flex items-center gap-3">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
          <span className="text-[13px] font-bold text-muted-foreground">Inicializando Radar AI...</span>
        </div>
      </div>
    );
  }

  if (!state) return null;

  const isMath = state.weekType === "MATH";
  const hasGodShot = !!state.godModePrediction;

  return (
    <div
      className={cn(
        "relative rounded-[24px] overflow-hidden border shadow-sm transition-all duration-500",
        isMath
          ? "bg-gradient-to-br from-emerald-50 via-white to-emerald-50/50 border-emerald-200/60"
          : hasGodShot
            ? "bg-gradient-to-br from-violet-50 via-white to-amber-50/50 border-violet-200/60"
            : "bg-gradient-to-br from-rose-50 via-white to-orange-50/50 border-rose-200/60",
      )}
    >
      {/* Decorative glow */}
      <div
        className={cn(
          "absolute -top-16 -right-16 size-48 rounded-full blur-3xl opacity-30 pointer-events-none",
          isMath ? "bg-emerald-400" : hasGodShot ? "bg-violet-400" : "bg-rose-400",
        )}
      />
      <div
        className={cn(
          "absolute -bottom-8 -left-8 size-32 rounded-full blur-2xl opacity-20 pointer-events-none",
          isMath ? "bg-emerald-300" : hasGodShot ? "bg-violet-300" : "bg-rose-300",
        )}
      />

      <div className="relative z-10 p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Semáforo Dot */}
            <div className="relative">
              <div
                className={cn(
                  "size-4 rounded-full shadow-sm",
                  isMath ? "bg-emerald-500" : hasGodShot ? "bg-violet-500" : "bg-rose-500",
                )}
              />
              <div
                className={cn(
                  "absolute inset-0 size-4 rounded-full animate-ping",
                  isMath ? "bg-emerald-400" : hasGodShot ? "bg-violet-400" : "bg-rose-400",
                )}
                style={{ animationDuration: "2s" }}
              />
            </div>
            <div>
              <h3 className="text-[15px] font-black tracking-tight text-foreground">
                RADAR AI — SISTEMA DUAL
              </h3>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">
                Última hora analizada: {state.hora}
              </p>
            </div>
          </div>

          {/* Motor Badge */}
          <div
            className={cn(
              "flex items-center gap-1.5 h-8 px-3 rounded-full text-[11px] font-black uppercase tracking-wider shadow-sm",
              isMath
                ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                : hasGodShot
                  ? "bg-violet-100 text-violet-800 border border-violet-200"
                  : "bg-rose-100 text-rose-800 border border-rose-200",
            )}
          >
            {isMath ? (
              <><Crosshair className="size-3.5" /> FRANCOTIRADOR</>
            ) : hasGodShot ? (
              <><Zap className="size-3.5" /> MODO DIOS</>
            ) : (
              <><Eye className="size-3.5" /> VIGILANCIA</>
            )}
          </div>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
          {/* Week Type */}
          <div className="rounded-xl bg-white/80 backdrop-blur-sm border border-black/[0.04] p-3.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Estado de la Semana
            </div>
            <div
              className={cn(
                "mt-1.5 text-[18px] font-black tracking-tight",
                isMath ? "text-emerald-700" : "text-rose-700",
              )}
            >
              {isMath ? "MATEMÁTICA" : "CAÓTICA"}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {isMath
                ? "La lotería está predecible. Dispare."
                : "El PRNG está en modo aleatorio."}
            </div>
          </div>

          {/* Motor Activo */}
          <div className="rounded-xl bg-white/80 backdrop-blur-sm border border-black/[0.04] p-3.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Motor Activo
            </div>
            <div className="mt-1.5 text-[18px] font-black tracking-tight text-foreground">
              {isMath ? "Motor 1" : "Motor 2"}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {isMath
                ? "Francotirador de Alta Frecuencia"
                : "Súper Francotirador (Modo Dios)"}
            </div>
          </div>

          {/* God Mode Signal */}
          <div
            className={cn(
              "rounded-xl backdrop-blur-sm border p-3.5",
              hasGodShot
                ? "bg-violet-50/80 border-violet-200/60"
                : "bg-white/80 border-black/[0.04]",
            )}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Señal Modo Dios
            </div>
            {hasGodShot ? (
              <>
                <div className="mt-1.5 flex items-center gap-2">
                  <Zap className="size-4 text-violet-600" />
                  <span className="text-[18px] font-black tracking-tight text-violet-700">
                    {state.godModePrediction}
                  </span>
                </div>
                <div className="text-[11px] font-bold text-violet-600 mt-0.5">
                  ¡Alerta de Disparo! Confianza {state.confidence}%
                </div>
              </>
            ) : (
              <>
                <div className="mt-1.5 text-[18px] font-black tracking-tight text-muted-foreground/50">
                  —
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Sin señal. Robot en las sombras.
                </div>
              </>
            )}
          </div>
        </div>

        {/* Confidence bar */}
        <div className="mt-4 pt-3 border-t border-black/[0.04]">
          <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground mb-1.5">
            <span>Confianza del Radar</span>
            <span className="tabular-nums">{Math.round(state.confidence)}%</span>
          </div>
          <div className="h-2 rounded-full bg-black/[0.04] overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-1000 ease-out",
                isMath
                  ? "bg-gradient-to-r from-emerald-400 to-emerald-500"
                  : hasGodShot
                    ? "bg-gradient-to-r from-violet-400 to-violet-500"
                    : "bg-gradient-to-r from-rose-300 to-rose-400",
              )}
              style={{ width: `${Math.min(100, state.confidence)}%` }}
            />
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-[10px] text-muted-foreground">
            <Shield className="size-3" />
            <span>{state.sampleSize} sorteos analizados en esta hora</span>
          </div>
        </div>
      </div>
    </div>
  );
}
