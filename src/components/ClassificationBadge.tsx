import type { AltoBajo, ParImpar, Subcuadrante } from "@shared/lottery";
import { cn } from "@/lib/utils";

export function AltoBajoBadge({ value, soft = true }: { value: AltoBajo; soft?: boolean }) {
  const isAlto = value === "ALTO";

  if (soft) {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-bold tracking-widest uppercase border shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]",
          isAlto
            ? "bg-alto-soft border-alto/10 text-alto shadow-[0_0_8px_var(--color-alto-soft)]"
            : "bg-bajo-soft border-bajo/10 text-bajo shadow-[0_0_8px_var(--color-bajo-soft)]",
        )}
      >
        {value}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-bold tracking-widest uppercase border shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_2px_4px_rgba(0,0,0,0.5)]",
        isAlto
          ? "bg-alto border-alto/50 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)] shadow-[0_0_10px_var(--color-alto)]"
          : "bg-bajo border-bajo/50 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)] shadow-[0_0_10px_var(--color-bajo)]",
      )}
    >
      {value}
    </span>
  );
}

export function ParImparBadge({ value, soft = true }: { value: ParImpar; soft?: boolean }) {
  const isPar = value === "PAR";

  if (soft) {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-bold tracking-widest uppercase border shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]",
          isPar
            ? "bg-par-soft border-par/10 text-par shadow-[0_0_8px_var(--color-par-soft)]"
            : "bg-impar-soft border-impar/10 text-impar shadow-[0_0_8px_var(--color-impar-soft)]",
        )}
      >
        {value}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-bold tracking-widest uppercase border shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_2px_4px_rgba(0,0,0,0.5)]",
        isPar
          ? "bg-par border-par/50 text-primary-foreground drop-shadow-[0_1px_1px_rgba(255,255,255,0.3)] shadow-[0_0_10px_var(--color-par)]"
          : "bg-impar border-impar/50 text-impar-foreground drop-shadow-[0_1px_1px_rgba(255,255,255,0.3)] shadow-[0_0_10px_var(--color-impar)]",
      )}
    >
      {value}
    </span>
  );
}

const SUBC_LABEL: Record<Subcuadrante, string> = {
  ALTO_PAR: "A·P",
  ALTO_IMPAR: "A·I",
  BAJO_PAR: "B·P",
  BAJO_IMPAR: "B·I",
};

export function SubcuadranteBadge({ value }: { value: Subcuadrante }) {
  return (
    <span className="inline-flex items-center rounded-md surface-inset border border-white/5 shadow-[inset_0_1px_3px_black] px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground/80 tracking-widest">
      {SUBC_LABEL[value]}
    </span>
  );
}
