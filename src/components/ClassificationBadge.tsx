import type { AltoBajo, ParImpar, Subcuadrante } from "@/lib/lottery";
import { cn } from "@/lib/utils";

export function AltoBajoBadge({ value, soft = true }: { value: AltoBajo; soft?: boolean }) {
  const isAlto = value === "ALTO";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums",
        soft
          ? isAlto
            ? "bg-alto-soft text-alto-soft-foreground"
            : "bg-bajo-soft text-bajo-soft-foreground"
          : isAlto
            ? "bg-alto text-alto-foreground"
            : "bg-bajo text-bajo-foreground",
      )}
    >
      {value}
    </span>
  );
}

export function ParImparBadge({ value, soft = true }: { value: ParImpar; soft?: boolean }) {
  const isPar = value === "PAR";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        soft
          ? isPar
            ? "bg-par-soft text-par-soft-foreground"
            : "bg-impar-soft text-impar-soft-foreground"
          : isPar
            ? "bg-par text-par-foreground"
            : "bg-impar text-impar-foreground",
      )}
    >
      {value}
    </span>
  );
}

const SUBC_LABEL: Record<Subcuadrante, string> = {
  ALTO_PAR: "Alto · Par",
  ALTO_IMPAR: "Alto · Impar",
  BAJO_PAR: "Bajo · Par",
  BAJO_IMPAR: "Bajo · Impar",
};

export function SubcuadranteBadge({ value }: { value: Subcuadrante }) {
  return (
    <span className="inline-flex items-center rounded-md border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-foreground">
      {SUBC_LABEL[value]}
    </span>
  );
}
