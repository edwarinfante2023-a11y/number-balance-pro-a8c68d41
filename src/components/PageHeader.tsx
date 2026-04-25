import { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-8 relative z-10">
      <div>
        <h1 className="text-2xl lg:text-3xl font-black tracking-tighter text-foreground uppercase">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 text-[14px] text-muted-foreground max-w-xl leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
