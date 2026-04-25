import { ReactNode } from "react";
import { cn } from "@/lib/utils";

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
  accent?: "alto" | "bajo" | "par" | "impar" | "default";
}) {
  const getAccentStyles = () => {
    switch (accent) {
      case "alto":
        return {
          iconBg: "bg-alto/10 text-alto",
          dot: "bg-alto",
          borderHover: "hover:border-alto/30",
        };
      case "bajo":
        return {
          iconBg: "bg-bajo/10 text-bajo",
          dot: "bg-bajo",
          borderHover: "hover:border-bajo/30",
        };
      case "par":
        return {
          iconBg: "bg-par/10 text-par",
          dot: "bg-par",
          borderHover: "hover:border-par/30",
        };
      case "impar":
        return {
          iconBg: "bg-impar/10 text-impar",
          dot: "bg-impar",
          borderHover: "hover:border-impar/30",
        };
      default:
        return {
          iconBg: "bg-primary/10 text-primary",
          dot: "bg-primary",
          borderHover: "hover:border-primary/30",
        };
    }
  };

  const styles = getAccentStyles();

  return (
    <div
      className={cn(
        "group relative flex flex-col justify-between overflow-hidden rounded-[24px] p-6 lg:p-7",
        "bg-white border border-black/[0.04] shadow-[0_4px_20px_-5px_rgba(0,0,0,0.05)] transition-all duration-300",
        styles.borderHover,
        "hover:-translate-y-1 hover:shadow-[0_10px_30px_-10px_rgba(0,0,0,0.1)] cursor-default",
      )}
    >
      {/* Soft gradient background decoration */}
      <div
        className={cn(
          "absolute -top-10 -right-10 h-32 w-32 rounded-full blur-[40px] opacity-10 group-hover:opacity-20 transition-opacity duration-500 pointer-events-none",
          styles.dot, // Reuse dot color for the blur
        )}
      />

      {/* Top section: Icon and Label */}
      <div className="relative z-10 flex items-start justify-between mb-8">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className={cn("size-2 rounded-full", styles.dot)} />
            <span className="text-[13px] font-bold text-muted-foreground group-hover:text-foreground transition-colors duration-300">
              {label}
            </span>
          </div>
        </div>
        {icon && (
          <div
            className={cn(
              "flex size-10 items-center justify-center rounded-xl",
              styles.iconBg,
              "group-hover:scale-110 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
            )}
          >
            <div className="size-5 shrink-0">{icon}</div>
          </div>
        )}
      </div>

      {/* Bottom section: Value and Hint */}
      <div className="relative z-10">
        <div className="flex items-baseline gap-2">
          <div className="text-[40px] font-extrabold tracking-tight text-foreground leading-none transition-transform duration-300 group-hover:translate-x-1">
            {value}
          </div>
        </div>
        {hint && (
          <div className="mt-3 flex items-center gap-2 text-[12px] font-medium text-muted-foreground leading-relaxed border-t border-black/[0.04] pt-3">
            {hint}
          </div>
        )}
      </div>
    </div>
  );
}
