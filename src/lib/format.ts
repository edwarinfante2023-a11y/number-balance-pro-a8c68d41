export function formatPct(n: number, digits = 0) {
  return `${n.toFixed(digits)}%`;
}

export function cn(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}
