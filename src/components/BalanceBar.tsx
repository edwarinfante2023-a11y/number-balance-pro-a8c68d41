export function BalanceBar({
  leftLabel,
  rightLabel,
  leftValue,
  rightValue,
  leftClass,
  rightClass,
}: {
  leftLabel: string;
  rightLabel: string;
  leftValue: number;
  rightValue: number;
  leftClass: string;
  rightClass: string;
}) {
  const total = leftValue + rightValue || 1;
  const leftPct = (leftValue / total) * 100;
  const rightPct = 100 - leftPct;

  // Determine which side dominates
  const leftDominant = leftPct >= rightPct;

  return (
    <div className="space-y-4">
      {/* Labels row */}
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span className="text-[13px] font-bold text-foreground">{leftLabel}</span>
          <span className="text-2xl font-extrabold tabular-nums text-foreground">
            {leftValue}
          </span>
          <span className={`text-[12px] tabular-nums font-bold ml-1 ${leftDominant ? "text-foreground" : "text-muted-foreground"}`}>
            {leftPct.toFixed(0)}%
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className={`text-[12px] tabular-nums font-bold mr-1 ${!leftDominant ? "text-foreground" : "text-muted-foreground"}`}>
            {rightPct.toFixed(0)}%
          </span>
          <span className="text-2xl font-extrabold tabular-nums text-foreground">
            {rightValue}
          </span>
          <span className="text-[13px] font-bold text-foreground">{rightLabel}</span>
        </div>
      </div>

      {/* Clean Light UI Bar Container */}
      <div className="relative h-3 w-full rounded-full bg-muted overflow-hidden flex shadow-inner">
        {/* Left Bar */}
        <div
          className={`${leftClass} h-full transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] relative shadow-[inset_0_-2px_4px_rgba(0,0,0,0.1)]`}
          style={{ width: `${leftPct}%` }}
        />
        
        {/* Divider */}
        <div className="h-full w-1 bg-white relative z-10 opacity-80" />

        {/* Right Bar */}
        <div
          className={`${rightClass} h-full transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] relative shadow-[inset_0_-2px_4px_rgba(0,0,0,0.1)]`}
          style={{ width: `${rightPct}%` }}
        />
      </div>
    </div>
  );
}
