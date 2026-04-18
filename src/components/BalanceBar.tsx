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
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="font-medium text-foreground">
          {leftLabel} <span className="text-muted-foreground tabular-nums">{leftValue}</span>
        </span>
        <span className="font-medium text-foreground">
          <span className="text-muted-foreground tabular-nums">{rightValue}</span> {rightLabel}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted flex">
        <div className={leftClass} style={{ width: `${leftPct}%` }} />
        <div className={rightClass} style={{ width: `${rightPct}%` }} />
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1 tabular-nums">
        <span>{leftPct.toFixed(1)}%</span>
        <span>{rightPct.toFixed(1)}%</span>
      </div>
    </div>
  );
}
