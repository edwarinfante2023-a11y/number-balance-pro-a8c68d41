import { ReactNode } from "react";

export function StatCard({
  label,
  value,
  hint,
  icon,
  accent,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  accent?: "alto" | "bajo" | "par" | "impar" | "neutral";
}) {
  const accentClass =
    accent === "alto"
      ? "before:bg-alto"
      : accent === "bajo"
        ? "before:bg-bajo"
        : accent === "par"
          ? "before:bg-par"
          : accent === "impar"
            ? "before:bg-impar"
            : "before:bg-foreground/40";

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] before:absolute before:left-0 before:top-0 before:h-full before:w-[3px] ${accentClass}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </div>
      <div className="mt-2 text-2xl lg:text-3xl font-semibold tracking-tight tabular-nums">
        {value}
      </div>
      {hint && <div className="mt-1.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
